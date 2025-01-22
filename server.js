const http = require("http");
const sqlite3 = require("sqlite3").verbose();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const WebSocket = require("ws");
const bcrypt = require("bcrypt");
const path = require("path");
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 环境变量配置
const PORT = process.env.PORT || 3002;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "chat_app.db");
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const STATIC_PATH = process.env.NODE_ENV === 'production' 
  ? process.env.STATIC_PATH || path.join(__dirname, 'build')
  : path.join(__dirname, 'client');

app.use(bodyParser.json());
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
}));

// 服务静态文件
app.use(express.static(path.join(__dirname, 'build')));

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    fs.mkdir(uploadDir, { recursive: true }, (err) => {
      if (err) {
        cb(err, null);
      } else {
        cb(null, uploadDir);
      }
    });
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('不支持的文件类型'), false);
  }
};

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: fileFilter
});

// 添加静态文件服务
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 添加 API 路由前缀
app.use('/api', (req, res, next) => {
  console.log(`API Request: ${req.method} ${req.url}`);
  next();
});

// 添加头像上传路由
app.post('/api/upload-avatar', upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '没有上传文件' });
    }

    // 修改这里的端口号
    const avatarUrl = process.env.NODE_ENV === 'production'
      ? `http://139.196.36.100:3002/uploads/${req.file.filename}`
      : `http://localhost:3002/uploads/${req.file.filename}`;

    res.json({
      message: '头像上传成功',
      avatarUrl: avatarUrl
    });
  } catch (error) {
    console.error('头像上传错误:', error);
    res.status(500).json({ message: '头像上传失败' });
  }
});

// 数据库连接配置
const dbConfig = {
  filename: DB_PATH,
  verbose: console.log,
};

let db = null;

// 创建数据库连接
function connectDB() {
  if (db) {
    console.log("Database connection already exists");
    return;
  }

  db = new sqlite3.Database(dbConfig.filename, (err) => {
    if (err) {
      console.error("Error connecting to SQLite database:", err.message);
      process.exit(1);
    }
    console.log("Connected to SQLite database");
    
    // 创建表
    createTables();
  });
}

