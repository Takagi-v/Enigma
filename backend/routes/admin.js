const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const { db } = require('../models/db');

// 管理员登录
router.post("/login", (req, res) => {
  const { username, password } = req.body;
  console.log('尝试管理员登录:', username);

  if (!username || !password) {
    console.log('用户名或密码为空');
    return res.status(400).json({ message: "用户名和密码不能为空" });
  }

  db().get(
    "SELECT * FROM admins WHERE username = ?",
    [username],
    async (err, admin) => {
      if (err) {
        console.error('数据库查询错误:', err);
        return res.status(500).json({ message: "登录过程中出错" });
      }
      
      if (!admin) {
        console.log('未找到管理员账号');
        return res.status(401).json({ message: "用户名或密码错误" });
      }

      try {
        const match = await bcrypt.compare(password, admin.password);
        console.log('密码验证结果:', match);
        if (match) {
          res.json({ 
            message: "登录成功",
            username: admin.username
          });
        } else {
          res.status(401).json({ message: "用户名或密码错误" });
        }
      } catch (error) {
        console.error('密码验证错误:', error);
        res.status(500).json({ message: "登录过程中出错" });
      }
    }
  );
});

// 获取所有用户信息
router.get("/users", (req, res) => {
  db().all(
    "SELECT id, username, full_name, phone, avatar, bio, address, created_at FROM users",
    [],
    (err, users) => {
      if (err) {
        return res.status(500).json({ message: "获取用户列表失败" });
      }
      res.json(users);
    }
  );
});

// 获取所有停车位信息
router.get("/parking-spots", (req, res) => {
  db().all(
    `SELECT 
      p.*,
      u.full_name as owner_full_name,
      u.phone as owner_phone
     FROM parking_spots p
     LEFT JOIN users u ON p.owner_username = u.username
     ORDER BY p.created_at DESC`,
    [],
    (err, spots) => {
      if (err) {
        return res.status(500).json({ message: "获取停车位列表失败" });
      }
      res.json(spots);
    }
  );
});

// 删除用户
router.delete("/users/:id", (req, res) => {
  const { id } = req.params;
  
  db().run("DELETE FROM users WHERE id = ?", [id], function(err) {
    if (err) {
      return res.status(500).json({ message: "删除用户失败" });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: "用户不存在" });
    }
    res.json({ message: "用户删除成功" });
  });
});

// 修改用户信息
router.put("/users/:id", (req, res) => {
  const { id } = req.params;
  const { full_name, phone, bio, address } = req.body;

  db().run(
    `UPDATE users 
     SET full_name = ?, phone = ?, bio = ?, address = ?
     WHERE id = ?`,
    [full_name, phone, bio, address, id],
    function(err) {
      if (err) {
        return res.status(500).json({ message: "更新用户信息失败" });
      }
      if (this.changes === 0) {
        return res.status(404).json({ message: "用户不存在" });
      }
      res.json({ message: "用户信息更新成功" });
    }
  );
});

// 修改停车位信息
router.put("/parking-spots/:id", (req, res) => {
  const { id } = req.params;
  const { location, price, status, description } = req.body;

  db().run(
    `UPDATE parking_spots 
     SET location = ?, price = ?, status = ?, description = ?
     WHERE id = ?`,
    [location, price, status, description, id],
    function(err) {
      if (err) {
        return res.status(500).json({ message: "更新停车位信息失败" });
      }
      if (this.changes === 0) {
        return res.status(404).json({ message: "停车位不存在" });
      }
      res.json({ message: "停车位信息更新成功" });
    }
  );
});

// 删除停车位
router.delete("/parking-spots/:id", (req, res) => {
  const { id } = req.params;
  
  db().run("DELETE FROM parking_spots WHERE id = ?", [id], function(err) {
    if (err) {
      console.error("删除停车位错误:", err);
      return res.status(500).json({ message: "删除停车位失败" });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: "停车位不存在" });
    }
    res.json({ message: "停车位删除成功" });
  });
});

// 测试路由
router.get("/test", (req, res) => {
  res.json({ message: "Admin API is working" });
});

module.exports = router; 