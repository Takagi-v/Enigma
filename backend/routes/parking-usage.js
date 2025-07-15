const express = require('express');
const router = express.Router();
const { get, all, run } = require('../models/db');
const { authenticateToken } = require('../middleware/auth');
const parkingLockService = require('../services/parkingLockService');

// 获取当前使用状态
router.get("/current", authenticateToken, async (req, res) => {
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

  try {
    const record = await get(query, [userId]);
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
  } catch (err) {
    console.error('获取当前使用状态失败:', err);
    return res.status(500).json({ 
      message: "获取当前使用状态失败",
      code: 'DB_ERROR'
  });
  }
});

// 获取用户的停车记录
router.get("/my", authenticateToken, async (req, res) => {
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

  try {
    const records = await all(query, [userId]);
    console.log('找到的停车记录:', records);
    res.json({ 
      records: records.map(record => ({
        ...record,
        total_amount: record.total_amount ? parseFloat(record.total_amount) : null
      }))
    });
  } catch (err) {
    console.error('获取停车记录失败:', err);
    return res.status(500).json({ 
      message: "获取停车记录失败",
      code: 'DB_ERROR'
  });
  }
});

// 开始使用停车位
router.post("/:spotId/start", authenticateToken, async (req, res) => {
  const { spotId } = req.params;
  const userId = req.user.id;
  const { vehicle_plate } = req.body;

  console.log('开始使用停车位:', { spotId, userId, vehicle_plate });

  try {
    // 检查停车位是否可用
    const spot = await get("SELECT * FROM parking_spots WHERE id = ? AND status = 'available'", [spotId]);

      if (!spot) {
        console.log('停车位不可用:', spotId);
        return res.status(400).json({ 
        message: "停车位不可用或已被占用",
          code: 'SPOT_UNAVAILABLE'
        });
      }

      // 检查用户是否已经有正在使用的停车位
    const activeUsage = await get("SELECT * FROM parking_usage WHERE user_id = ? AND status = 'active'", [userId]);

          if (activeUsage) {
            console.log('用户已有正在使用的停车位:', activeUsage);
            return res.status(400).json({ 
        message: "您已有正在使用的停车位，请先结束当前的使用",
              code: 'ALREADY_IN_USE'
            });
          }

          // 开启事务
    await run("BEGIN TRANSACTION");

    // 创建使用记录
    const result = await run(
            `INSERT INTO parking_usage (
              parking_spot_id, 
              user_id, 
              start_time,
              vehicle_plate,
        status,
        lock_closure_status
      ) VALUES (?, ?, datetime('now', 'utc'), ?, 'active', ?)`,
      [spotId, userId, vehicle_plate, spot.lock_serial_number ? 'pending_open' : 'not_applicable']
    );
    const usageId = result.lastID;

              // 更新停车位状态
    await run(
                "UPDATE parking_spots SET status = 'occupied', current_user_id = ? WHERE id = ?",
      [userId, spotId]
    );

    // 如果有关联的地锁，则发送开锁指令
    if (spot.lock_serial_number) {
      console.log(`正在为停车位 ${spotId} 的地锁 ${spot.lock_serial_number} 发送开锁指令`);
      try {
        const lockResult = await parkingLockService.openLock(spot.lock_serial_number);
        if (!lockResult.success) {
          // 如果开锁失败，回滚所有操作
          throw new Error(lockResult.message || '开锁指令执行失败');
        }
        console.log(`地锁 ${spot.lock_serial_number} 开锁成功`);
      } catch (lockError) {
        console.error('开锁失败，回滚事务:', lockError);
        await run("ROLLBACK");
                    return res.status(500).json({ 
          message: `无法打开地锁: ${lockError.message}`,
          code: 'LOCK_OPEN_FAILED'
                    });
      }
                  }

    // 提交事务
    await run("COMMIT");

                  console.log('成功开始使用停车位:', { usageId, spotId });
                  res.json({ 
                    message: "开始使用停车位",
                    usage_id: usageId,
                    code: 'SUCCESS'
                  });

  } catch (error) {
    console.error('开始使用停车位时发生错误:', error);
    // 确保在任何错误发生时都回滚事务
    await run("ROLLBACK");
    res.status(500).json({ 
      message: error.message || "处理请求时发生内部错误",
      code: 'INTERNAL_ERROR'
    });
    }
});