// 创建表
function createTables() {
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
      console.log("Users table ready");
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
      console.log("Messages table ready");
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
      console.log("Parking spots table ready");
      // 添加测试停车位数据
      db.run(`
        INSERT OR IGNORE INTO parking_spots 
        (owner_username, location, price, contact, coordinates, description) 
        VALUES 
        ('testuser', '测试位置1', 50.00, '13800138000', '31.2304,121.4737', '测试描述1'),
        ('testuser', '测试位置2', 60.00, '13800138001', '31.2305,121.4738', '测试描述2')
      `);
    }
  });
  
  // 创建管理员表
  db.run(`CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error("Error creating admins table:", err.message);
    } else {
      console.log("Admins table ready");
      // 创建默认管理员账号
      createDefaultAdmin();
    }
  });
}

// 添加创建默认管理员账号的函数
async function createDefaultAdmin() {
  const defaultAdmin = {
    username: 'admin',
    password: 'admin123'
  };

  try {
    // 先检查是否已存在管理员账号
    console.log('Checking for existing admin account...');
    db.get("SELECT * FROM admins WHERE username = ?", [defaultAdmin.username], async (err, admin) => {
      if (err) {
        console.error("Error checking admin:", err);
        return;
      }
      
      if (!admin) {
        console.log('No admin account found, creating default admin...');
        const hashedPassword = await bcrypt.hash(defaultAdmin.password, 10);
        db.run(
          "INSERT INTO admins (username, password) VALUES (?, ?)",
          [defaultAdmin.username, hashedPassword],
          (err) => {
            if (err) {
              console.error("Error creating default admin:", err);
            } else {
              console.log("Default admin account created successfully");
            }
          }
        );
      } else {
        console.log('Admin account already exists');
      }
    });
  } catch (error) {
    console.error("Error in createDefaultAdmin:", error);
  }
}

// 优雅关闭
function closeDB() {
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('Database connection closed');
      }
    });
    db = null;
  }
}

// 连接数据库
connectDB();

// 进程退出时关闭数据库
process.on('SIGINT', () => {
  closeDB();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDB();
  process.exit(0);
});

// 确保上传目录存在
const uploadDir = path.join(__dirname, 'uploads');
fs.mkdir(uploadDir, { recursive: true }, (err) => {
  if (err) {
    console.error('Error creating uploads directory:', err);
    process.exit(1);
  }
});

// 注册路由
app.post("/api/register", async (req, res) => {
  const { username, password, full_name, phone, avatar, bio, address } = req.body;

  if (!username || !password || !full_name || !phone) {
    return res.status(400).json({ message: "必填信息不能为空" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 如果avatar是base64格式，需要先保存为文件
    let avatarUrl = avatar;
    if (avatar && avatar.startsWith('data:image')) {
      const matches = avatar.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const imageBuffer = Buffer.from(matches[2], 'base64');
        const fileExtension = matches[1].replace('+', '');
        const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}.${fileExtension}`;
        const filePath = path.join(__dirname, 'uploads', fileName);
        
        await fs.promises.mkdir(path.join(__dirname, 'uploads'), { recursive: true });
        await fs.promises.writeFile(filePath, imageBuffer);
        
        avatarUrl = `http://localhost:3002/uploads/${fileName}`;
      }
    }
    
    db.run(
      `INSERT INTO users (username, password, full_name, phone, avatar, bio, address) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [username, hashedPassword, full_name, phone, avatarUrl, bio || '该用户很神秘', address || ''],
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
    console.error('注册错误:', error);
    res.status(500).json({ message: "创建用户失败" });
  }
});

// 登录路由
app.post("/api/login", (req, res) => {
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
app.get("/api/messages", (req, res) => {
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
app.post("/api/messages", (req, res) => {
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
app.get("/api/test", (req, res) => {
  res.json({ message: "Server is running" });
});

// Google 登录路由
app.post("/api/google-login", async (req, res) => {
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
app.get("/api/parking-spots", (req, res) => {
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
app.post("/api/parking-spots", (req, res) => {
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
      
      // 返���新创建的停车位信息
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
app.get("/api/parking-spots/:id", (req, res) => {
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
app.get("/api/user-info/:username", (req, res) => {
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
app.put("/api/parking-spots/:id", (req, res) => {
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
app.delete("/api/parking-spots/:id", (req, res) => {
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
app.get("/api/parking/search", (req, res) => {
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

// 测试路由 - 添加到其他路由之前
app.get("/test", (req, res) => {
  res.json({ 
    message: "Server is running",
    env: process.env.NODE_ENV,
    staticPath: STATIC_PATH
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ 
    message: "服务器内部错误",
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.info('SIGTERM signal received.');
  server.close(() => {
    console.log('Server closed.');
    closeDB();
    process.exit(0);
  });
});

// 管理员登录接口
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;
  console.log('尝试管理员登录:', username);

  if (!username || !password) {
    console.log('用户名或密码为空');
    return res.status(400).json({ message: "用户名和密码不能为空" });
  }

  db.get(
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
app.get("/api/admin/users", (req, res) => {
  db.all(
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
app.get("/api/admin/parking-spots", (req, res) => {
  db.all(
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
app.delete("/api/admin/users/:id", (req, res) => {
  const { id } = req.params;
  
  db.run("DELETE FROM users WHERE id = ?", [id], function(err) {
    if (err) {
      return res.status(500).json({ message: "删除用户失败" });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: "用户不存在" });
    }
    res.json({ message: "用户删除成功" });
  });
});

// 管理员修改用户信息
app.put("/api/admin/users/:id", (req, res) => {
  const { id } = req.params;
  const { full_name, phone, bio, address } = req.body;

  db.run(
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

// 管理员修改停车位信息
app.put("/api/admin/parking-spots/:id", (req, res) => {
  const { id } = req.params;
  const { location, price, status, description } = req.body;

  db.run(
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
app.delete("/api/admin/parking-spots/:id", (req, res) => {
  const { id } = req.params;
  
  db.run("DELETE FROM parking_spots WHERE id = ?", [id], function(err) {
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

// 添加测试路由
app.get("/api/admin/test", (req, res) => {
  res.json({ message: "Admin API is working" });
});

// 处理前端路由 - 移到最后
app.get('*', (req, res) => {
  res.sendFile(path.join(STATIC_PATH, 'index.html'));
});

// 修改监听配置
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on:\n- HTTP: http://localhost:${PORT}\n- WebSocket: ws://localhost:${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});
