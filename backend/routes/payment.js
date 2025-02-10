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

// 创建 Setup Intent
router.post('/setup-intent', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  console.log(`开始为用户 ${userId} 创建 Setup Intent`);

  try {
    // 1. 检查用户是否已有 Stripe 客户 ID
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

    // 2. 如果用户没有 Stripe 客户 ID，创建新客户
    if (!existingCustomer?.stripe_customer_id) {
      console.log(`用户 ${userId} 无 Stripe 客户记录，创建新客户`);
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: req.user.fullName,
        phone: req.user.phone,
        metadata: {
          userId: userId
        }
      });
      stripeCustomerId = customer.id;

      // 保存客户 ID 到数据库
      await new Promise((resolve, reject) => {
        db().run(
          `INSERT INTO user_payment_methods (user_id, stripe_customer_id) 
           VALUES (?, ?)`,
          [userId, stripeCustomerId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    } else {
      stripeCustomerId = existingCustomer.stripe_customer_id;
    }

    // 3. 创建 Setup Intent
    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      usage: 'off_session', // 允许将来的离线支付
      metadata: {
        userId: userId
      }
    });

    console.log(`Setup Intent 创建成功 - 客户ID: ${stripeCustomerId}`);
    
    // 4. 返回客户端所需信息
    res.json({
      clientSecret: setupIntent.client_secret,
      customerId: stripeCustomerId
    });

  } catch (error) {
    console.error('Setup Intent 创建失败:', error);
    
    // 5. 错误处理
    let errorMessage = '创建支付设置失败';
    let statusCode = 500;

    if (error.type === 'StripeCardError') {
      errorMessage = '卡片验证失败';
      statusCode = 400;
    } else if (error.type === 'StripeInvalidRequestError') {
      errorMessage = '无效的请求参数';
      statusCode = 400;
    } else if (error.type === 'StripeAPIError') {
      errorMessage = 'Stripe服务暂时不可用';
      statusCode = 503;
    }

    res.status(statusCode).json({
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 保存支付方式
router.post('/save-method', authenticateToken, async (req, res) => {
  const { paymentMethodId } = req.body;
  const userId = req.user.id;

  try {
    // 创建或获取 Stripe 客户
    let customer;
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

    if (existingCustomer?.stripe_customer_id) {
      customer = await stripe.customers.retrieve(existingCustomer.stripe_customer_id);
    } else {
      customer = await stripe.customers.create();
    }

    // 将支付方式附加到客户
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customer.id,
    });

    // 设置为默认支付方式
    await stripe.customers.update(customer.id, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // 保存到数据库
    await new Promise((resolve, reject) => {
      db().run(
        `INSERT OR REPLACE INTO user_payment_methods 
         (user_id, stripe_customer_id, payment_method_id) 
         VALUES (?, ?, ?)`,
        [userId, customer.id, paymentMethodId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ message: '支付方式保存成功' });
  } catch (error) {
    console.error('保存支付方式失败:', error);
    res.status(500).json({ error: '保存支付方式失败' });
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

module.exports = router; 