// 结束使用停车位
router.post("/:spotId/end", authenticateToken, async (req, res) => {
  const { spotId } = req.params;
  const userId = req.user.id;

  console.log('请求结束使用停车位:', { spotId, userId });

  try {
    // 1. 获取使用记录和车位信息
    const usage = await get(
      `SELECT pu.*, ps.hourly_rate, ps.lock_serial_number 
     FROM parking_usage pu
     JOIN parking_spots ps ON pu.parking_spot_id = ps.id
       WHERE pu.parking_spot_id = ? AND pu.user_id = ? AND pu.status = 'active'`,
      [spotId, userId]
    );

      if (!usage) {
      return res.status(404).json({ message: "未找到有效的停车记录", code: 'USAGE_NOT_FOUND' });
      }

    await run("BEGIN TRANSACTION");

    // 2. 根据有无地锁执行不同逻辑
    if (usage.lock_serial_number) {
      // --- 有地锁的逻辑 ---
      
      // 2a. 检查地锁状态，确认车辆是否已离开
      console.log(`检查地锁 ${usage.lock_serial_number} 状态...`);
      const deviceStatus = await parkingLockService.getDeviceStatus(usage.lock_serial_number);

      // carStatus.code: 1=有车, 2=无车
      if (deviceStatus && deviceStatus.success && deviceStatus.carStatus && deviceStatus.carStatus.code === 2) {
        console.log(`车辆已离开，发送关锁指令...`);
        // 2b. 车辆已离开，发送关锁指令
        const closeResult = await parkingLockService.closeLock(usage.lock_serial_number);

        if (!closeResult || !closeResult.success) {
          throw new Error(closeResult.message || '关闭地锁的指令未能成功执行');
        }

        console.log(`地锁 ${usage.lock_serial_number} 已成功关闭。`);
        
      } else {
        // 2c. 车辆未离开或状态查询失败
        await run("ROLLBACK");
        const reason = deviceStatus?.carStatus?.code === 1
          ? "请先将车辆驶离车位后，再尝试结束停车"
          : "无法确认车辆状态，请稍后重试";
        const code = deviceStatus?.carStatus?.code === 1 ? 'CAR_DETECTED' : 'LOCK_STATUS_ERROR';
        return res.status(400).json({ message: reason, code });
      }
    }

    // --- 通用结束流程 (无地锁 或 有地锁且已成功关锁) ---
    // 3. 计算费用
    const calculation = await get(
      `SELECT (julianday('now', 'utc') - julianday(start_time)) * 24 * ? AS amount FROM parking_usage WHERE id = ?`,
      [usage.hourly_rate, usage.id]
    );
    const totalAmount = Math.max(0, Math.ceil(calculation.amount));

    // 4. 更新停车记录
    await run(
            `UPDATE parking_usage 
             SET end_time = datetime('now', 'utc'),
                 total_amount = ?,
                 status = 'completed',
           payment_status = 'unpaid',
           lock_closure_status = ?
             WHERE id = ?`,
      [totalAmount, usage.lock_serial_number ? 'completed' : 'not_applicable', usage.id]
    );

    // 5. 释放车位
      await run(
                "UPDATE parking_spots SET status = 'available', current_user_id = NULL WHERE id = ?",
        [spotId]
      );

    await run("COMMIT");

                  res.json({
      message: "停车已成功结束",
                    total_amount: totalAmount,
                    code: 'SUCCESS'
                  });

  } catch (error) {
    console.error('结束使用停车位时发生错误:', error);
    await run("ROLLBACK");
    res.status(500).json({ 
      message: error.message || "处理请求时发生内部错误",
      code: 'INTERNAL_ERROR'
    });
    }
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