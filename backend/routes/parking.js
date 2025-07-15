const express = require('express');
const router = express.Router();
const { db } = require('../models/db');
const { authenticateToken } = require('../middleware/auth');

const API_BASE_URL = 'http://www.goparkme.com/api';

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
        if (!spot.coordinates) return false;
        const coords = spot.coordinates.split(',');
        return coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1]);
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
          if (!spot.coordinates) return false;
          const coords = spot.coordinates.split(',');
          return coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1]);
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
      if (!spot.coordinates) return false;
      const coords = spot.coordinates.split(',');
      return coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1]);
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
        return coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1]);
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

// 更新停车位信息
router.put("/:id", authenticateToken, (req, res) => {
  const { id } = req.params;
  const {
    location,
    price,
    description,
    status,
    hourly_rate,
    contact,
    opening_hours,
    lock_serial_number // 新增地锁序列号
  } = req.body;

  // 动态构建SQL更新语句
  const fields = [];
  const params = [];

  if (location !== undefined) {
    fields.push("location = ?");
    params.push(location);
  }
  if (price !== undefined) {
    fields.push("price = ?");
    params.push(price);
  }
  if (description !== undefined) {
    fields.push("description = ?");
    params.push(description);
  }
  if (status !== undefined) {
    fields.push("status = ?");
    params.push(status);
  }
  if (hourly_rate !== undefined) {
    fields.push("hourly_rate = ?");
    params.push(hourly_rate);
  }
  if (contact !== undefined) {
    fields.push("contact = ?");
    params.push(contact);
  }
  if (opening_hours !== undefined) {
    fields.push("opening_hours = ?");
    params.push(opening_hours);
  }
  // 允许将地锁序列号设置为空字符串或null来解绑
  if (lock_serial_number !== undefined) {
    fields.push("lock_serial_number = ?");
    params.push(lock_serial_number || null);
  }

  if (fields.length === 0) {
    return res.status(400).json({ message: "没有提供任何需要更新的字段" });
  }

  const sql = `UPDATE parking_spots SET ${fields.join(", ")} WHERE id = ?`;
  params.push(id);

  db().run(sql, params, function(err) {
      if (err) {
      console.error("更新停车场信息失败:", err);
      return res.status(500).json({ message: "更新停车场信息失败" });
      }

      if (this.changes === 0) {
      return res.status(404).json({ message: "未找到该停车位，或信息无变化" });
    }

    res.json({ message: "停车场信息更新成功" });
  });
});

