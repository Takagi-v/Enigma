const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { db } = require('../models/db');
const { authenticateAdmin } = require('../middleware/auth');

// 管理员登录
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username?.trim() || !password?.trim()) {
    return res.status(400).json({ message: "用户名和密码不能为空" });
  }

  try {
    const admin = await new Promise((resolve, reject) => {
      db().get(
        "SELECT * FROM admins WHERE username = ?",
        [username.trim()],
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      );
    });

    if (!admin) {
      return res.status(401).json({ message: "用户名或密码错误" });
    }

    const match = await bcrypt.compare(password.trim(), admin.password);
    if (!match) {
      return res.status(401).json({ message: "用户名或密码错误" });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: 'admin' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({ 
      message: "登录成功",
      token,
      username: admin.username
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ message: "登录过程中出错，请稍后重试" });
  }
});

// 获取管理员统计信息
router.get("/stats", authenticateAdmin, async (req, res) => {
  try {
    const [userCount, spotCount, usageCount] = await Promise.all([
      new Promise((resolve, reject) => {
        db().get("SELECT COUNT(*) as total FROM users", [], (err, result) => {
          if (err) reject(err);
          else resolve(result.total);
        });
      }),
      new Promise((resolve, reject) => {
        db().get("SELECT COUNT(*) as total FROM parking_spots", [], (err, result) => {
          if (err) reject(err);
          else resolve(result.total);
        });
      }),
      new Promise((resolve, reject) => {
        db().get("SELECT COUNT(*) as total FROM parking_usage", [], (err, result) => {
          if (err) reject(err);
          else resolve(result.total);
        });
      })
    ]);

    res.json({
      users: userCount,
      spots: spotCount,
      usages: usageCount
    });
  } catch (error) {
    console.error('获取统计信息失败:', error);
    res.status(500).json({ message: "获取统计信息失败，请稍后重试" });
  }
});

// 获取所有用户信息
router.get("/users", authenticateAdmin, (req, res) => {
  db().all(
    `SELECT u.id, u.username, u.full_name, u.phone, u.avatar, u.bio, u.address, u.created_at,
     (SELECT COUNT(*) FROM parking_spots WHERE owner_username = u.username) as spot_count,
     (SELECT COUNT(*) FROM parking_usage WHERE user_id = u.id) as usage_count
     FROM users u`,
    [],
    (err, users) => {
      if (err) {
        console.error('获取用户列表失败:', err);
        return res.status(500).json({ message: "获取用户列表失败，请稍后重试" });
      }
      res.json(users);
    }
  );
});

// 获取所有停车位信息
router.get("/parking-spots", authenticateAdmin, (req, res) => {
  db().all(
    `SELECT p.*, u.username as owner_username, u.full_name as owner_full_name, u.phone as contact
     FROM parking_spots p
     LEFT JOIN users u ON p.owner_username = u.username
     ORDER BY p.created_at DESC`,
    [],
    (err, spots) => {
      if (err) {
        console.error('获取停车位列表失败:', err);
        return res.status(500).json({ message: "获取停车位列表失败，请稍后重试" });
      }
      res.json(spots);
    }
  );
});

