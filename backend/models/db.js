const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

let db = null;

// 创建数据库连接
function connectDB() {
  if (db) {
    console.log("数据库连接已存在");
    return;
  }

  const dbPath = path.join(__dirname, '../data/parking.db');
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('数据库连接错误:', err);
      return;
    }
    console.log('已连接到数据库');
    
    // 创建表结构
    createTables();
  });
}

// 创建表
async function createTables() {
  const tables = [
    // 用户表
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT UNIQUE,
      full_name TEXT,
      phone TEXT,
      avatar TEXT,
      bio TEXT DEFAULT '该用户很神秘',
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // 停车位表
    `CREATE TABLE IF NOT EXISTS parking_spots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_username TEXT NOT NULL,
      location TEXT NOT NULL,
      coordinates TEXT,
      price REAL NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'available',
      contact TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_username) REFERENCES users(username)
    )`,
    
    // 消息表
    `CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_username TEXT NOT NULL,
      receiver_username TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      read INTEGER DEFAULT 0,
      FOREIGN KEY (sender_username) REFERENCES users(username),
      FOREIGN KEY (receiver_username) REFERENCES users(username)
    )`,
    
    // 管理员表
    `CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  for (const sql of tables) {
    try {
      await runQuery(sql);
    } catch (error) {
      console.error('创建表失败:', error);
    }
  }

  // 创建默认管理员账号
  await createDefaultAdmin();
  // 创建测试停车场数据
  await createTestParkingSpots();
}

// 执行SQL查询的辅助函数
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
}

// 创建默认管理员账号
async function createDefaultAdmin() {
  const defaultAdmin = {
    username: 'admin',
    password: 'admin123'
  };

  try {
    const admin = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM admins WHERE username = ?", [defaultAdmin.username], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!admin) {
      const hashedPassword = await bcrypt.hash(defaultAdmin.password, 10);
      await runQuery(
        "INSERT INTO admins (username, password) VALUES (?, ?)",
        [defaultAdmin.username, hashedPassword]
      );
      console.log("默认管理员账号创建成功");
    }
  } catch (error) {
    console.error("创建默认管理员账号失败:", error);
  }
}

// 创建测试停车场数据
async function createTestParkingSpots() {
  const testSpots = [
    {
      owner_username: 'admin',
      location: '上海市浦东新区陆家嘴环路1000号',
      coordinates: '31.2397,121.4998',
      price: 15,
      description: '陆家嘴中心停车场，靠近地铁2号线陆家嘴站',
      status: 'available',
      contact: '13800138000'
    },
    {
      owner_username: 'admin',
      location: '上海市徐汇区虹桥路1号',
      coordinates: '31.1947,121.4372',
      price: 10,
      description: '港汇广场地下停车场，购物方便',
      status: 'available',
      contact: '13800138001'
    },
    {
      owner_username: 'admin',
      location: '上海市静安区南京西路1788号',
      coordinates: '31.2304,121.4737',
      price: 12,
      description: '静安寺商圈停车场，周边美食众多',
      status: 'available',
      contact: '13800138002'
    },
    {
      owner_username: 'admin',
      location: '上海市黄浦区人民大道200号',
      coordinates: '31.2304,121.4737',
      price: 20,
      description: '人民广场地下停车场，交通便利',
      status: 'available',
      contact: '13800138003'
    },
    {
      owner_username: 'admin',
      location: '上海市杨浦区五角场街道',
      coordinates: '31.3007,121.5185',
      price: 8,
      description: '五角场商圈停车场，适合长期停放',
      status: 'available',
      contact: '13800138004'
    }
  ];

  try {
    // 检查是否已经存在测试数据
    const existingSpots = await new Promise((resolve, reject) => {
      db.get("SELECT COUNT(*) as count FROM parking_spots", [], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (existingSpots.count === 0) {
      for (const spot of testSpots) {
        await runQuery(
          `INSERT INTO parking_spots (
            owner_username, location, coordinates, price, 
            description, status, contact
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            spot.owner_username,
            spot.location,
            spot.coordinates,
            spot.price,
            spot.description,
            spot.status,
            spot.contact
          ]
        );
      }
      console.log("测试停车场数据创建成功");
    }
  } catch (error) {
    console.error("创建测试停车场数据失败:", error);
  }
}

// 关闭数据库连接
function closeDB() {
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('关闭数据库连接失败:', err.message);
      } else {
        console.log('数据库连接已关闭');
      }
    });
    db = null;
  }
}

function getDB() {
  if (!db) {
    connectDB();
  }
  return db;
}

module.exports = {
  db: getDB,
  connectDB,
  closeDB
}; 