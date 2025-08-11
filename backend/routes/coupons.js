const express = require('express');
const router = express.Router();
const { db } = require('../models/db');
const { authenticateToken } = require('../middleware/auth');


// 获取当前认证用户的所有优惠券和赠送余额
router.get('/user/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const coupons = await new Promise((resolve, reject) => {
      db().all(
        `SELECT * FROM coupons WHERE user_id = ? ORDER BY created_at DESC`,
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
    res.json(coupons);
  } catch (error) {
    console.error('获取优惠券和赠送余额失败:', error);
    res.status(500).json({ error: '获取优惠券和赠送余额失败' });
  }
});

// 获取指定用户的所有优惠券和赠送余额 (保留，可能用于管理端)
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const coupons = await new Promise((resolve, reject) => {
      db().all(
        `SELECT * FROM coupons WHERE user_id = ? ORDER BY created_at DESC`,
        [req.params.userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
    res.json(coupons);
  } catch (error) {
    console.error('获取优惠券和赠送余额失败:', error);
    res.status(500).json({ error: '获取优惠券和赠送余额失败' });
  }
});

// 为新用户创建默认优惠券
router.post('/create-default', async (req, res) => {
  const { userId } = req.body;

  try {
    // 设置优惠券一个月后过期
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 1);

    await new Promise((resolve, reject) => {
      db().run(
        `INSERT INTO coupons (user_id, amount, status, expiry_date, description) 
         VALUES (?, ?, ?, ?, ?)`,
        [userId, 10.0, 'valid', expiryDate.toISOString(), '新用户注册优惠券'],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    res.json({ message: '优惠券创建成功' });
  } catch (error) {
    console.error('创建优惠券失败:', error);
    res.status(500).json({ error: '创建优惠券失败' });
  }
});

module.exports = router; 