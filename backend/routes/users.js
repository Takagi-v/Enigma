const express = require('express');
const router = express.Router();
const { db } = require('../models/db');
const { authenticateToken, checkUserAccess } = require('../middleware/auth');

// JWT密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 获取用户信息
router.get("/:username", authenticateToken, checkUserAccess, (req, res) => {
  const { username } = req.params;

  db().get(
    `SELECT id, username, email, full_name, phone, avatar, bio, address, created_at
     FROM users 
     WHERE username = ?`,
    [username],
    (err, user) => {
      if (err) {
        console.error("获取用户信息失败:", err);
        return res.status(500).json({ 
          message: "获取用户信息失败",
          code: 'DB_ERROR'
        });
      }
      
      if (!user) {
        return res.status(404).json({ 
          message: "用户不存在",
          code: 'USER_NOT_FOUND'
        });
      }

      // 返回用户信息，但不包含密码
      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        avatar: user.avatar,
        bio: user.bio || '该用户很神秘',
        address: user.address,
        created_at: user.created_at
      });
    }
  );
});

// 更新用户信息
router.put("/:username", authenticateToken, checkUserAccess, (req, res) => {
  const { username } = req.params;
  const { full_name, phone, avatar, bio, address } = req.body;

  db().run(
    `UPDATE users 
     SET full_name = COALESCE(?, full_name),
         phone = COALESCE(?, phone),
         avatar = COALESCE(?, avatar),
         bio = COALESCE(?, bio),
         address = COALESCE(?, address)
     WHERE username = ?`,
    [full_name, phone, avatar, bio, address, username],
    function(err) {
      if (err) {
        console.error("更新用户信息失败:", err);
        return res.status(500).json({ 
          message: "更新用户信息失败",
          code: 'DB_ERROR'
        });
      }

      if (this.changes === 0) {
        return res.status(404).json({ 
          message: "用户不存在",
          code: 'USER_NOT_FOUND'
        });
      }

      res.json({ 
        message: "用户信息更新成功",
        code: 'SUCCESS'
      });
    }
  );
});

// 获取用户赠送余额
router.get('/:userId/gift-balance', async (req, res) => {
  try {
    const giftBalance = await new Promise((resolve, reject) => {
      db().get(
        `SELECT COALESCE(SUM(amount), 0) as gift_balance 
         FROM coupons 
         WHERE user_id = ? AND type = 'gift_balance' AND status = 'valid'`,
        [req.params.userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.gift_balance : 0);
        }
      );
    });
    res.json({ gift_balance: giftBalance });
  } catch (error) {
    console.error('获取赠送余额失败:', error);
    res.status(500).json({ error: '获取赠送余额失败' });
  }
});

module.exports = router; 