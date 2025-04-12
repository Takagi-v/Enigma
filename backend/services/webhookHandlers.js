const { db } = require('../models/db');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function handlePaymentIntentSucceeded(paymentIntent) {
  console.log('=================== 开始处理支付成功 ===================');
  console.log('PaymentIntent ID:', paymentIntent.id);
  console.log('元数据:', paymentIntent.metadata);

  // 确保这是充值类型的支付
  if (paymentIntent.metadata.type !== 'top_up') {
    console.log('非充值类型支付，跳过处理');
    return;
  }

  const userId = paymentIntent.metadata.userId;
  const amount = parseFloat(paymentIntent.metadata.amount);
  const isFirstTopUp = paymentIntent.metadata.isFirstTopUp === 'true';

  console.log(`处理用户 ${userId} 的充值：$${amount}`);
  console.log('是否首次充值:', isFirstTopUp);

  try {
    // 开启事务
    console.log('尝试开启事务...');
    await new Promise((resolve, reject) => {
      db().run("BEGIN TRANSACTION", err => {
        if (err) {
          console.error('开启事务失败:', err);
          reject(err);
        } else {
          console.log('事务开启成功');
          resolve();
        }
      });
    });

    try {
      // 1. 更新用户余额
      console.log(`准备更新用户 ${userId} 余额，增加 $${amount}`);
      await new Promise((resolve, reject) => {
        db().run(
          `UPDATE users 
           SET balance = balance + ?
           WHERE id = ?`,
          [amount, userId],
          function(err) {
            if (err) {
              console.error('更新用户余额失败:', err);
              reject(err);
            } else {
              console.log(`用户余额更新成功，影响行数: ${this.changes}`);
              resolve();
            }
          }
        );
      });

      // 2. 记录交易
      console.log('准备记录交易...');
      await new Promise((resolve, reject) => {
        db().run(
          `INSERT INTO transactions (
            user_id,
            type,
            amount,
            payment_intent_id,
            status,
            created_at
          ) VALUES (?, 'top_up', ?, ?, 'succeeded', DATETIME('now', 'utc'))`,
          [userId, amount, paymentIntent.id],
          function(err) {
            if (err) {
              console.error('记录交易失败:', err);
              console.error('错误详情:', err.message);
              reject(err);
            } else {
              console.log('交易记录成功，新记录ID:', this.lastID);
              resolve();
            }
          }
        );
      });

      // 3. 如果是首次充值，添加赠送余额记录
      if (isFirstTopUp) {
        const giftAmount = 10; 
        console.log(`首次充值，准备添加 $${giftAmount} 赠送余额记录`);
        await new Promise((resolve, reject) => {
          db().run(
            `INSERT INTO coupons (
              user_id,
              type,
              amount,
              description,
              status,
              created_at
            ) VALUES (?, 'gift_balance', ?, '首次充值赠送余额', 'valid', DATETIME('now', 'utc'))`,
            [userId, giftAmount],
            function(err) {
              if (err) {
                console.error('添加赠送余额记录失败:', err);
                reject(err);
              } else {
                console.log(`赠送余额记录添加成功，新记录ID: ${this.lastID}`);
                resolve();
              }
            }
          );
        });
      }

      // 提交事务
      console.log('准备提交事务...');
      await new Promise((resolve, reject) => {
        db().run("COMMIT", err => {
          if (err) {
            console.error('提交事务失败:', err);
            reject(err);
          } else {
            console.log('事务提交成功');
            resolve();
          }
        });
      });

      console.log(`用户 ${userId} 充值 $${amount} 处理完成`);
      console.log('=================== 处理支付成功结束 ===================');
    } catch (error) {
      // 回滚事务
      console.error('处理失败，执行回滚:', error);
      await new Promise((resolve) => {
        db().run("ROLLBACK", () => {
          console.log('事务已回滚');
          resolve();
        });
      });
      throw error;
    }
  } catch (error) {
    console.error('处理充值失败，完整错误:', error);
    throw error;
  }
}

