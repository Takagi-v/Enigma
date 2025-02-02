const express = require('express');
const router = express.Router();
const { db } = require('../models/db');

// 获取停车位列表
router.get("/", (req, res) => {
  const { page, limit, sort = 'created_at', order = 'DESC' } = req.query;
  
  // 基础查询
  const baseQuery = `
    SELECT 
      p.*,
      u.full_name as owner_full_name,
      u.phone as owner_phone
    FROM parking_spots p
    LEFT JOIN users u ON p.owner_username = u.username
    WHERE p.coordinates IS NOT NULL
  `;

  // 如果没有提供分页参数，返回所有数据
  if (!page || !limit) {
    db().all(`${baseQuery} ORDER BY p.${sort} ${order}`, [], (err, rows) => {
      if (err) {
        return res.status(500).json({ message: "获取停车位信息失败" });
      }
      
      // 验证坐标格式
      const validSpots = rows.filter(spot => {
        const coords = spot.coordinates.split(',');
        return coords.length === 2 && 
               !isNaN(coords[0]) && 
               !isNaN(coords[1]);
      });

      res.json({
        spots: validSpots,
        pagination: {
          total: validSpots.length,
          current_page: 1,
          per_page: validSpots.length,
          total_pages: 1
        }
      });
    });
    return;
  }

  // 带分页的查询
  const offset = (page - 1) * limit;
  const validSortFields = ['created_at', 'price', 'location'];
  const validOrders = ['ASC', 'DESC'];
  const sortField = validSortFields.includes(sort) ? sort : 'created_at';
  const orderBy = validOrders.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';

  // 获取总数
  db().get('SELECT COUNT(*) as total FROM parking_spots WHERE coordinates IS NOT NULL', [], (err, count) => {
    if (err) {
      return res.status(500).json({ message: "获取停车位信息失败" });
    }

    // 获取分页数据
    db().all(
      `${baseQuery} ORDER BY p.${sortField} ${orderBy} LIMIT ? OFFSET ?`,
      [limit, offset],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ message: "获取停车位信息失败" });
        }
        
        // 验证坐标格式
        const validSpots = rows.filter(spot => {
          const coords = spot.coordinates.split(',');
          return coords.length === 2 && 
                 !isNaN(coords[0]) && 
                 !isNaN(coords[1]);
        });

        res.json({
          spots: validSpots,
          pagination: {
            total: count.total,
            current_page: parseInt(page),
            per_page: parseInt(limit),
            total_pages: Math.ceil(count.total / limit)
          }
        });
      }
    );
  });
});

// 获取附近的停车位
router.get("/nearby", (req, res) => {
  // 直接复用现有的获取所有停车位的逻辑
  const baseQuery = `
    SELECT 
      p.*,
      u.username as owner_username,
      u.full_name as owner_full_name,
      u.phone as owner_phone
    FROM parking_spots p
    LEFT JOIN users u ON p.owner_username = u.username
    WHERE p.coordinates IS NOT NULL
  `;

  db().all(baseQuery, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: "获取停车位信息失败" });
    }
    
    // 验证坐标格式
    const validSpots = rows.filter(spot => {
      const coords = spot.coordinates.split(',');
      return coords.length === 2 && 
             !isNaN(coords[0]) && 
             !isNaN(coords[1]);
    });

    res.json(validSpots);
  });
});

// 搜索停车位
router.get("/search", (req, res) => {
  const { keyword } = req.query;

  if (!keyword) {
    return res.status(400).json({ message: "搜索关键词不能为空" });
  }

  const searchQuery = `
    SELECT 
      p.*,
      u.full_name as owner_full_name,
      u.phone as owner_phone
    FROM parking_spots p
    LEFT JOIN users u ON p.owner_username = u.username
    WHERE 
      p.location LIKE ? OR 
      p.description LIKE ? OR 
      p.owner_username LIKE ? OR
      u.full_name LIKE ?
    ORDER BY p.created_at DESC
  `;

  const searchPattern = `%${keyword}%`;

  db().all(
    searchQuery,
    [searchPattern, searchPattern, searchPattern, searchPattern],
    (err, spots) => {
      if (err) {
        console.error("搜索错误:", err);
        return res.status(500).json({ message: "搜索过程中出现错误" });
      }

      // 验证坐标格式
      const validSpots = spots.filter(spot => {
        if (!spot.coordinates) return false;
        const coords = spot.coordinates.split(',');
        return coords.length === 2 && 
               !isNaN(coords[0]) && 
               !isNaN(coords[1]);
      });

      res.json(validSpots);
    }
  );
});

