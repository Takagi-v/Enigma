const express = require('express');
const router = express.Router();

// 环境检查
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLIC_KEY;

// 详细的环境检查
if (!STRIPE_SECRET_KEY) {
  throw new Error('未配置 STRIPE_SECRET_KEY 环境变量');
}

if (!STRIPE_PUBLISHABLE_KEY) {
  throw new Error('未配置 STRIPE_PUBLISHABLE_KEY 环境变量');
}

// 检查是否为生产环境
const isProduction = process.env.NODE_ENV === 'production';
console.log('当前环境:', isProduction ? 'production' : 'development');
console.log('Stripe密钥类型:', STRIPE_SECRET_KEY.startsWith('sk_test_') ? 'test' : 'live');


const stripe = require('stripe')(STRIPE_SECRET_KEY);
const { authenticateToken } = require('../middleware/auth');
const { db } = require('../models/db');

// 添加详细的调试日志
stripe.on('request', function(request) {
  console.log('Stripe API 请求:', {
    method: request.method,
    path: request.path,
    headers: request.headers
  });
});

// 处理预检请求
router.options('/status', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'https://www.goparkme.com');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).send();
});

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

// 获取用户赠送余额状态
router.get('/gift-status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // 检查用户是否已经获得过赠送余额
    const hasReceivedGift = await new Promise((resolve, reject) => {
      db().get(
        `SELECT COUNT(*) as count FROM coupons 
         WHERE user_id = ? AND type = 'gift_balance' AND description = '首次充值赠送余额'`,
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row?.count > 0);
        }
      );
    });

    // 获取用户的充值交易记录
    const transactions = await new Promise((resolve, reject) => {
      db().all(
        `SELECT * FROM transactions 
         WHERE user_id = ? AND type = 'top_up' AND status = 'succeeded'
         ORDER BY created_at DESC LIMIT 10`,
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    res.json({
      hasReceivedGift,
      transactions
    });
  } catch (error) {
    console.error('获取赠送余额状态失败:', error);
    res.status(500).json({ message: '获取赠送余额状态失败' });
  }
});

