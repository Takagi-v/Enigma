const express = require('express');
const router = express.Router();
const { db } = require('../models/db');

// 获取用户信息
router.get("/:username", (req, res) => {
  const { username } = req.params;

  db().get(
    `SELECT username, full_name, phone, avatar, bio, address 
     FROM users 
     WHERE username = ?`,
    [username],
    (err, user) => {
      if (err) {
        return res.status(500).json({ message: "获取用户信息失败" });
      }
      
      if (!user) {
        return res.status(404).json({ message: "用户不存在" });
      }

      res.json(user);
    }
  );
});

module.exports = router; 