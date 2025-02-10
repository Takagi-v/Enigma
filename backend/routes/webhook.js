const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
const db = require('../models/db');

router.post('/', express.raw({type: 'application/json'}), (request, response) => {
  const sig = request.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
  } catch (err) {
    response.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      handleSucceededPaymentIntent(paymentIntent);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  response.send();
});

async function handleSucceededPaymentIntent(paymentIntent) {
  const parkingUsageId = paymentIntent.metadata.parking_usage_id;
  const amount = paymentIntent.amount;
  
  try {
    // 1. 找到对应的停车使用记录
    const usage = await db.parkingUsage.findOne({ 
      where: { id: parkingUsageId },
      include: { model: db.user }
    });

    if (!usage) {
      throw new Error(`找不到 ID 为 ${parkingUsageId} 的停车使用记录`);  
    }
    
    // 2. 更新用户账户余额
    await usage.user.increment('balance', { by: amount });
    
    // 3. 记录余额变动明细
    await db.balanceHistory.create({
      userId: usage.userId,
      type: 'topup',
      amount: amount,
      parkingUsageId: parkingUsageId
    });

    console.log(`已为用户 ${usage.userId} 充值 ${amount} 分,当前余额为 ${usage.user.balance} 分`);
  } catch (err) {
    console.error(`处理支付成功事件失败: ${err.message}`);
  }
}

module.exports = router; 