// 保存支付方式
router.post('/save-method', authenticateToken, async (req, res) => {
  const { paymentMethodId, paymentType } = req.body;
  const userId = req.user.id;

  console.log('开始处理保存支付方式请求:', {
    userId,
    paymentMethodId,
    paymentType,
    environment: isProduction ? 'production' : 'development'
  });

  try {
    // 1. 验证支付方式是否存在
    let paymentMethod;
    try {
      console.log('正在验证支付方式:', paymentMethodId);
      paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
      console.log('支付方式验证结果:', {
        type: paymentMethod.type,
        status: paymentMethod.status,
        card: paymentMethod.card ? {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4
        } : null
      });
      
      // 检查支付方式类型
      if (paymentType === 'card' && paymentMethod.type !== 'card') {
        console.error('支付方式类型不匹配:', {
          expected: 'card',
          actual: paymentMethod.type
        });
        return res.status(400).json({
          success: false,
          error: '支付方式类型不匹配'
        });
      }
      
      // 检查支付方式状态
      if (paymentMethod.status === 'failed' || paymentMethod.status === 'canceled') {
        console.error('支付方式状态无效:', paymentMethod.status);
        return res.status(400).json({
          success: false,
          error: '支付方式状态无效'
        });
      }
    } catch (error) {
      console.error('验证支付方式失败:', {
        error: error.message,
        type: error.type,
        code: error.code,
        decline_code: error.decline_code
      });
      return res.status(400).json({
        success: false,
        error: isProduction ? '无效的支付方式ID' : `支付方式验证失败: ${error.message}`,
        details: !isProduction ? {
          type: error.type,
          code: error.code,
          decline_code: error.decline_code
        } : undefined
      });
    }

    // 2. 检查用户是否已有 Stripe 客户
    console.log('正在检查用户的 Stripe 客户信息');
    const existingCustomer = await new Promise((resolve, reject) => {
      db().get(
        'SELECT stripe_customer_id FROM user_payment_methods WHERE user_id = ?',
        [userId],
        (err, row) => {
          if (err) {
            console.error('查询用户 Stripe 客户失败:', err);
            reject(err);
          } else {
            console.log('查询结果:', row);
            resolve(row);
          }
        }
      );
    });

    let stripeCustomerId;

    // 3. 如果用户没有 Stripe 客户，创建新客户
    if (!existingCustomer?.stripe_customer_id) {
      console.log('创建新的 Stripe 客户');
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: req.user.fullName,
        phone: req.user.phone,
        metadata: {
          userId: userId
        }
      });
      console.log('新客户创建成功:', customer.id);
      stripeCustomerId = customer.id;
    } else {
      console.log('使用现有客户:', existingCustomer.stripe_customer_id);
      stripeCustomerId = existingCustomer.stripe_customer_id;
    }

    // 4. 将支付方式附加到客户
    console.log('正在将支付方式附加到客户');
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: stripeCustomerId,
    });
    console.log('支付方式附加成功');

    // 5. 设置为默认支付方式
    console.log('正在设置默认支付方式');
    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
    console.log('默认支付方式设置成功');

    // 6. 保存到数据库
    console.log('正在保存支付方式到数据库');
    await new Promise((resolve, reject) => {
      db().run(
        `INSERT OR REPLACE INTO user_payment_methods 
         (user_id, stripe_customer_id, payment_method_id, payment_type) 
         VALUES (?, ?, ?, ?)`,
        [userId, stripeCustomerId, paymentMethodId, paymentType],
        (err) => {
          if (err) {
            console.error('保存到数据库失败:', err);
            reject(err);
          } else {
            console.log('保存到数据库成功');
            resolve();
          }
        }
      );
    });

    console.log('支付方式保存流程完成');
    res.json({ 
      success: true,
      message: '支付方式保存成功',
      customerId: stripeCustomerId,
      paymentMethodId: paymentMethodId,
      paymentType: paymentType
    });
  } catch (error) {
    console.error('保存支付方式失败:', {
      error: error.message,
      type: error.type,
      code: error.code,
      stack: error.stack
    });
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
      details: !isProduction ? {
        message: error.message,
        type: error.type,
        code: error.code
      } : undefined
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
  const { amount, paymentMethodId, isFirstTopUp } = req.body;
  const userId = req.user.id;

  if (!amount || amount <= 0) {
    return res.status(400).json({ 
      success: false,
      error: '无效的充值金额' 
    });
  }

  // 检查最低充值金额
  if (isFirstTopUp && amount < 10) {
    return res.status(400).json({
      success: false,
      error: '首次充值金额不能低于$10'
    });
  } else if (!isFirstTopUp && amount < 20) {
    return res.status(400).json({
      success: false,
      error: '充值金额不能低于$20'
    });
  }

  try {
    // 检查用户是否已经获得过赠送余额
    const hasReceivedGift = await new Promise((resolve, reject) => {
      db().get(
        `SELECT COUNT(*) as count FROM coupons 
         WHERE user_id = ? AND type = 'gift_balance' AND description = '首次充值赠送余额'`,
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row?.count > 0);
        }
      );
    });

    // 如果前端传递的isFirstTopUp与数据库不一致，返回错误
    if (isFirstTopUp && hasReceivedGift) {
      return res.status(400).json({
        success: false,
        error: '您已经获得过赠送余额'
      });
    }

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
      description: 'GoParkMe停车服务充值',
      statement_descriptor: 'GOPARKME',
      statement_descriptor_suffix: 'PARK',
      metadata: {
        userId: userId,
        type: 'top_up',
        amount: amount.toString(),
        isFirstTopUp: isFirstTopUp ? 'true' : 'false'
      }
    });

    // 3. 返回支付意向ID和客户端密钥
    res.json({
      success: true,
      message: '请完成支付验证',
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
    // 添加调试日志
    console.log('Webhook 请求头:', {
      'stripe-signature': sig,
      'content-type': req.headers['content-type']
    });
    console.log('Webhook Secret:', process.env.STRIPE_WEBHOOK_SECRET);
    
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    
    console.log('Webhook 事件解析成功:', {
      type: event.type,
      id: event.id
    });
  } catch (err) {
    console.error('Webhook 签名验证失败:', {
      error: err.message,
      signature: sig,
      secret: process.env.STRIPE_WEBHOOK_SECRET?.substring(0, 10) + '...'
    });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // 导入webhook处理器
    const {
      handlePaymentIntentSucceeded,
      handlePaymentIntentFailed,
      handlePaymentIntentCanceled,
      handleChargeRefunded,
      handleDisputeCreated,
      handleDisputeClosed
    } = require('../services/webhookHandlers');

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

// 获取支付状态
router.get('/status/:paymentIntentId', authenticateToken, async (req, res) => {
  try {
    const { paymentIntentId } = req.params;
    
    // 从数据库查询交易状态
    const transaction = await new Promise((resolve, reject) => {
      db().get(
        'SELECT status, error_message FROM transactions WHERE payment_intent_id = ?',
        [paymentIntentId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (transaction) {
      res.json({
        status: transaction.status,
        error: transaction.error_message
      });
    } else {
      // 如果数据库中没有记录，从Stripe获取状态
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      res.json({
        status: paymentIntent.status,
        error: paymentIntent.last_payment_error?.message
      });
    }
  } catch (error) {
    console.error('获取支付状态失败:', error);
    res.status(500).json({ 
      status: 'error',
      error: '获取支付状态失败'
    });
  }
});

// 获取用户充值记录
router.get('/transactions', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  console.log(`获取用户 ${userId} 的充值记录`);

  try {
    // 获取用户的充值交易记录
    const transactions = await new Promise((resolve, reject) => {
      console.log('执行数据库查询...');
      db().all(
        `SELECT * FROM transactions 
         WHERE user_id = ? AND type = 'top_up'
         ORDER BY created_at DESC`,
        [userId],
        (err, rows) => {
          if (err) {
            console.error('查询交易记录失败:', err);
            reject(err);
          } else {
            console.log(`查询到 ${rows?.length || 0} 条交易记录`);
            if (rows?.length > 0) {
              console.log('最新的交易记录:', rows[0]);
            }
            resolve(rows || []);
          }
        }
      );
    });

    // 检查数据库中的表结构
    db().all(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='transactions'",
      [],
      (err, rows) => {
        if (err) {
          console.error('获取表结构失败:', err);
        } else {
          console.log('transactions 表结构:', rows);
        }
      }
    );

    res.json(transactions);
  } catch (error) {
    console.error('获取充值记录失败:', error);
    res.status(500).json({ message: '获取充值记录失败' });
  }
});

module.exports = router; 