// 获取单个停车位详情
router.get("/:id", (req, res) => {
  const { id } = req.params;
  
  const query = `
    SELECT 
      p.*,
      u.full_name as owner_full_name,
      u.phone as owner_phone
    FROM parking_spots p
    LEFT JOIN users u ON p.owner_username = u.username
    WHERE p.id = ?
  `;

  db().get(query, [id], (err, spot) => {
    if (err) {
      return res.status(500).json({ message: "获取停车位信息失败" });
    }
    
    if (!spot) {
      return res.status(404).json({ message: "未找到该停车位" });
    }

    // 验证坐标格式
    if (spot.coordinates) {
      const coords = spot.coordinates.split(',');
      if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
        res.json(spot);
      } else {
        res.status(400).json({ message: "停车位坐标格式无效" });
      }
    } else {
      res.status(400).json({ message: "停车位缺少坐标信息" });
    }
  });
});

// 更新停车位状态
router.put("/:id", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  db().run(
    "UPDATE parking_spots SET status = ? WHERE id = ?",
    [status, id],
    function(err) {
      if (err) {
        console.error("Error updating parking spot:", err);
        return res.status(500).json({ message: "更新停车位状态失败" });
      }

      if (this.changes === 0) {
        return res.status(404).json({ message: "停车位信息不存在" });
      }

      res.json({ message: "停车位状态更新成功" });
    }
  );
});

// 删除停车位
router.delete("/:id", (req, res) => {
  const { id } = req.params;

  db().run(
    "DELETE FROM parking_spots WHERE id = ?",
    [id],
    function(err) {
      if (err) {
        console.error("Error deleting parking spot:", err);
        return res.status(500).json({ message: "删除停车位失败" });
      }

      if (this.changes === 0) {
        return res.status(404).json({ message: "停车位信息不存在" });
      }

      res.json({ message: "停车位删除成功" });
    }
  );
});

// 开始使用停车场
router.post("/:id/start", (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ message: "用户ID不能为空" });
  }

  db().serialize(() => {
    // 检查停车场状态
    db().get(
      "SELECT * FROM parking_spots WHERE id = ? AND status = 'available'",
      [id],
      (err, spot) => {
        if (err) {
          return res.status(500).json({ message: "查询停车场状态失败" });
        }

        if (!spot) {
          return res.status(400).json({ message: "停车场不可用" });
        }

        // 开启事务
        db().run("BEGIN TRANSACTION");

        // 更新停车场状态
        db().run(
          "UPDATE parking_spots SET status = 'in_use', current_user_id = ? WHERE id = ?",
          [user_id, id],
          (err) => {
            if (err) {
              db().run("ROLLBACK");
              return res.status(500).json({ message: "更新停车场状态失败" });
            }

            // 创建使用记录
            db().run(
              `INSERT INTO parking_usage (
                parking_spot_id, user_id, start_time, status
              ) VALUES (?, ?, DATETIME('now'), 'active')`,
              [id, user_id],
              function(err) {
                if (err) {
                  db().run("ROLLBACK");
                  return res.status(500).json({ message: "创建使用记录失败" });
                }

                db().run("COMMIT");
                res.json({
                  message: "停车场使用开始",
                  usage_id: this.lastID
                });
              }
            );
          }
        );
      }
    );
  });
});

