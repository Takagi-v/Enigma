const http = require("http");
const sqlite3 = require("sqlite3").verbose();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const WebSocket = require("ws");
const bcrypt = require("bcrypt");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 环境变量配置
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "chat_app.db");
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5050";

app.use(bodyParser.json());
app.use(cors({
  origin: "*",
  credentials: true,
}));

// 服务静态文件
app.use(express.static(path.join(__dirname, 'client')));

// 创建 SQLite 数据库连接
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("Error connecting to SQLite database:", err.message);
  } else {
    console.log("Connected to SQLite database");
    
    // 创建用户表
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      avatar TEXT DEFAULT NULL,
      bio TEXT DEFAULT '该用户很神秘',
      address TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        console.error("Error creating users table:", err.message);
      } else {
        console.log("Users table created successfully");
      }
    });
    
    // 创建消息表
    db.run(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        console.error("Error creating messages table:", err.message);
      } else {
        console.log("Messages table created successfully");
      }
    });
    
    // 创建停车场表
    db.run(`CREATE TABLE IF NOT EXISTS parking_spots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_username TEXT NOT NULL,
      location TEXT NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      contact TEXT NOT NULL,
      coordinates TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'available',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_username) REFERENCES users(username)
    )`, (err) => {
      if (err) {
        console.error("Error creating parking_spots table:", err.message);
      } else {
        console.log("Parking spots table created successfully");
      }
    });
  }
});

