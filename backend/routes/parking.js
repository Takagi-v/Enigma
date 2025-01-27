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
  const { lat, lng, radius = 2 } = req.query; // radius in kilometers

  if (!lat || !lng) {
    return res.status(400).json({ message: "需要提供位置坐标" });
  }

  const query = `
    SELECT 
      p.*,
      u.full_name as owner_full_name,
      u.phone as owner_phone
    FROM parking_spots p
    LEFT JOIN users u ON p.owner_username = u.username
    WHERE p.coordinates IS NOT NULL
    ORDER BY p.created_at DESC
  `;

  db().all(query, [], (err, spots) => {
    if (err) {
      return res.status(500).json({ message: "获取附近停车位失败" });
    }

    // 过滤并计算距离
    const nearbySpots = spots
      .map(spot => {
        if (!spot.coordinates) return null;
        const [spotLat, spotLng] = spot.coordinates.split(',').map(Number);
        
        // 使用 Haversine 公式计算距离
        const R = 6371; // 地球半径（公里）
        const dLat = (spotLat - lat) * Math.PI / 180;
        const dLng = (spotLng - lng) * Math.PI / 180;
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat * Math.PI / 180) * Math.cos(spotLat * Math.PI / 180) * 
          Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;

        return {
          ...spot,
          distance: distance.toFixed(2)
        };
      })
      .filter(spot => spot && spot.distance <= radius)
      .sort((a, b) => a.distance - b.distance);

    res.json(nearbySpots);
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

module.exports = router; 