// 删除停车位
router.delete("/:id", authenticateToken, (req, res) => {
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

// 添加评论
router.post('/:id/reviews', authenticateToken, async (req, res) => {
  const parkingSpotId = req.params.id;
  const { rating, comment } = req.body;
  const userId = req.user.id;

  try {
    // 检查停车位是否存在
    const parkingSpot = await new Promise((resolve, reject) => {
      db().get('SELECT * FROM parking_spots WHERE id = ?', [parkingSpotId], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });

    if (!parkingSpot) {
      return res.status(404).json({ message: '停车位不存在' });
    }

    // 检查用户是否已经评论过
    const existingReview = await new Promise((resolve, reject) => {
      db().get(
        'SELECT * FROM reviews WHERE parking_spot_id = ? AND user_id = ?',
        [parkingSpotId, userId],
        (err, row) => {
          if (err) reject(err);
          resolve(row);
        }
      );
    });

    if (existingReview) {
      return res.status(400).json({ message: '您已经评论过这个停车位' });
    }

    // 添加新评论
    await new Promise((resolve, reject) => {
      db().run(
        'INSERT INTO reviews (parking_spot_id, user_id, rating, comment) VALUES (?, ?, ?, ?)',
        [parkingSpotId, userId, rating, comment],
        (err) => {
          if (err) reject(err);
          resolve();
        }
      );
    });

    // 更新停车位的平均评分
    await new Promise((resolve, reject) => {
      db().run(
        `UPDATE parking_spots 
         SET average_rating = (
           SELECT AVG(rating) 
           FROM reviews 
           WHERE parking_spot_id = ?
         )
         WHERE id = ?`,
        [parkingSpotId, parkingSpotId],
        (err) => {
          if (err) reject(err);
          resolve();
        }
      );
    });

    res.json({ message: '评论添加成功' });
  } catch (error) {
    console.error('添加评论失败:', error);
    res.status(500).json({ message: '添加评论失败' });
  }
});

// 获取停车位评论
router.get('/:id/reviews', async (req, res) => {
  const parkingSpotId = req.params.id;

  try {
    // 检查停车位是否存在
    const parkingSpot = await new Promise((resolve, reject) => {
      db().get('SELECT * FROM parking_spots WHERE id = ?', [parkingSpotId], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });

    if (!parkingSpot) {
      return res.status(404).json({ message: '停车位不存在' });
    }

    const reviews = await new Promise((resolve, reject) => {
      db().all(
        `SELECT r.*, u.username, u.avatar
         FROM reviews r
         JOIN users u ON r.user_id = u.id
         WHERE r.parking_spot_id = ?
         ORDER BY r.created_at DESC`,
        [parkingSpotId],
        (err, rows) => {
          if (err) reject(err);
          resolve(rows);
        }
      );
    });

    res.json({ reviews });
  } catch (error) {
    console.error('获取评论失败:', error);
    res.status(500).json({ message: '获取评论失败' });
  }
});

// 取消预定
router.post('/:id/reservations/:reservationId/cancel', async (req, res) => {
  const reservationId = req.params.reservationId;

  try {
    await new Promise((resolve, reject) => {
      db().run(
        "UPDATE reservations SET status = 'cancelled', updated_at = DATETIME('now', 'utc') WHERE id = ?",
        [reservationId],
        (err) => {
          if (err) reject(err);
          resolve();
        }
      );
    });

    res.json({ message: '预定已取消' });
  } catch (error) {
    console.error('取消预定失败:', error);
    res.status(500).json({ error: '取消预定失败' });
  }
});

// 创建预定
router.post('/:id/reserve', authenticateToken, async (req, res) => {
  const parkingSpotId = req.params.id;
  const { userId, reservationDate, startTime, endTime, notes } = req.body;

  // 验证用户ID
  if (!userId || userId !== req.user.id) {
    return res.status(403).json({ error: '无权进行此操作' });
  }

  try {
    // 检查停车位是否存在
    const parkingSpot = await new Promise((resolve, reject) => {
      db().get("SELECT * FROM parking_spots WHERE id = ?", [parkingSpotId], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });

    if (!parkingSpot) {
      return res.status(404).json({ error: '停车位不存在' });
    }

    // 验证日期和时间
    // 注意：前端传入的时间应该已经是UTC时间，或者在这里转为UTC时间
    const currentDate = new Date();
    const reservationDateTime = new Date(`${reservationDate} ${startTime}`);
    if (reservationDateTime < currentDate) {
      return res.status(400).json({ error: '不能预定过去的时间' });
    }

    // 检查该时间段是否已被预定
    const existingReservation = await new Promise((resolve, reject) => {
      db().get(
        `SELECT * FROM reservations 
         WHERE parking_spot_id = ? 
         AND reservation_date = ? 
         AND ((start_time <= ? AND end_time > ?) 
         OR (start_time < ? AND end_time >= ?) 
         OR (start_time >= ? AND end_time <= ?))
         AND status != 'cancelled'`,
        [parkingSpotId, reservationDate, startTime, startTime, endTime, endTime, startTime, endTime],
        (err, row) => {
          if (err) reject(err);
          resolve(row);
        }
      );
    });

    if (existingReservation) {
      return res.status(400).json({ error: '该时间段已被预定' });
    }

    // 验证时间格式
    if (!startTime.match(/^\d{2}:\d{2}:\d{2}$/) || !endTime.match(/^\d{2}:\d{2}:\d{2}$/)) {
      return res.status(400).json({ error: '时间格式无效' });
    }

    // 在SQLite中计算时间差和总金额
    const result = await new Promise((resolve, reject) => {
      db().get(
        `SELECT ROUND(
          (julianday(?) - julianday(?)) * 24 * ?
        ) AS total_amount`,
        [`${reservationDate} ${endTime}`, `${reservationDate} ${startTime}`, parkingSpot.hourly_rate],
        (err, row) => {
          if (err) reject(err);
          
          if (!row || row.total_amount <= 0) {
            reject(new Error('结束时间必须晚于开始时间'));
          } else {
            resolve(row.total_amount);
          }
        }
      );
    });

    // 创建预定，明确指定使用UTC时间
    const insertResult = await new Promise((resolve, reject) => {
      db().run(
        `INSERT INTO reservations (
          parking_spot_id, user_id, reservation_date, 
          start_time, end_time, total_amount, notes,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, DATETIME('now', 'utc'), DATETIME('now', 'utc'))`,
        [parkingSpotId, userId, reservationDate, startTime, endTime, result, notes || ''],
        function(err) {
          if (err) reject(err);
          resolve(this);
        }
      );
    });

    res.json({
      id: insertResult.lastID,
      message: '预定成功',
      totalAmount: result
    });
  } catch (error) {
    console.error('预定失败:', error);
    res.status(500).json({ error: '预定失败' });
  }
});

// 获取停车位的预定列表
router.get('/:id/reservations', async (req, res) => {
  const parkingSpotId = req.params.id;

  try {
    const reservations = await new Promise((resolve, reject) => {
      db().all(
        `SELECT r.*, u.username 
         FROM reservations r
         JOIN users u ON r.user_id = u.id
         WHERE r.parking_spot_id = ?
         ORDER BY r.reservation_date, r.start_time`,
        [parkingSpotId],
        (err, rows) => {
          if (err) reject(err);
          resolve(rows);
        }
      );
    });

    res.json(reservations);
  } catch (error) {
    console.error('获取预定列表失败:', error);
    res.status(500).json({ error: '获取预定列表失败' });
  }
});

module.exports = router; 