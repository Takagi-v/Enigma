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
    `SELECT id, username, email, full_name, phone, bio, address, created_at, balance, vehicle_plate
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
        bio: user.bio || '该用户很神秘',
        address: user.address,
        created_at: user.created_at,
        balance: user.balance || 0,
        vehicle_plate: user.vehicle_plate
      });
    }
  );
});

// 更新用户信息
router.put("/:username", authenticateToken, checkUserAccess, (req, res) => {
  const { username } = req.params;
  const { full_name, phone, bio, address } = req.body;

  // 验证请求数据
  if (!full_name && !phone && !bio && !address) {
    return res.status(400).json({
      message: "请提供至少一个要更新的字段",
      code: 'INVALID_REQUEST'
    });
  }

  // 验证电话号码格式（如果提供）
  if (phone) {
    const phoneRegex = /^(\+?1)?[- ()]*([2-9][0-9]{2})[- )]*([2-9][0-9]{2})[- ]*([0-9]{4})$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        message: "无效的电话号码格式",
        code: 'INVALID_PHONE'
      });
    }

    // 标准化手机号格式
    const digits = phone.replace(/\D/g, '');
    const standardizedPhone = digits.startsWith('1') && digits.length > 10 ? digits.substring(1) : digits;
    
    // 检查电话号码是否已被其他用户使用
    db().get(
      "SELECT username FROM users WHERE phone = ? AND username != ?",
      [standardizedPhone, username],
      (err, existingUser) => {
        if (err) {
          console.error("检查电话号码失败:", err);
          return res.status(500).json({
            message: "更新用户信息失败",
            code: 'DB_ERROR'
          });
        }

        if (existingUser) {
          return res.status(409).json({
            message: "该电话号码已被其他用户使用",
            code: 'PHONE_ALREADY_EXISTS'
          });
        }

        // 电话号码验证通过，继续更新用户信息
        updateUserInfo(username, full_name, phone, bio, address, res);
      }
    );
  } else {
    // 如果没有提供电话号码，直接更新用户信息
    updateUserInfo(username, full_name, phone, bio, address, res);
  }
});

// 辅助函数：更新用户信息
function updateUserInfo(username, full_name, phone, bio, address, res) {
  // 构建更新语句
  let updateFields = [];
  let params = [];

  if (full_name !== undefined) {
    updateFields.push("full_name = ?");
    params.push(full_name);
  }

  if (phone !== undefined) {
    // 标准化手机号格式
    const digits = phone.replace(/\D/g, '');
    const standardizedPhone = digits.startsWith('1') && digits.length > 10 ? digits.substring(1) : digits;
    
    updateFields.push("phone = ?");
    params.push(standardizedPhone);
  }

  if (bio !== undefined) {
    updateFields.push("bio = ?");
    params.push(bio);
  }

  if (address !== undefined) {
    updateFields.push("address = ?");
    params.push(address);
  }

  // 添加用户名作为查询条件
  params.push(username);

  // 执行更新
  db().run(
    `UPDATE users SET ${updateFields.join(", ")} WHERE username = ?`,
    params,
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

      // 获取更新后的用户信息
      db().get(
        `SELECT id, username, email, full_name, phone, bio, address, created_at, balance, vehicle_plate
         FROM users 
         WHERE username = ?`,
        [username],
        (err, user) => {
          if (err) {
            console.error("获取更新后的用户信息失败:", err);
            return res.status(200).json({ 
              message: "用户信息更新成功，但获取更新后的信息失败",
              code: 'UPDATE_SUCCESS_GET_FAILED'
            });
          }

          res.json({ 
            message: "用户信息更新成功",
            code: 'SUCCESS',
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              full_name: user.full_name,
              phone: user.phone,
              bio: user.bio || '该用户很神秘',
              address: user.address,
              created_at: user.created_at,
              balance: user.balance || 0,
              vehicle_plate: user.vehicle_plate
            }
          });
        }
      );
    }
  );
}

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

// 获取用户的预约列表
router.get('/:userId/reservations', authenticateToken, async (req, res) => {
  try {
    // 验证用户是否有权限访问
    if (req.user.id !== parseInt(req.params.userId) && !req.user.isAdmin) {
      return res.status(403).json({ error: '无权访问该用户的预约记录' });
    }

    const reservations = await new Promise((resolve, reject) => {
      db().all(
        `SELECT 
           r.*,
           p.location,
           p.price,
           p.hourly_rate
         FROM reservations r
         JOIN parking_spots p ON r.parking_spot_id = p.id
         WHERE r.user_id = ?
         ORDER BY r.reservation_date DESC, r.start_time DESC`,
        [req.params.userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json(reservations);
  } catch (error) {
    console.error('获取用户预约列表失败:', error);
    res.status(500).json({ error: '获取用户预约列表失败' });
  }
});

module.exports = router; 