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

// 设置支付方式
router.post('/setup', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { payment_method_id } = req.body;

    if (!payment_method_id) {
      return res.status(400).json({ message: '支付方式ID不能为空' });
    }

    // 1. 检查用户是否已有 Stripe 客户 ID
    db().get(
      'SELECT stripe_customer_id FROM user_payment_methods WHERE user_id = ?',
      [userId],
      async (err, row) => {
        if (err) {
          console.error('数据库查询错误:', err);
          return res.status(500).json({ message: '设置支付方式失败' });
        }

        let stripeCustomerId = row?.stripe_customer_id;

        try {
          // 2. 如果用户没有 Stripe 客户 ID，创建新客户
          if (!stripeCustomerId) {
            const customer = await stripe.customers.create({
              email: req.user.email,
              name: req.user.fullName,
              phone: req.user.phone
            });
            stripeCustomerId = customer.id;
          }

          // 3. 获取支付方式信息
          const paymentMethod = await stripe.paymentMethods.retrieve(payment_method_id);

          // 4. 如果支付方式已经附加到其他客户，先分离
          if (paymentMethod.customer && paymentMethod.customer !== stripeCustomerId) {
            await stripe.paymentMethods.detach(payment_method_id);
          }

          // 5. 如果支付方式未附加到当前客户，则附加
          if (!paymentMethod.customer || paymentMethod.customer !== stripeCustomerId) {
            await stripe.paymentMethods.attach(payment_method_id, {
              customer: stripeCustomerId,
            });
          }

          // 6. 设置为默认支付方式
          await stripe.customers.update(stripeCustomerId, {
            invoice_settings: {
              default_payment_method: payment_method_id,
            },
          });

          // 7. 保存或更新支付方式信息
          db().run(
            `INSERT OR REPLACE INTO user_payment_methods 
             (user_id, stripe_customer_id, payment_method_id, created_at, updated_at)
             VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
            [userId, stripeCustomerId, payment_method_id],
            (err) => {
              if (err) {
                console.error('保存支付方式失败:', err);
                return res.status(500).json({ message: '保存支付方式失败' });
              }

              res.json({ message: '支付方式设置成功' });
            }
          );
        } catch (stripeError) {
          console.error('Stripe 操作失败:', stripeError);
          res.status(500).json({ message: stripeError.message });
        }
      }
    );
  } catch (error) {
    console.error('设置支付方式失败:', error);
    res.status(500).json({ message: '设置支付方式失败' });
  }
});

// 创建 Setup Intent
router.post('/setup-intent', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // 检查用户是否已有 Stripe 客户 ID
    const userPaymentMethod = await new Promise((resolve, reject) => {
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

    if (userPaymentMethod?.stripe_customer_id) {
      stripeCustomerId = userPaymentMethod.stripe_customer_id;
    } else {
      // 创建新的 Stripe 客户
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: req.user.fullName,
        phone: req.user.phone
      });
      stripeCustomerId = customer.id;
    }

    // 创建 Setup Intent
    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      usage: 'off_session', // 允许将来的离线支付
      metadata: {
        user_id: userId
      }
    });

    res.json({
      clientSecret: setupIntent.client_secret
    });
  } catch (error) {
    console.error('创建 Setup Intent 失败:', error);
    res.status(500).json({ message: '创建支付设置失败' });
  }
});

// 处理 Stripe Webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    // 处理不同类型的事件
    switch (event.type) {
      case 'setup_intent.succeeded':
        const setupIntent = event.data.object;
        // 处理成功设置的支付方式
        await handleSetupIntentSucceeded(setupIntent);
        break;
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        // 处理成功的支付
        await handleSuccessfulPayment(paymentIntent);
        break;
      case 'payment_method.attached':
        const paymentMethod = event.data.object;
        // 处理新添加的支付方式
        await handlePaymentMethodAttached(paymentMethod);
        break;
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook 错误:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

// 处理成功设置的支付方式
async function handleSetupIntentSucceeded(setupIntent) {
  const { customer, payment_method, metadata } = setupIntent;
  
  try {
    // 从元数据中获取用户ID
    const userId = metadata.user_id;
    
    if (!userId) {
      console.error('设置支付方式失败: 未找到用户ID');
      return;
    }

    // 保存或更新支付方式信息
    await new Promise((resolve, reject) => {
      db().run(
        `INSERT OR REPLACE INTO user_payment_methods 
         (user_id, stripe_customer_id, payment_method_id, created_at, updated_at)
         VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
        [userId, customer, payment_method],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    console.log(`成功保存用户 ${userId} 的支付方式`);
  } catch (error) {
    console.error('保存支付方式失败:', error);
  }
}

// 处理成功的支付
async function handleSuccessfulPayment(paymentIntent) {
  const { customer, metadata } = paymentIntent;
  if (metadata.usage_id) {
    db().run(
      'UPDATE parking_usage SET payment_status = ? WHERE id = ?',
      ['paid', metadata.usage_id],
      (err) => {
        if (err) {
          console.error('更新支付状态失败:', err);
        }
      }
    );
  }
}

// 处理新添加的支付方式
async function handlePaymentMethodAttached(paymentMethod) {
  const { customer } = paymentMethod;
  if (customer) {
    db().run(
      'UPDATE user_payment_methods SET updated_at = datetime("now") WHERE stripe_customer_id = ?',
      [customer],
      (err) => {
        if (err) {
          console.error('更新支付方式状态失败:', err);
        }
      }
    );
  }
}

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