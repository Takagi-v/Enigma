const express = require('express');
const router = express.Router();
const { db } = require('../models/db');
const { authenticateToken } = require('../middleware/auth');

// 获取用户的停车记录
router.get("/my", authenticateToken, (req, res) => {
  const userId = req.user.id;
  console.log('获取用户停车记录，用户ID:', userId);

  const query = `
    SELECT 
      pu.*,
      ps.location,
      ps.hourly_rate
    FROM parking_usage pu
    JOIN parking_spots ps ON pu.parking_spot_id = ps.id
    WHERE pu.user_id = ?
    ORDER BY pu.start_time DESC
  `;

  db().all(query, [userId], (err, records) => {
    if (err) {
      console.error('获取停车记录失败:', err);
      return res.status(500).json({ 
        message: "获取停车记录失败",
        code: 'DB_ERROR'
      });
    }

    console.log('找到的停车记录:', records);
    res.json({ 
      records: records.map(record => ({
        ...record,
        total_amount: record.total_amount ? parseFloat(record.total_amount) : null
      }))
    });
  });
});

// 开始使用停车位
router.post("/:spotId/start", authenticateToken, (req, res) => {
  const { spotId } = req.params;
  const userId = req.user.id;
  const { vehicle_plate } = req.body;

  console.log('开始使用停车位:', { spotId, userId, vehicle_plate });

  // 首先检查停车位是否可用
  db().get(
    "SELECT * FROM parking_spots WHERE id = ? AND status = 'available'",
    [spotId],
    (err, spot) => {
      if (err) {
        console.error('检查停车位状态失败:', err);
        return res.status(500).json({ 
          message: "检查停车位状态失败",
          code: 'DB_ERROR'
        });
      }

      if (!spot) {
        console.log('停车位不可用:', spotId);
        return res.status(400).json({ 
          message: "停车位不可用",
          code: 'SPOT_UNAVAILABLE'
        });
      }

      // 检查用户是否已经有正在使用的停车位
      db().get(
        "SELECT * FROM parking_usage WHERE user_id = ? AND status = 'active'",
        [userId],
        (err, activeUsage) => {
          if (err) {
            console.error('检查用户当前使用状态失败:', err);
            return res.status(500).json({ 
              message: "检查用户当前使用状态失败",
              code: 'DB_ERROR'
            });
          }

          if (activeUsage) {
            console.log('用户已有正在使用的停车位:', activeUsage);
            return res.status(400).json({ 
              message: "您已有正在使用的停车位",
              code: 'ALREADY_IN_USE'
            });
          }

          // 开启事务
          db().run("BEGIN TRANSACTION");

          // 创建使用记录
          db().run(
            `INSERT INTO parking_usage (
              parking_spot_id, 
              user_id, 
              start_time,
              vehicle_plate,
              status
            ) VALUES (?, ?, datetime('now'), ?, 'active')`,
            [spotId, userId, vehicle_plate],
            function(err) {
              if (err) {
                console.error('创建使用记录失败:', err);
                db().run("ROLLBACK");
                return res.status(500).json({ 
                  message: "创建使用记录失败",
                  code: 'DB_ERROR'
                });
              }

              const usageId = this.lastID;

              // 更新停车位状态
              db().run(
                "UPDATE parking_spots SET status = 'occupied', current_user_id = ? WHERE id = ?",
                [userId, spotId],
                (err) => {
                  if (err) {
                    console.error('更新停车位状态失败:', err);
                    db().run("ROLLBACK");
                    return res.status(500).json({ 
                      message: "更新停车位状态失败",
                      code: 'DB_ERROR'
                    });
                  }

                  db().run("COMMIT");
                  console.log('成功开始使用停车位:', { usageId, spotId });
                  res.json({ 
                    message: "开始使用停车位",
                    usage_id: usageId,
                    code: 'SUCCESS'
                  });
                }
              );
            }
          );
        }
      );
    }
  );
});