async function handlePaymentIntentFailed(paymentIntent) {
  if (paymentIntent.metadata.type !== 'top_up') {
    return;
  }

  const userId = paymentIntent.metadata.userId;
  const amount = parseFloat(paymentIntent.metadata.amount);

  try {
    // 记录失败的交易
    await new Promise((resolve, reject) => {
      db().run(
        `INSERT INTO transactions (
          user_id,
          type,
          amount,
          payment_intent_id,
          status,
          error_message,
          created_at
        ) VALUES (?, 'top_up', ?, ?, 'failed', ?, DATETIME('now', 'utc'))`,
        [userId, amount, paymentIntent.id, paymentIntent.last_payment_error?.message],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    console.log(`用户 ${userId} 充值 $${amount} 失败:`, paymentIntent.last_payment_error?.message);
  } catch (error) {
    console.error('记录失败交易失败:', error);
    throw error;
  }
}

async function handlePaymentIntentCanceled(paymentIntent) {
  if (paymentIntent.metadata.type !== 'top_up') {
    return;
  }

  const userId = paymentIntent.metadata.userId;
  const amount = parseFloat(paymentIntent.metadata.amount);

  try {
    // 记录取消的交易
    await new Promise((resolve, reject) => {
      db().run(
        `INSERT INTO transactions (
          user_id,
          type,
          amount,
          payment_intent_id,
          status,
          created_at
        ) VALUES (?, 'top_up', ?, ?, 'canceled', DATETIME('now', 'utc'))`,
        [userId, amount, paymentIntent.id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    console.log(`用户 ${userId} 充值 $${amount} 已取消`);
  } catch (error) {
    console.error('记录取消交易失败:', error);
    throw error;
  }
}

// 处理退款
async function handleChargeRefunded(charge) {
  const paymentIntentId = charge.payment_intent;
  if (!paymentIntentId) return;

  try {
    // 获取支付意向以确认是否是充值交易
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.metadata.type !== 'top_up') return;

    const userId = paymentIntent.metadata.userId;
    const amount = parseFloat(paymentIntent.metadata.amount);

    // 开启事务
    await new Promise((resolve, reject) => {
      db().run("BEGIN TRANSACTION", err => {
        if (err) reject(err);
        else resolve();
      });
    });

    try {
      // 1. 扣减用户余额
      await new Promise((resolve, reject) => {
        db().run(
          `UPDATE users 
           SET balance = balance - ?
           WHERE id = ?`,
          [amount, userId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // 2. 记录退款交易
      await new Promise((resolve, reject) => {
        db().run(
          `INSERT INTO transactions (
            user_id,
            type,
            amount,
            payment_intent_id,
            status,
            created_at
          ) VALUES (?, 'refund', ?, ?, 'succeeded', DATETIME('now', 'utc'))`,
          [userId, amount, paymentIntentId],
          (err) => {
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

      console.log(`用户 ${userId} 充值 ${amount} 元已退款`);
    } catch (error) {
      // 回滚事务
      await new Promise((resolve) => {
        db().run("ROLLBACK", () => resolve());
      });
      throw error;
    }
  } catch (error) {
    console.error('处理退款事件失败:', error);
    throw error;
  }
}

// 处理争议创建
async function handleDisputeCreated(dispute) {
  const paymentIntentId = dispute.payment_intent;
  if (!paymentIntentId) return;

  try {
    // 获取支付意向以确认是否是充值交易
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.metadata.type !== 'top_up') return;

    const userId = paymentIntent.metadata.userId;
    const amount = parseFloat(paymentIntent.metadata.amount);

    // 记录争议
    await new Promise((resolve, reject) => {
      db().run(
        `INSERT INTO disputes (
          user_id,
          payment_intent_id,
          amount,
          status,
          reason,
          created_at
        ) VALUES (?, ?, ?, ?, ?, DATETIME('now', 'utc'))`,
        [userId, paymentIntentId, amount, dispute.status, dispute.reason],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    console.log(`用户 ${userId} 的充值交易 ${paymentIntentId} 产生争议`);
  } catch (error) {
    console.error('处理争议创建事件失败:', error);
    throw error;
  }
}

// 处理争议结束
async function handleDisputeClosed(dispute) {
  const paymentIntentId = dispute.payment_intent;
  if (!paymentIntentId) return;

  try {
    // 获取支付意向以确认是否是充值交易
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.metadata.type !== 'top_up') return;

    const userId = paymentIntent.metadata.userId;

    // 开启事务
    await new Promise((resolve, reject) => {
      db().run("BEGIN TRANSACTION", err => {
        if (err) reject(err);
        else resolve();
      });
    });

    try {
      // 更新争议状态
      await new Promise((resolve, reject) => {
        db().run(
          `UPDATE disputes 
           SET status = ?,
               resolved_at = DATETIME('now', 'utc')
           WHERE payment_intent_id = ?`,
          [dispute.status, paymentIntentId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // 如果争议失败（用户胜诉），需要扣减余额
      if (dispute.status === 'lost') {
        const amount = parseFloat(paymentIntent.metadata.amount);
        
        await new Promise((resolve, reject) => {
          db().run(
            `UPDATE users 
             SET balance = balance - ?
             WHERE id = ?`,
            [amount, userId],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        console.log(`用户 ${userId} 的充值交易 ${paymentIntentId} 争议失败，已扣减余额`);
      }

      // 提交事务
      await new Promise((resolve, reject) => {
        db().run("COMMIT", err => {
          if (err) reject(err);
          else resolve();
        });
      });
    } catch (error) {
      // 回滚事务
      await new Promise((resolve) => {
        db().run("ROLLBACK", () => resolve());
      });
      throw error;
    }
  } catch (error) {
    console.error('处理争议结束事件失败:', error);
    throw error;
  }
}

module.exports = {
  handlePaymentIntentSucceeded,
  handlePaymentIntentFailed,
  handlePaymentIntentCanceled,
  handleChargeRefunded,
  handleDisputeCreated,
  handleDisputeClosed
}; 