// 删除用户
router.delete("/users/:id", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  
  try {
    await new Promise((resolve, reject) => {
      db().run("BEGIN TRANSACTION", err => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 获取用户名
    const user = await new Promise((resolve, reject) => {
      db().get("SELECT username FROM users WHERE id = ?", [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      throw new Error("用户不存在");
    }

    // 删除用户相关的所有数据
    await Promise.all([
      new Promise((resolve, reject) => {
        db().run("DELETE FROM parking_usage WHERE user_id = ?", [id], err => {
          if (err) reject(err);
          else resolve();
        });
      }),
      new Promise((resolve, reject) => {
        db().run("DELETE FROM parking_spots WHERE owner_username = ?", [user.username], err => {
          if (err) reject(err);
          else resolve();
        });
      }),
      new Promise((resolve, reject) => {
        db().run("DELETE FROM users WHERE id = ?", [id], function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        });
      })
    ]);

    await new Promise((resolve, reject) => {
      db().run("COMMIT", err => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ message: "用户删除成功" });
  } catch (error) {
    await new Promise((resolve) => {
      db().run("ROLLBACK", () => resolve());
    });
    console.error('删除用户失败:', error);
    res.status(500).json({ message: error.message || "删除用户失败，请稍后重试" });
  }
});

// 修改用户信息
router.put("/users/:id", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  const { full_name, phone, bio, address } = req.body;

  try {
    const result = await new Promise((resolve, reject) => {
      db().run(
        `UPDATE users 
         SET full_name = ?, phone = ?, bio = ?, address = ?,
         updated_at = DATETIME('now', 'utc')
         WHERE id = ?`,
        [full_name, phone, bio, address, id],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });

    if (result === 0) {
      return res.status(404).json({ message: "用户不存在" });
    }

    res.json({ message: "用户信息更新成功" });
  } catch (error) {
    console.error('更新用户信息失败:', error);
    res.status(500).json({ message: "更新用户信息失败，请稍后重试" });
  }
});

// 修改停车位信息
router.put("/parking-spots/:id", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  const { location, price, status, description, coordinates } = req.body;

  try {
    const result = await new Promise((resolve, reject) => {
      db().run(
        `UPDATE parking_spots 
         SET location = ?, price = ?, status = ?, description = ?,
         coordinates = ?, updated_at = DATETIME('now', 'utc')
         WHERE id = ?`,
        [location, price, status, description, coordinates, id],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });

    if (result === 0) {
      return res.status(404).json({ message: "停车位不存在" });
    }

    res.json({ message: "停车位信息更新成功" });
  } catch (error) {
    console.error('更新停车位信息失败:', error);
    res.status(500).json({ message: "更新停车位信息失败，请稍后重试" });
  }
});

// 新增停车位
router.post("/parking-spots", authenticateAdmin, async (req, res) => {
  const { 
    owner_username, 
    location, 
    price, 
    description, 
    status, 
    opening_hours, 
    lock_serial_number,
    coordinates
  } = req.body;

  if (!owner_username || !location || !price || !coordinates) {
    return res.status(400).json({ message: "所有者、位置、价格和坐标是必填项。" });
  }

  try {
    const result = await new Promise((resolve, reject) => {
      db().run(
        `INSERT INTO parking_spots (owner_username, location, price, description, status, opening_hours, lock_serial_number, coordinates)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [owner_username, location, price, description, status, opening_hours, lock_serial_number, coordinates],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });
    res.status(201).json({ message: "停车位添加成功", spotId: result.id });
  } catch (error) {
    console.error('添加停车位失败:', error);
    res.status(500).json({ message: "添加停车位失败，请稍后重试" });
  }
});

// 删除停车位
router.delete("/parking-spots/:id", authenticateAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    await new Promise((resolve, reject) => {
      db().run("BEGIN TRANSACTION", err => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 删除停车位相关的所有数据
    await Promise.all([
      new Promise((resolve, reject) => {
        db().run("DELETE FROM parking_usage WHERE spot_id = ?", [id], err => {
          if (err) reject(err);
          else resolve();
        });
      }),
      new Promise((resolve, reject) => {
        db().run("DELETE FROM parking_spots WHERE id = ?", [id], function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        });
      })
    ]);

    await new Promise((resolve, reject) => {
      db().run("COMMIT", err => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ message: "停车位删除成功" });
  } catch (error) {
    await new Promise((resolve) => {
      db().run("ROLLBACK", () => resolve());
    });
    console.error('删除停车位失败:', error);
    res.status(500).json({ message: "删除停车位失败，请稍后重试" });
  }
});

module.exports = router; 