// 结束使用停车位
router.post("/:spotId/end", authenticateToken, (req, res) => {
  const { spotId } = req.params;
  const userId = req.user.id;

  console.log('结束使用停车位:', { spotId, userId });

  // 获取使用记录
  db().get(
    `SELECT pu.*, ps.hourly_rate 
     FROM parking_usage pu
     JOIN parking_spots ps ON pu.parking_spot_id = ps.id
     WHERE pu.parking_spot_id = ? 
     AND pu.user_id = ? 
     AND pu.status = 'active'`,
    [spotId, userId],
    (err, usage) => {
      if (err) {
        console.error('获取使用记录失败:', err);
        return res.status(500).json({ 
          message: "获取使用记录失败",
          code: 'DB_ERROR'
        });
      }

      if (!usage) {
        console.log('未找到有效的使用记录:', { spotId, userId });
        return res.status(404).json({ 
          message: "未找到有效的使用记录",
          code: 'USAGE_NOT_FOUND'
        });
      }

      // 开启事务
      db().run("BEGIN TRANSACTION");

      // 计算费用
      const startTime = new Date(usage.start_time);
      const endTime = new Date();
      const hours = (endTime - startTime) / (1000 * 60 * 60);
      const totalAmount = Math.ceil(hours * usage.hourly_rate);

      console.log('计算费用:', { 
        startTime, 
        endTime, 
        hours, 
        hourlyRate: usage.hourly_rate, 
        totalAmount 
      });

      // 更新使用记录
      db().run(
        `UPDATE parking_usage 
         SET end_time = datetime('now'),
             total_amount = ?,
             status = 'completed',
             payment_status = 'pending'
         WHERE id = ?`,
        [totalAmount, usage.id],
        (err) => {
          if (err) {
            console.error('更新使用记录失败:', err);
            db().run("ROLLBACK");
            return res.status(500).json({ 
              message: "更新使用记录失败",
              code: 'DB_ERROR'
            });
          }

          // 更新停车位状态
          db().run(
            "UPDATE parking_spots SET status = 'available', current_user_id = NULL WHERE id = ?",
            [spotId],
            (err) => {
              if (err) {
                console.error('更新停车位状态失败:', err);
                db().run("ROLLBACK");
                return res.status(500).json({ 
                  message: "更新停车位状态失败",
                  code: 'DB_ERROR'
                });
              }

              db().run("COMMIT");
              console.log('成功结束使用停车位:', { 
                usageId: usage.id, 
                spotId, 
                totalAmount 
              });
              res.json({
                message: "结束使用停车位",
                total_amount: totalAmount,
                code: 'SUCCESS'
              });
            }
          );
        }
      );
    }
  );
});

// 支付停车费用
router.post("/:usageId/payment", authenticateToken, (req, res) => {
  const { usageId } = req.params;
  const userId = req.user.id;

  console.log('处理停车费用支付:', { usageId, userId });

  // 检查使用记录是否存在且属于当前用户
  db().get(
    `SELECT * FROM parking_usage 
     WHERE id = ? AND user_id = ? AND status = 'completed' AND payment_status = 'pending'`,
    [usageId, userId],
    (err, usage) => {
      if (err) {
        console.error('查询使用记录失败:', err);
        return res.status(500).json({ 
          message: "查询使用记录失败",
          code: 'DB_ERROR'
        });
      }

      if (!usage) {
        console.log('未找到有效的支付记录:', { usageId, userId });
        return res.status(404).json({ 
          message: "未找到有效的支付记录",
          code: 'USAGE_NOT_FOUND'
        });
      }

      // 更新支付状态
      db().run(
        "UPDATE parking_usage SET payment_status = 'paid' WHERE id = ?",
        [usageId],
        function(err) {
          if (err) {
            console.error('更新支付状态失败:', err);
            return res.status(500).json({ 
              message: "更新支付状态失败",
              code: 'DB_ERROR'
            });
          }

          console.log('支付成功:', { usageId });
          res.json({ 
            message: "支付成功",
            code: 'SUCCESS'
          });
        }
      );
    }
  );
});

module.exports = router; 