const express = require('express');
const router = express.Router();
const { db } = require('../models/db');
const { authenticateToken } = require('../middleware/auth');

// 获取当前使用状态
router.get("/current", authenticateToken, (req, res) => {
  const userId = req.user.id;
  console.log('获取用户当前使用状态，用户ID:', userId);

  const query = `
    SELECT 
      pu.*,
      ps.location,
      ps.hourly_rate
    FROM parking_usage pu
    JOIN parking_spots ps ON pu.parking_spot_id = ps.id
    WHERE pu.user_id = ? AND pu.status = 'active'
    ORDER BY pu.start_time DESC
    LIMIT 1
  `;

  db().get(query, [userId], (err, record) => {
    if (err) {
      console.error('获取当前使用状态失败:', err);
      return res.status(500).json({ 
        message: "获取当前使用状态失败",
        code: 'DB_ERROR'
      });
    }

    if (!record) {
      return res.json({ usage: null });
    }

    console.log('找到当前使用记录:', record);
    res.json({ 
      usage: {
        ...record,
        total_amount: record.total_amount ? parseFloat(record.total_amount) : null
      }
    });
  });
});

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

          // 创建使用记录，明确指定使用UTC时间
          db().run(
            `INSERT INTO parking_usage (
              parking_spot_id, 
              user_id, 
              start_time,
              vehicle_plate,
              status
            ) VALUES (?, ?, datetime('now', 'utc'), ?, 'active')`,
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

      // 使用SQLite的日期时间函数计算时间差和费用，明确使用UTC时间
      db().get(
        `SELECT 
          ROUND((julianday('now', 'utc') - julianday(start_time)) * 24) AS hours,
          ROUND((julianday('now', 'utc') - julianday(start_time)) * 24 * ?) AS amount
        FROM parking_usage WHERE id = ?`, 
        [usage.hourly_rate, usage.id], 
        (err, calculation) => {
          if (err) {
            console.error('计算费用失败:', err);
            db().run("ROLLBACK");
            return res.status(500).json({ 
              message: "计算费用失败",
              code: 'DB_ERROR'
            });
          }

          // 取整费用
          const totalAmount = Math.ceil(calculation.amount);

          console.log('计算费用:', { 
            hourlyRate: usage.hourly_rate,
            hours: calculation.hours,
            totalAmount 
          });

          // 更新使用记录，明确使用UTC时间
          db().run(
            `UPDATE parking_usage 
             SET end_time = datetime('now', 'utc'),
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
    }
  );
});

// 支付停车费用
router.post("/:usageId/payment", authenticateToken, async (req, res) => {
  const { usageId } = req.params;
  const userId = req.user.id;

  console.log('处理停车费用支付:', { usageId, userId });

  try {
    // 检查使用记录是否存在且属于当前用户
    const usage = await new Promise((resolve, reject) => {
      db().get(
        `SELECT * FROM parking_usage 
         WHERE id = ? AND user_id = ? AND status = 'completed' AND payment_status = 'pending'`,
        [usageId, userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!usage) {
      console.log('未找到有效的支付记录:', { usageId, userId });
      return res.status(404).json({ 
        message: "未找到有效的支付记录",
        code: 'USAGE_NOT_FOUND'
      });
    }

    // 获取用户的赠送余额和账户余额
    const [giftBalance, accountBalance] = await Promise.all([
      new Promise((resolve, reject) => {
        db().get(
          `SELECT COALESCE(SUM(amount), 0) AS total 
           FROM coupons
           WHERE user_id = ? AND type = 'gift_balance' AND status = 'valid'`,
          [usage.user_id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row.total);
          }
        );
      }),
      new Promise((resolve, reject) => {
        db().get(
          `SELECT COALESCE(balance, 0) AS balance FROM users WHERE id = ?`,
          [usage.user_id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row.balance);
          }
        );
      })
    ]);

    let giftBalanceUsed = 0;
    let accountBalanceUsed = 0;

    if (giftBalance >= usage.total_amount) {
      // 赠送余额足够支付全部费用
      giftBalanceUsed = usage.total_amount;
    } else {
      // 赠送余额不足,先用完赠送余额,再从账户余额中扣除剩余部分
      giftBalanceUsed = giftBalance;
      accountBalanceUsed = usage.total_amount - giftBalance;
    }

    // 检查余额是否足够
    if (giftBalanceUsed + accountBalance < usage.total_amount) {
      return res.status(400).json({
        message: "余额不足",
        code: 'INSUFFICIENT_BALANCE'
      });
    }

    // 开启事务
    await new Promise((resolve, reject) => {
      db().run("BEGIN TRANSACTION", err => {
        if (err) reject(err);
        else resolve();
      });
    });

    try {
      // 更新赠送余额
      if (giftBalanceUsed > 0) {
        await new Promise((resolve, reject) => {
          db().run(
            `UPDATE coupons
             SET amount = amount - ?,
                 status = CASE WHEN amount - ? <= 0 THEN 'used' ELSE status END,
                 used_at = CASE WHEN amount - ? <= 0 THEN DATETIME('now', 'utc') ELSE used_at END
             WHERE user_id = ? AND type = 'gift_balance' AND status = 'valid'`,
            [giftBalanceUsed, giftBalanceUsed, giftBalanceUsed, usage.user_id],
            err => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      // 更新账户余额
      if (accountBalanceUsed > 0) {
        await new Promise((resolve, reject) => {
          db().run(
            `UPDATE users SET balance = balance - ? WHERE id = ?`,
            [accountBalanceUsed, usage.user_id],
            err => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      // 更新支付状态
      await new Promise((resolve, reject) => {
        db().run(
          `UPDATE parking_usage 
           SET payment_status = 'paid',
               payment_method = 'balance',
               payment_time = DATETIME('now', 'utc')
           WHERE id = ?`,
          [usageId],
          err => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // 提交事务
      await new Promise((resolve, reject) => {
        db().run("COMMIT", err => {
          if (err) reject(err);
          else resolve();
        });
      });

      res.json({ 
        message: '支付成功',
        code: 'SUCCESS'
      });

    } catch (error) {
      // 回滚事务
      await new Promise((resolve) => {
        db().run("ROLLBACK", () => resolve());
      });
      throw error;
    }

  } catch (error) {
    console.error('支付失败:', error);
    return res.status(500).json({ 
      message: "支付失败",
      code: 'PAYMENT_ERROR'
    });
  }
});

module.exports = router; 