const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { authenticateToken } = require('../middleware/auth');
const { db } = require('../models/db');

// 获取用户支付方式状态
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    db().get(
      'SELECT stripe_customer_id, payment_method_id FROM user_payment_methods WHERE user_id = ?',
      [userId],
      async (err, row) => {
        if (err) {
          console.error('数据库查询错误:', err);
          return res.status(500).json({ message: '获取支付方式状态失败' });
        }

        res.json({
          hasPaymentMethod: !!row?.payment_method_id,
          stripeCustomerId: row?.stripe_customer_id || null
        });
      }
    );
  } catch (error) {
    console.error('获取支付方式状态失败:', error);
    res.status(500).json({ message: '获取支付方式状态失败' });
  }
});

// 保存支付方式
router.post('/save-method', authenticateToken, async (req, res) => {
  const { paymentMethodId, paymentType } = req.body;
  const userId = req.user.id;

  try {
    // 1. 检查用户是否已有 Stripe 客户
    const existingCustomer = await new Promise((resolve, reject) => {
      db().get(
        'SELECT stripe_customer_id FROM user_payment_methods WHERE user_id = ?',
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    let stripeCustomerId;

    // 2. 如果用户没有 Stripe 客户，创建新客户
    if (!existingCustomer?.stripe_customer_id) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: req.user.fullName,
        phone: req.user.phone,
        metadata: {
          userId: userId
        }
      });
      stripeCustomerId = customer.id;
    } else {
      stripeCustomerId = existingCustomer.stripe_customer_id;
    }

    // 3. 将支付方式附加到客户
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: stripeCustomerId,
    });

    // 4. 设置为默认支付方式
    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // 5. 保存到数据库
    await new Promise((resolve, reject) => {
      db().run(
        `INSERT OR REPLACE INTO user_payment_methods 
         (user_id, stripe_customer_id, payment_method_id, payment_type) 
         VALUES (?, ?, ?, ?)`,
        [userId, stripeCustomerId, paymentMethodId, paymentType],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ 
      success: true,
      message: '支付方式保存成功',
      customerId: stripeCustomerId,
      paymentMethodId: paymentMethodId,
      paymentType: paymentType
    });
  } catch (error) {
    console.error('保存支付方式失败:', error);
    let errorMessage = '保存支付方式失败';
    let statusCode = 500;

    if (error.type === 'StripeCardError') {
      errorMessage = '卡片验证失败';
      statusCode = 400;
    } else if (error.type === 'StripeInvalidRequestError') {
      errorMessage = '无效的请求参数';
      statusCode = 400;
    }

    res.status(statusCode).json({ 
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 获取用户支付方式
router.get('/method', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // 从数据库获取用户的支付方式信息
    db().get(
      'SELECT stripe_customer_id, payment_method_id FROM user_payment_methods WHERE user_id = ?',
      [userId],
      async (err, row) => {
        if (err) {
          console.error('数据库查询错误:', err);
          return res.status(500).json({ message: '获取支付方式失败' });
        }

        if (!row?.payment_method_id) {
          return res.json({ paymentMethod: null });
        }

        try {
          // 从 Stripe 获取支付方式详细信息
          const paymentMethod = await stripe.paymentMethods.retrieve(
            row.payment_method_id
          );

          res.json({ paymentMethod });
        } catch (stripeError) {
          console.error('Stripe 获取支付方式失败:', stripeError);
          res.status(500).json({ message: '获取支付方式失败' });
        }
      }
    );
  } catch (error) {
    console.error('获取支付方式失败:', error);
    res.status(500).json({ message: '获取支付方式失败' });
  }
});

// 充值接口
router.post('/top-up', authenticateToken, async (req, res) => {
  const { amount, paymentMethodId } = req.body;
  const userId = req.user.id;

  if (!amount || amount <= 0) {
    return res.status(400).json({ 
      success: false,
      error: '无效的充值金额' 
    });
  }

  try {
    // 1. 获取用户的支付方式信息
    const userPayment = await new Promise((resolve, reject) => {
      db().get(
        'SELECT stripe_customer_id FROM user_payment_methods WHERE user_id = ? AND payment_method_id = ?',
        [userId, paymentMethodId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!userPayment?.stripe_customer_id) {
      return res.status(400).json({ 
        success: false,
        error: '未找到有效的支付方式' 
      });
    }

    // 2. 创建支付意向
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // 转换为美分
      currency: 'usd',
      customer: userPayment.stripe_customer_id,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      metadata: {
        userId: userId,
        type: 'top_up',
        amount: amount.toString()
      }
    });

    // 3. 返回支付意向ID
    res.json({
      success: true,
      message: '支付处理中',
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret
    });

  } catch (error) {
    console.error('创建支付意向失败:', error);
    let errorMessage = '支付失败';
    let statusCode = 500;

    if (error.type === 'StripeCardError') {
      errorMessage = '卡片支付失败';
      statusCode = 400;
    } else if (error.type === 'StripeInvalidRequestError') {
      errorMessage = '无效的支付请求';
      statusCode = 400;
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 处理 Stripe Webhook
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook 签名验证失败:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object);
        break;

      case 'payment_intent.canceled':
        await handlePaymentIntentCanceled(event.data.object);
        break;

      case 'charge.refunded':
        await handleChargeRefunded(event.data.object);
        break;

      case 'charge.dispute.created':
        await handleDisputeCreated(event.data.object);
        break;

      case 'charge.dispute.closed':
        await handleDisputeClosed(event.data.object);
        break;
    }
  } catch (error) {
    console.error('处理 webhook 事件失败:', error);
    // 记录错误但返回 200 以避免重试
  }

  res.json({ received: true });
});

// 处理支付成功
async function handlePaymentIntentSucceeded(paymentIntent) {
  // 确保这是充值类型的支付
  if (paymentIntent.metadata.type !== 'top_up') {
    return;
  }

  const userId = paymentIntent.metadata.userId;
  const amount = parseFloat(paymentIntent.metadata.amount);

  try {
    // 1. 更新用户余额
    await new Promise((resolve, reject) => {
      db().run(
        `UPDATE users 
         SET balance = balance + ?
         WHERE id = ?`,
        [amount, userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // 2. 记录交易
    await new Promise((resolve, reject) => {
      db().run(
        `INSERT INTO transactions (
          user_id,
          type,
          amount,
          payment_intent_id,
          status,
          created_at
        ) VALUES (?, 'top_up', ?, ?, 'succeeded', DATETIME('now'))`,
        [userId, amount, paymentIntent.id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    console.log(`User ${userId} topped up $${amount}`);
  } catch (error) {
    console.error('Top-up failed:', error);
    throw error;
  }
}

// 处理支付失败
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
        ) VALUES (?, 'top_up', ?, ?, 'failed', ?, DATETIME('now'))`,
        [userId, amount, paymentIntent.id, paymentIntent.last_payment_error?.message],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    console.log(`User ${userId} failed to top up $${amount}:`, paymentIntent.last_payment_error?.message);
  } catch (error) {
    console.error('Failed to handle payment failure:', error);
    throw error;
  }
}

// 处理支付取消
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
        ) VALUES (?, 'top_up', ?, ?, 'canceled', DATETIME('now'))`,
        [userId, amount, paymentIntent.id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    console.log(`用户 ${userId} 充值 ${amount} 元已取消`);
  } catch (error) {
    console.error('处理充值取消事件失败:', error);
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
        ) VALUES (?, 'refund', ?, ?, 'succeeded', DATETIME('now'))`,
        [userId, amount, paymentIntentId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    console.log(`用户 ${userId} 充值 ${amount} 元已退款`);
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
        ) VALUES (?, ?, ?, ?, ?, DATETIME('now'))`,
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

    // 更新争议状态
    await new Promise((resolve, reject) => {
      db().run(
        `UPDATE disputes 
         SET status = ?,
             resolved_at = DATETIME('now')
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
  } catch (error) {
    console.error('处理争议结束事件失败:', error);
    throw error;
  }
}

// 获取用户余额的辅助函数
async function getUserBalance(userId) {
  return new Promise((resolve, reject) => {
    db().get(
      'SELECT balance FROM users WHERE id = ?',
      [userId],
      (err, row) => {
        if (err) reject(err);
        else resolve(row?.balance || 0);
      }
    );
  });
}

module.exports = router; 