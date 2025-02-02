const express = require('express');
const router = express.Router();
const { db } = require('../models/db');

// 获取用户信息
router.get("/:username", (req, res) => {
  const { username } = req.params;
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: "请先登录" });
  }

  // 验证用户是否有权限获取信息
  if (username !== req.user?.username) {
    return res.status(403).json({ message: "无权访问其他用户的信息" });
  }

  db().get(
    `SELECT id, username, email, full_name, phone, avatar, bio, address, created_at
     FROM users 
     WHERE username = ?`,
    [username],
    (err, user) => {
      if (err) {
        console.error("获取用户信息失败:", err);
        return res.status(500).json({ message: "获取用户信息失败" });
      }
      
      if (!user) {
        return res.status(404).json({ message: "用户不存在" });
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
router.put("/:username", (req, res) => {
  const { username } = req.params;
  const { full_name, phone, avatar, bio, address } = req.body;

  // 验证是否是当前登录用户
  if (username !== req.user?.username) {
    return res.status(403).json({ message: "无权修改其他用户的信息" });
  }

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
        return res.status(500).json({ message: "更新用户信息失败" });
      }

      if (this.changes === 0) {
        return res.status(404).json({ message: "用户不存在" });
      }

      res.json({ message: "用户信息更新成功" });
    }
  );
});

module.exports = router; 