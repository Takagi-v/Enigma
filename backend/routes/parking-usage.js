const express = require('express');
const router = express.Router();
const { db } = require('../models/db');
const { authenticateToken } = require('../middleware/auth');
const parkingLockService = require('../services/parkingLockService');

// 尝试自动为某条停车记录扣款（优惠券+余额）。
// 成功返回 true，失败或条件不满足（如余额不足）返回 false。
async function attemptAutoPayForUsage(usageId, userId) {
  console.log(`[AutoPay] 尝试自动扣款 usageId=${usageId}, userId=${userId}`);
  try {
    // 开启事务
    await new Promise((resolve, reject) => {
      db().run('BEGIN TRANSACTION', (err) => {
        if (err) reject(err); else resolve();
      });
    });

    // 获取停车记录
    const usage = await new Promise((resolve, reject) => {
      db().get(
        'SELECT * FROM parking_usage WHERE id = ? AND user_id = ?',
        [usageId, userId],
        (err, row) => {
          if (err) reject(err); else resolve(row);
        }
      );
    });

    if (!usage) {
      await new Promise((res) => db().run('ROLLBACK', () => res()));
      console.log('[AutoPay] 未找到停车记录，跳过');
      return false;
    }

    if (usage.payment_status === 'paid') {
      await new Promise((res) => db().run('ROLLBACK', () => res()));
      console.log('[AutoPay] 记录已支付，跳过');
      return true;
    }

    // 获取用户信息
    const user = await new Promise((resolve, reject) => {
      db().get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
        if (err) reject(err); else resolve(row);
      });
    });

    if (!user) {
      await new Promise((res) => db().run('ROLLBACK', () => res()));
      console.log('[AutoPay] 用户不存在，跳过');
      return false;
    }

    const totalAmount = usage.total_amount || 0;
    let remainingAmount = totalAmount;

    // 优惠券抵扣
    const coupons = await new Promise((resolve, reject) => {
      db().all(
        "SELECT * FROM coupons WHERE user_id = ? AND status = 'valid' AND (expiry_date IS NULL OR expiry_date > datetime('now', 'utc')) ORDER BY created_at",
        [userId],
        (err, rows) => {
          if (err) reject(err); else resolve(rows || []);
        }
      );
    });

    if (coupons.length > 0) {
      for (const coupon of coupons) {
        if (remainingAmount <= 0) break;
        const amountToUse = Math.min(remainingAmount, coupon.amount);
        remainingAmount -= amountToUse;
        await new Promise((resolve, reject) => {
          db().run(
            "UPDATE coupons SET status = 'used', used_at = datetime('now', 'utc') WHERE id = ?",
            [coupon.id],
            (err) => (err ? reject(err) : resolve())
          );
        });
      }
    }

    // 余额扣除（若仍有剩余）
    if (remainingAmount > 0) {
      if (user.balance < remainingAmount) {
        await new Promise((res) => db().run('ROLLBACK', () => res()));
        console.log('[AutoPay] 余额不足，自动扣款失败');
        return false;
      }

      const newUserBalance = user.balance - remainingAmount;
      await new Promise((resolve, reject) => {
        db().run(
          'UPDATE users SET balance = ? WHERE id = ?',
          [newUserBalance, userId],
          (err) => (err ? reject(err) : resolve())
        );
      });
    }

    // 支付成功，更新记录
    await new Promise((resolve, reject) => {
      db().run(
        "UPDATE parking_usage SET payment_status = 'paid', payment_method = 'balance_and_coupon', payment_time = datetime('now', 'utc') WHERE id = ?",
        [usageId],
        (err) => (err ? reject(err) : resolve())
      );
    });

    // 转账给车位主（仅转移从余额扣除的部分）
    const amountFromBalance = remainingAmount; // 剩余的即从余额扣除
    if (amountFromBalance > 0) {
      const spot = await new Promise((resolve, reject) => {
        db().get(
          'SELECT owner_username FROM parking_spots WHERE id = ?',
          [usage.parking_spot_id],
          (err, row) => (err ? reject(err) : resolve(row))
        );
      });
      if (spot && spot.owner_username) {
        await new Promise((resolve, reject) => {
          db().run(
            'UPDATE users SET balance = balance + ? WHERE username = ?',
            [amountFromBalance, spot.owner_username],
            (err) => (err ? reject(err) : resolve())
          );
        });

        // 记录车位主收入交易
        const owner = await new Promise((resolve, reject) => {
          db().get('SELECT id FROM users WHERE username = ?', [spot.owner_username], (err, row) => (err ? reject(err) : resolve(row)));
        });
        if (owner?.id) {
          await new Promise((resolve, reject) => {
            db().run(
              `INSERT INTO transactions (user_id, type, amount, status, created_at) VALUES (?, 'parking_income', ?, 'succeeded', DATETIME('now', 'utc'))`,
              [owner.id, amountFromBalance],
              (err) => (err ? reject(err) : resolve())
            );
          });
        }
      }
    }

    // 记录付款人扣费交易（如果确实从余额扣除了）
    if (amountFromBalance > 0) {
      await new Promise((resolve, reject) => {
        db().run(
          `INSERT INTO transactions (user_id, type, amount, status, created_at) VALUES (?, 'parking_payment', ?, 'succeeded', DATETIME('now', 'utc'))`,
          [userId, -amountFromBalance],
          (err) => (err ? reject(err) : resolve())
        );
      });
    }

    await new Promise((resolve, reject) => {
      db().run('COMMIT', (err) => (err ? reject(err) : resolve()));
    });
    console.log('[AutoPay] 自动扣款成功');
    return true;
  } catch (err) {
    console.error('[AutoPay] 自动扣款异常:', err);
    await new Promise((res) => db().run('ROLLBACK', () => res()));
    return false;
  }
}

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
router.post("/:spotId/start", authenticateToken, async (req, res) => {
  const { spotId } = req.params;
  const userId = req.user.id;
  const { vehicle_plate } = req.body;

  console.log('开始使用停车位:', { spotId, userId, vehicle_plate });

  try {
    // 检查停车位是否可用
    const spot = await new Promise((resolve, reject) => {
      db().get("SELECT * FROM parking_spots WHERE id = ? AND status = 'available'", [spotId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!spot) {
      console.log('停车位不可用:', spotId);
      return res.status(400).json({ 
        message: "停车位不可用或已被占用",
        code: 'SPOT_UNAVAILABLE'
      });
    }

    // 检查用户是否已经有正在使用的停车位
    const activeUsage = await new Promise((resolve, reject) => {
      db().get("SELECT * FROM parking_usage WHERE user_id = ? AND status = 'active'", [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (activeUsage) {
      console.log('用户已有正在使用的停车位:', activeUsage);
      return res.status(400).json({ 
        message: "您已有正在使用的停车位，请先结束当前的使用",
        code: 'ALREADY_IN_USE'
      });
    }

    // 开启事务
    await new Promise((resolve, reject) => {
      db().run("BEGIN TRANSACTION", (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    try {
      // 创建使用记录
      const result = await new Promise((resolve, reject) => {
        db().run(
          `INSERT INTO parking_usage (
            parking_spot_id, 
            user_id, 
            start_time,
            vehicle_plate,
            status,
            lock_open_status,
            lock_close_status
          ) VALUES (?, ?, datetime('now', 'utc'), ?, 'active', ?, ?)`,
          [spotId, userId, vehicle_plate, 
           spot.lock_serial_number ? 'pending' : 'not_applicable',
           spot.lock_serial_number ? 'pending' : 'not_applicable'],
          function (err) {
            if (err) reject(err);
            else resolve(this);
          }
        );
      });
      const usageId = result.lastID;

      // 更新停车位状态
      await new Promise((resolve, reject) => {
        db().run(
          "UPDATE parking_spots SET status = 'occupied', current_user_id = ? WHERE id = ?",
          [userId, spotId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // 如果有关联的地锁，则发送开锁指令
      if (spot.lock_serial_number) {
        console.log(`正在为停车位 ${spotId} 的地锁 ${spot.lock_serial_number} 发送开锁指令`);
        try {
          const lockResult = await parkingLockService.openLock(spot.lock_serial_number);
          if (lockResult && lockResult.success) {
            // 更新开锁状态为成功
            await new Promise((resolve, reject) => {
              db().run(
                "UPDATE parking_usage SET lock_open_status = 'success' WHERE id = ?",
                [usageId],
                (err) => {
                  if (err) reject(err);
                  else resolve();
                }
              );
            });
            console.log(`地锁 ${spot.lock_serial_number} 开锁成功`);
          } else {
            // 开锁失败，更新状态并记录错误信息
            await new Promise((resolve, reject) => {
              db().run(
                "UPDATE parking_usage SET lock_open_status = 'failed', lock_error_message = ? WHERE id = ?",
                [lockResult?.message || '开锁指令执行失败', usageId],
                (err) => {
                  if (err) reject(err);
                  else resolve();
                }
              );
            });
            // 开锁失败但不阻止停车，不回滚事务
            console.warn(`地锁 ${spot.lock_serial_number} 开锁失败: ${lockResult?.message || '未知错误'}`);
          }
        } catch (lockError) {
          console.error('开锁操作异常:', lockError);
          // 更新开锁状态为失败
          await new Promise((resolve, reject) => {
            db().run(
              "UPDATE parking_usage SET lock_open_status = 'failed', lock_error_message = ? WHERE id = ?",
              [lockError.message || '开锁服务异常', usageId],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
          // 开锁异常但不阻止停车，不回滚事务
          console.warn(`地锁 ${spot.lock_serial_number} 开锁异常但停车继续: ${lockError.message}`);
        }
      }

      // 提交事务
      await new Promise((resolve, reject) => {
        db().run("COMMIT", (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      console.log('成功开始使用停车位:', { usageId, spotId });
      res.json({ 
        message: "开始使用停车位",
        usage_id: usageId,
        code: 'SUCCESS'
      });

    } catch (innerError) {
      console.error('在事务中发生错误:', innerError);
      await new Promise((resolve, reject) => {
        db().run("ROLLBACK", (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      throw innerError; // 重新抛出错误，由外层catch块处理
    }
  } catch (error) {
    console.error('开始使用停车位时发生错误:', error);
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
    const usage = await new Promise((resolve, reject) => {
      db().get(
        `SELECT pu.*, ps.hourly_rate, ps.lock_serial_number 
         FROM parking_usage pu
         JOIN parking_spots ps ON pu.parking_spot_id = ps.id
         WHERE pu.parking_spot_id = ? AND pu.user_id = ? AND pu.status = 'active'`,
        [spotId, userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!usage) {
      return res.status(404).json({ message: "未找到有效的停车记录", code: 'USAGE_NOT_FOUND' });
    }

    await new Promise((resolve, reject) => {
      db().run("BEGIN TRANSACTION", (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    try {
      // 2. 根据有无地锁执行不同逻辑
      if (usage.lock_serial_number) {
        // --- 有地锁的逻辑 ---
        
        // 2a. 检查地锁状态，确认车辆是否已离开
        console.log(`检查地锁 ${usage.lock_serial_number} 状态...`);
        const deviceStatusResponse = await parkingLockService.getDeviceStatus(usage.lock_serial_number);
        const deviceStatus = deviceStatusResponse?.data || null;

        // carStatus.code: 1=有车, 2=无车
        if (deviceStatus && deviceStatusResponse.success && deviceStatus.carStatus && deviceStatus.carStatus.code === 2) {
          console.log(`车辆已离开，发送关锁指令...`);
          // 2b. 车辆已离开，发送关锁指令
          try {
            const closeResult = await parkingLockService.closeLock(usage.lock_serial_number);

            if (closeResult && closeResult.success) {
              console.log(`地锁 ${usage.lock_serial_number} 已成功关闭。`);
              // 更新关锁状态
              await new Promise((resolve, reject) => {
                db().run(
                  "UPDATE parking_usage SET lock_close_status = 'success' WHERE id = ?",
                  [usage.id],
                  (err) => {
                    if (err) reject(err);
                    else resolve();
                  }
                );
              });
            } else {
              throw new Error(closeResult?.message || '关闭地锁的指令未能成功执行');
            }
          } catch (closeError) {
            console.error(`关锁操作失败: ${closeError.message}`);
            // 更新关锁状态为失败
            await new Promise((resolve, reject) => {
              db().run(
                "UPDATE parking_usage SET lock_close_status = 'failed', lock_error_message = ? WHERE id = ?",
                [closeError.message, usage.id],
                (err) => {
                  if (err) reject(err);
                  else resolve();
                }
              );
            });
            throw closeError; // 继续抛出错误，阻止停车结束
          }
          
        } else {
          // 2c. 车辆未离开或状态查询失败
          await new Promise((resolve, reject) => {
            db().run("ROLLBACK", (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
          const reason = deviceStatus?.carStatus?.code === 1
            ? "请先将车辆驶离车位后，再尝试结束停车"
            : "无法确认车辆状态，请稍后重试";
          const code = deviceStatus?.carStatus?.code === 1 ? 'CAR_DETECTED' : 'LOCK_STATUS_ERROR';
          return res.status(400).json({ message: reason, code });
        }
      }

      // --- 通用结束流程 (无地锁 或 有地锁且已成功关锁) ---
      // 3. 计算费用（按小时向上取整计费，最低1小时）
      const calculation = await new Promise((resolve, reject) => {
        db().get(
          `SELECT (julianday('now', 'utc') - julianday(start_time)) * 24 AS hours FROM parking_usage WHERE id = ?`,
          [usage.id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
      const rawHours = Math.max(0, calculation?.hours || 0);
      const billedHours = Math.max(1, Math.ceil(rawHours));
      const totalAmount = billedHours * usage.hourly_rate;

      // 4. 更新停车记录
      await new Promise((resolve, reject) => {
        db().run(
          `UPDATE parking_usage 
           SET end_time = datetime('now', 'utc'),
               total_amount = ?,
               status = 'completed',
               payment_status = 'unpaid',
               lock_close_status = CASE 
                 WHEN lock_close_status = 'pending' THEN 'success'
                 ELSE lock_close_status
               END
           WHERE id = ?`,
          [totalAmount, usage.id],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // 5. 更新车位状态
      await new Promise((resolve, reject) => {
        db().run(
          "UPDATE parking_spots SET status = 'available', current_user_id = NULL WHERE id = ?",
          [spotId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // 6. 提交事务
      await new Promise((resolve, reject) => {
        db().run("COMMIT", (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // 检查是否有地锁错误需要通知用户
      const finalUsage = await new Promise((resolve, reject) => {
        db().get(
          'SELECT lock_open_status, lock_close_status, lock_error_message FROM parking_usage WHERE id = ?',
          [usage.id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      let lockWarning = '';
      if (finalUsage.lock_open_status === 'failed' || finalUsage.lock_close_status === 'failed') {
        lockWarning = `\n注意: 地锁操作失败 - ${finalUsage.lock_error_message || '未知错误'}`;
      }
      
      console.log('成功结束使用停车位:', { usage_id: usage.id, totalAmount, lockStatus: { open: finalUsage.lock_open_status, close: finalUsage.lock_close_status } });
      // 尝试后台自动扣款（不阻塞响应）
      try {
        setImmediate(() => {
          attemptAutoPayForUsage(usage.id, userId)
            .then((ok) => console.log('[AutoPay] 结束后自动扣款结果:', ok))
            .catch((e) => console.error('[AutoPay] 结束后自动扣款异常:', e));
        });
      } catch (autoErr) {
        console.error('[AutoPay] 调度自动扣款失败:', autoErr);
      }

      res.json({
        message: "已结束使用，请支付费用" + lockWarning,
        usage_id: usage.id,
        total_amount: totalAmount,
        code: 'SUCCESS',
        lock_status: {
          open_status: finalUsage.lock_open_status,
          close_status: finalUsage.lock_close_status,
          error_message: finalUsage.lock_error_message
        }
      });

    } catch (innerError) {
      console.error('在事务中发生错误:', innerError);
      await new Promise((resolve, reject) => {
        db().run("ROLLBACK", (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      throw innerError;
    }
  } catch (error) {
    console.error('结束使用停车位时发生错误:', error);
    res.status(500).json({ 
      message: error.message || "处理请求时发生内部错误",
      code: 'INTERNAL_ERROR'
    });
  }
});

// 获取用户所有停车记录
router.get("/", authenticateToken, (req, res) => {
  const userId = req.user.id;

  const query = `
    SELECT pu.*, ps.location 
    FROM parking_usage pu
    JOIN parking_spots ps ON pu.parking_spot_id = ps.id
    WHERE pu.user_id = ?
    ORDER BY pu.start_time DESC
  `;

  db().all(query, [userId], (err, records) => {
    if (err) {
      console.error('获取用户停车记录失败:', err);
      return res.status(500).json({ message: "获取停车记录失败" });
    }
    res.json(records);
  });
});

// 获取单条停车记录详情
router.get("/:usageId", authenticateToken, (req, res) => {
  const { usageId } = req.params;
  const userId = req.user.id;

  const query = `
    SELECT 
      pu.*, 
      ps.location, 
      ps.hourly_rate,
      ps.coordinates,
      ps.owner_username
    FROM parking_usage pu
    JOIN parking_spots ps ON pu.parking_spot_id = ps.id
    WHERE pu.id = ?
  `;

  db().get(query, [usageId], (err, record) => {
    if (err) {
      console.error('获取停车记录详情失败:', err);
      return res.status(500).json({ message: "获取停车记录详情失败", code: 'DB_ERROR' });
    }
    if (!record) {
      return res.status(404).json({ message: "未找到停车记录或无权访问", code: 'NOT_FOUND' });
    }

    // 授权校验：租用者或车位所有者均可看详情
    const isRenter = record.user_id === userId;
    const isOwner = record.owner_username && req.user && req.user.username && (record.owner_username === req.user.username);
    if (!isRenter && !isOwner) {
      return res.status(404).json({ message: "未找到停车记录或无权访问", code: 'NOT_FOUND' });
    }

    // 返回结构中补充移动端需要的 parking_spot.coordinates
    const response = {
      ...record,
      parking_spot: {
        coordinates: record.coordinates || null,
      }
    };
    res.json(response);
  });
});

// 为停车记录付款
router.post("/:usageId/pay", authenticateToken, async (req, res) => {
  const { usageId } = req.params;
  const userId = req.user.id;

  console.log(`用户 ${userId} 尝试支付停车记录 ${usageId}`);

  try {
    await new Promise((resolve, reject) => {
      db().run("BEGIN TRANSACTION", err => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 1. 获取停车记录和用户信息
    const usage = await new Promise((resolve, reject) => {
      db().get("SELECT * FROM parking_usage WHERE id = ? AND user_id = ?", [usageId, userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!usage) {
      await new Promise(res => db().run("ROLLBACK", () => res()));
      return res.status(404).json({ message: "停车记录不存在", code: 'USAGE_NOT_FOUND' });
    }

    if (usage.payment_status === 'paid') {
      await new Promise(res => db().run("ROLLBACK", () => res()));
      return res.status(400).json({ message: "该账单已支付", code: 'ALREADY_PAID' });
    }

    const user = await new Promise((resolve, reject) => {
      db().get("SELECT * FROM users WHERE id = ?", [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      await new Promise(res => db().run("ROLLBACK", () => res()));
      return res.status(404).json({ message: "用户不存在", code: 'USER_NOT_FOUND' });
    }

    const totalAmount = usage.total_amount;
    let remainingAmount = totalAmount;
    console.log(`需要支付金额: ${totalAmount}, 用户余额: ${user.balance}`);

    // 2. 检查并使用优惠券
    const coupons = await new Promise((resolve, reject) => {
      db().all(
        "SELECT * FROM coupons WHERE user_id = ? AND status = 'valid' AND (expiry_date IS NULL OR expiry_date > datetime('now', 'utc')) ORDER BY created_at",
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    if (coupons.length > 0) {
      console.log(`用户 ${userId} 有 ${coupons.length} 张可用优惠券`);
      for (const coupon of coupons) {
        if (remainingAmount <= 0) break;

        const couponValue = coupon.amount;
        const amountToUse = Math.min(remainingAmount, couponValue);
        
        console.log(`使用优惠券 #${coupon.id} (面值 ${couponValue}), 抵扣 ${amountToUse}`);

        remainingAmount -= amountToUse;

        // 更新优惠券状态
        // 这里简化处理：无论是普通券还是赠送余额，都视为一次性使用
        await new Promise((resolve, reject) => {
          db().run(
            "UPDATE coupons SET status = 'used', used_at = datetime('now', 'utc') WHERE id = ?",
            [coupon.id],
            err => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }
    }

    console.log(`优惠券抵扣后，剩余待付金额: ${remainingAmount}`);

    // 3. 如果优惠券不够，检查并扣除用户主余额
    if (remainingAmount > 0) {
      if (user.balance < remainingAmount) {
        await new Promise(res => db().run("ROLLBACK", () => res()));
        return res.status(400).json({ 
          message: `余额不足，还需支付 $${remainingAmount.toFixed(2)}，请充值`, 
          code: 'INSUFFICIENT_FUNDS' 
        });
      }

      const newUserBalance = user.balance - remainingAmount;
      console.log(`从主账户扣除 ${remainingAmount}，新余额: ${newUserBalance}`);
      await new Promise((resolve, reject) => {
        db().run("UPDATE users SET balance = ? WHERE id = ?", [newUserBalance, userId], err => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    // 4. 更新停车记录支付状态
    await new Promise((resolve, reject) => {
      db().run(
        "UPDATE parking_usage SET payment_status = 'paid', payment_method = 'balance_and_coupon', payment_time = datetime('now', 'utc') WHERE id = ?",
        [usageId],
        err => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // 5. 将费用转给车位所有者 (只转移最终从用户余额扣除的部分)
    const amountToTransfer = remainingAmount; // 即从余额实际扣除的金额
    if (amountToTransfer > 0) {
      const spot = await new Promise((resolve, reject) => {
        db().get(
          'SELECT owner_username FROM parking_spots WHERE id = ?',
          [usage.parking_spot_id],
          (err, row) => {
            if (err) reject(err); else resolve(row);
          }
        );
      });

      if (spot && spot.owner_username) {
        await new Promise((resolve, reject) => {
          db().run(
            "UPDATE users SET balance = balance + ? WHERE username = ?",
            [amountToTransfer, spot.owner_username],
            err => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
        console.log(`已将 ${amountToTransfer} 转入车位主 ${spot.owner_username} 的账户`);

        // 记录车位主收入交易
        const owner = await new Promise((resolve, reject) => {
          db().get('SELECT id FROM users WHERE username = ?', [spot.owner_username], (err, row) => (err ? reject(err) : resolve(row)));
        });
        if (owner?.id) {
          await new Promise((resolve, reject) => {
            db().run(
              `INSERT INTO transactions (user_id, type, amount, status, created_at) VALUES (?, 'parking_income', ?, 'succeeded', DATETIME('now', 'utc'))`,
              [owner.id, amountToTransfer],
              (err) => (err ? reject(err) : resolve())
            );
          });
        }
      }
    }

    // 记录付款人扣费交易（如果确实从余额扣除了）
    if (amountToTransfer > 0) {
      await new Promise((resolve, reject) => {
        db().run(
          `INSERT INTO transactions (user_id, type, amount, status, created_at) VALUES (?, 'parking_payment', ?, 'succeeded', DATETIME('now', 'utc'))`,
          [userId, -amountToTransfer],
          (err) => (err ? reject(err) : resolve())
        );
      });
    }

    await new Promise((resolve, reject) => {
      db().run("COMMIT", err => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ message: "支付成功", code: 'SUCCESS' });
    console.log(`停车记录 ${usageId} 支付成功`);

  } catch (error) {
    console.error('支付失败:', error);
    await new Promise(res => db().run("ROLLBACK", () => res()));
    res.status(500).json({ message: "支付处理失败", code: 'PAYMENT_FAILED' });
  }
});

module.exports = router;