// 结束使用停车场
router.post("/:id/end", (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ message: "用户ID不能为空" });
  }

  db().serialize(() => {
    // 检查停车场状态和使用记录
    db().get(
      `SELECT u.*, p.hourly_rate 
       FROM parking_usage u
       JOIN parking_spots p ON u.parking_spot_id = p.id
       WHERE p.id = ? AND u.user_id = ? AND u.status = 'active'
       ORDER BY u.start_time DESC LIMIT 1`,
      [id, user_id],
      (err, usage) => {
        if (err) {
          return res.status(500).json({ message: "查询使用记录失败" });
        }

        if (!usage) {
          return res.status(400).json({ message: "未找到有效的使用记录" });
        }

        // 计算费用
        const start = new Date(usage.start_time);
        const end = new Date();
        const hours = (end - start) / (1000 * 60 * 60); // 转换为小时
        const total_amount = Math.ceil(hours * usage.hourly_rate); // 向上取整

        // 开启事务
        db().run("BEGIN TRANSACTION");

        // 更新使用记录
        db().run(
          `UPDATE parking_usage 
           SET end_time = DATETIME('now'), 
               total_amount = ?,
               status = 'completed'
           WHERE id = ?`,
          [total_amount, usage.id],
          (err) => {
            if (err) {
              db().run("ROLLBACK");
              return res.status(500).json({ message: "更新使用记录失败" });
            }

            // 更新停车场状态
            db().run(
              "UPDATE parking_spots SET status = 'available', current_user_id = NULL WHERE id = ?",
              [id],
              (err) => {
                if (err) {
                  db().run("ROLLBACK");
                  return res.status(500).json({ message: "更新停车场状态失败" });
                }

                db().run("COMMIT");
                res.json({
                  message: "停车场使用结束",
                  total_amount,
                  usage_id: usage.id
                });
              }
            );
          }
        );
      }
    );
  });
});

// 支付停车费用
router.post("/:id/payment", (req, res) => {
  const { usage_id } = req.body;

  if (!usage_id) {
    return res.status(400).json({ message: "使用记录ID不能为空" });
  }

  db().run(
    "UPDATE parking_usage SET payment_status = 'paid' WHERE id = ?",
    [usage_id],
    function(err) {
      if (err) {
        return res.status(500).json({ message: "更新支付状态失败" });
      }

      if (this.changes === 0) {
        return res.status(404).json({ message: "未找到使用记录" });
      }

      res.json({ message: "支付成功" });
    }
  );
});

// 获取用户的停车记录
router.get("/usage/my", (req, res) => {
  const user_id = req.user?.id; // 假设通过认证中间件获取用户ID

  if (!user_id) {
    return res.status(401).json({ message: "请先登录" });
  }

  const query = `
    SELECT 
      u.*,
      p.location,
      p.hourly_rate,
      p.owner_username,
      owner.full_name as owner_full_name,
      owner.phone as owner_phone
    FROM parking_usage u
    JOIN parking_spots p ON u.parking_spot_id = p.id
    LEFT JOIN users owner ON p.owner_username = owner.username
    WHERE u.user_id = ?
    ORDER BY u.created_at DESC
  `;

  db().all(query, [user_id], (err, records) => {
    if (err) {
      console.error("获取停车记录失败:", err);
      return res.status(500).json({ message: "获取停车记录失败" });
    }

    res.json({
      records: records.map(record => ({
        id: record.id,
        parking_spot_id: record.parking_spot_id,
        location: record.location,
        start_time: record.start_time,
        end_time: record.end_time,
        total_amount: record.total_amount,
        payment_status: record.payment_status,
        status: record.status,
        hourly_rate: record.hourly_rate,
        owner_full_name: record.owner_full_name,
        owner_phone: record.owner_phone,
        vehicle_plate: record.vehicle_plate,
        vehicle_type: record.vehicle_type,
        payment_method: record.payment_method,
        payment_time: record.payment_time,
        transaction_id: record.transaction_id,
        rating: record.rating,
        review_comment: record.review_comment,
        review_time: record.review_time,
        created_at: record.created_at,
        updated_at: record.updated_at
      }))
    });
  });
});

module.exports = router; 