// 注册路由
app.post("/register", async (req, res) => {
  const { username, password, full_name, phone, avatar, bio, address } = req.body;

  if (!username || !password || !full_name || !phone) {
    return res.status(400).json({ message: "必填信息不能为空" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run(
      `INSERT INTO users (username, password, full_name, phone, avatar, bio, address) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [username, hashedPassword, full_name, phone, avatar, bio || '该用户很神秘', address || ''],
      (err) => {
        if (err) {
          if (err.message.includes("UNIQUE constraint failed")) {
            return res.status(400).json({ message: "用户名已存在" });
          }
          return res.status(500).json({ message: "创建用户失败" });
        }
        res.status(201).json({ message: "注册成功" });
      }
    );
  } catch (error) {
    res.status(500).json({ message: "创建用户失败" });
  }
});

// 登录路由
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }

  db.get(
    "SELECT * FROM users WHERE username = ?",
    [username],
    async (err, user) => {
      if (err) {
        return res.status(500).json({ message: "Error during login" });
      }
      
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      try {
        const match = await bcrypt.compare(password, user.password);
        if (match) {
          res.json({ 
            message: "Login successful",
            username: user.username
          });
        } else {
          res.status(401).json({ message: "Invalid username or password" });
        }
      } catch (error) {
        res.status(500).json({ message: "Error during login" });
      }
    }
  );
});

// 获取消息
app.get("/messages", (req, res) => {
  console.log("Received request to fetch messages");
  db.all(
    "SELECT * FROM messages ORDER BY created_at DESC",
    [],
    (err, rows) => {
      if (err) {
        console.error("Error fetching messages:", err.message);
        return res.status(500).send("Error fetching messages");
      }
      console.log("Messages fetched successfully");
      res.json(rows);
    }
  );
});

// 处理 POST 请求以保存新消息
app.post("/messages", (req, res) => {
  console.log("Received request to save message:", req.body);
  const { username, text } = req.body;

  db.run(
    "INSERT INTO messages (username, text) VALUES (?, ?)",
    [username, text],
    function (err) {
      if (err) {
        console.error("Error saving message:", err.message);
        return res.status(500).send("Error saving message");
      }
      const newMessage = {
        id: this.lastID,
        username,
        text,
        created_at: new Date(),
      };
      console.log("Message saved successfully:", newMessage);
      // 广播新消息给所有连接的客户端
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(newMessage));
        }
      });
      res.status(201).json(newMessage);
    }
  );
});

// WebSocket连接处理
wss.on("connection", (ws) => {
  console.log("New client connected");

  ws.on("message", (message) => {
    console.log("Received:", message);
    // 广播消息给所有客户端
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});

// 测试路由
app.get("/test", (req, res) => {
  res.json({ message: "Server is running" });
});

// Google 登录路由
app.post("/google-login", async (req, res) => {
  const { googleId, email, username, full_name, avatar } = req.body;

  try {
    // 检查用户是否已存在
    db.get(
      "SELECT * FROM users WHERE username = ?",
      [username],
      async (err, user) => {
        if (err) {
          return res.status(500).json({ message: "Error checking user" });
        }

        if (!user) {
          // 如果用户不存在，创建新用户
          const hashedPassword = await bcrypt.hash(googleId, 10); // 使用 googleId 作为密码
          db.run(
            "INSERT INTO users (username, password) VALUES (?, ?)",
            [username, hashedPassword],
            (err) => {
              if (err) {
                return res.status(500).json({ message: "Error creating user" });
              }
              res.json({ message: "Google login successful", username });
            }
          );
        } else {
          // 如果用户已存在，直接登录
          res.json({ message: "Google login successful", username });
        }
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Error during Google login" });
  }
});

// 修改获取停车位的路由，添加坐标验证
app.get("/parking-spots", (req, res) => {
  db.all(
    `SELECT 
      p.*,
      u.full_name as owner_full_name,
      u.phone as owner_phone
     FROM parking_spots p
     LEFT JOIN users u ON p.owner_username = u.username
     WHERE p.coordinates IS NOT NULL
     ORDER BY p.created_at DESC`,
    [],
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
      res.json(validSpots);
    }
  );
});

// 修改添加停车位的路由，添加坐标验证
app.post("/parking-spots", (req, res) => {
  const { owner_username, location, price, contact, coordinates, description } = req.body;

  // 验证坐标格式
  if (!coordinates || typeof coordinates !== 'string') {
    return res.status(400).json({ message: "坐标格式不正确" });
  }

  const [lat, lng] = coordinates.split(',');
  if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ message: "坐标格式不正确" });
  }

  // 验证其他必填字段
  if (!owner_username || !location || !price || !contact) {
    return res.status(400).json({ message: "必填信息不能为空" });
  }

  db.run(
    `INSERT INTO parking_spots (
      owner_username, 
      location, 
      price, 
      contact, 
      coordinates, 
      description,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    [owner_username, location, price, contact, coordinates, description],
    function(err) {
      if (err) {
        console.error("添加停车位错误:", err);
        return res.status(500).json({ message: "创建停车位失败" });
      }
      
      // 返回新创建的停车位信息
      db.get(
        `SELECT 
          p.*,
          u.full_name as owner_full_name,
          u.phone as owner_phone
         FROM parking_spots p
         LEFT JOIN users u ON p.owner_username = u.username
         WHERE p.id = ?`,
        [this.lastID],
        (err, spot) => {
          if (err) {
            return res.status(500).json({ message: "获取新创建的停车位信息失败" });
          }
          res.status(201).json(spot);
        }
      );
    }
  );
});

// 修改获取单个停车位详情的路由
app.get("/parking-spots/:id", (req, res) => {
  const { id } = req.params;

  db.get(
    `SELECT 
      p.*,
      u.full_name as owner_full_name,
      u.phone as owner_phone
     FROM parking_spots p
     LEFT JOIN users u ON p.owner_username = u.username
     WHERE p.id = ? AND p.coordinates IS NOT NULL`,
    [id],
    (err, spot) => {
      if (err) {
        console.error("获取停车位详情错误:", err);
        return res.status(500).json({ message: "获取停车位详情失败" });
      }
      
      if (!spot) {
        return res.status(404).json({ message: "停车位信息不存在" });
      }

      // 验证坐标格式
      const coords = spot.coordinates.split(',');
      if (coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) {
        return res.status(400).json({ message: "停车位坐标格式不正确" });
      }

      res.json(spot);
    }
  );
});

// 添加获取用户信息的路由
app.get("/user-info/:username", (req, res) => {
  const { username } = req.params;

  db.get(
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

      // 不返回密码等敏感信息
      res.json(user);
    }
  );
});

// 添加更新停车位状态的路由
app.put("/parking-spots/:id", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  db.run(
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

// 添加删除停车位的路由
app.delete("/parking-spots/:id", (req, res) => {
  const { id } = req.params;

  db.run(
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

// 添加搜索路由
app.get("/parking/search", (req, res) => {
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

  db.all(
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

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "服务器内部错误" });
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.info('SIGTERM signal received.');
  server.close(() => {
    console.log('Server closed.');
    db.close();
    process.exit(0);
  });
});

// 处理前端路由
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Server running on:\n- HTTP: http://0.0.0.0:${PORT}\n- WebSocket: ws://0.0.0.0:${PORT}`);
});
