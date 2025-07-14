const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

let db = null;

// 创建数据库连接
function connectDB() {
  if (db) {
    console.log("数据库连接已存在");
    return;
  }

  const dbPath = path.join(__dirname, '../data/parking.db');
  const dbExists = fs.existsSync(dbPath);
  
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('数据库连接错误:', err);
      return;
    }
    console.log('已连接到数据库');
    
    // 只有在数据库不存在时才创建表结构和测试数据
    if (!dbExists) {
      console.log('数据库文件不存在，创建新数据库和测试数据');
      createTables(true);
    } else {
      console.log('数据库文件已存在，仅确保表结构完整');
      createTables(false);
    }
  });
}

// 创建表
async function createTables(createTestData = false) {
  const tables = [
    // 用户表
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT,
      email TEXT UNIQUE,
      full_name TEXT,
      phone TEXT UNIQUE,
      avatar TEXT,
      bio TEXT DEFAULT '该用户很神秘',
      address TEXT,
      vehicle_plate TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      balance REAL DEFAULT 0,
      google_id TEXT UNIQUE
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
      current_user_id INTEGER,
      hourly_rate REAL NOT NULL DEFAULT 10.0,
      contact TEXT,
      average_rating REAL DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      opening_hours TEXT DEFAULT '00:00-23:59',
      lock_serial_number TEXT,
      FOREIGN KEY (owner_username) REFERENCES users(username),
      FOREIGN KEY (current_user_id) REFERENCES users(id)
    )`,
    
    // 停车场使用记录表
    `CREATE TABLE IF NOT EXISTS parking_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parking_spot_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME,
      total_amount REAL,
      payment_status TEXT DEFAULT 'pending',
      status TEXT DEFAULT 'active',
      lock_closure_status TEXT DEFAULT 'not_applicable',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      vehicle_plate TEXT,
      vehicle_type TEXT,
      payment_method TEXT,
      payment_time DATETIME,
      transaction_id TEXT,
      notes TEXT,
      rating INTEGER CHECK (rating >= 1 AND rating <= 5),
      review_comment TEXT,
      review_time DATETIME,
      FOREIGN KEY (parking_spot_id) REFERENCES parking_spots(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
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
    )`,
    
    // 评论表
    `CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parking_spot_id INTEGER,
      user_id INTEGER,
      rating INTEGER,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parking_spot_id) REFERENCES parking_spots(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,

    // 优惠券表
    `CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'coupon',
      amount REAL NOT NULL,
      status TEXT DEFAULT 'valid',
      expiry_date DATETIME,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      description TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,

    // 支付方式表
    `CREATE TABLE IF NOT EXISTS user_payment_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      stripe_customer_id TEXT NOT NULL,
      payment_method_id TEXT NOT NULL,
      payment_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id)
    )`,

    // 预定表
    `CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parking_spot_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      reservation_date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_amount REAL,
      payment_status TEXT DEFAULT 'pending',
      notes TEXT,
      FOREIGN KEY (parking_spot_id) REFERENCES parking_spots(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,

    // 交易表
    `CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_intent_id TEXT,
      status TEXT NOT NULL,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,

    // 争议表
    `CREATE TABLE IF NOT EXISTS disputes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      payment_intent_id TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
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
  
  // 只有在需要创建测试数据时才执行
  if (createTestData) {
    // 创建测试停车场数据
    await createTestParkingSpots();
    // 创建测试评论数据
    await createTestReviews();
  }
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
  const defaultUser = { username: 'testuser1', password: 'password123', email: 'testuser1@example.com', fullName: '测试用户一', phone: '13800138000' };
  try {
    const user = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM users WHERE username = ?", [defaultUser.username], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

    if (!user) {
      const hashedPassword = await bcrypt.hash(defaultUser.password, 10);
      await runQuery(`INSERT INTO users (username, password, email, full_name, phone, balance) VALUES (?, ?, ?, ?, ?, ?)`, 
        [defaultUser.username, hashedPassword, defaultUser.email, defaultUser.fullName, defaultUser.phone, 100]);
    }
  } catch (error) {
    console.error('创建测试用户失败:', error);
  }

  const testSpots = [
    {
      owner_username: 'testuser1',
      location: '123 Main St, New York, NY',
      coordinates: '40.7128,-74.0060',
      price: 15.5,
      description: '这是一个宽敞的停车位，位于市中心，交通便利。',
      status: 'available',
      hourly_rate: 15.5,
      contact: '123-456-7890',
      opening_hours: '08:00-22:00',
      lock_serial_number: 'd4c3b2a190877654' // 添加一个测试用的地锁序列号
    },
    {
      owner_username: 'testuser1',
      location: '456 Oak Ave, Los Angeles, CA',
      coordinates: '34.0522,-118.2437',
      price: 12.0,
      description: '安静的社区，靠近公园。',
          status: 'available',
      hourly_rate: 12.0,
      contact: '987-654-3210',
      opening_hours: '24/7',
      lock_serial_number: null
    }
  ];

    for (const spot of testSpots) {
    try {
      await runQuery(
        `INSERT INTO parking_spots (owner_username, location, coordinates, price, description, status, hourly_rate, contact, opening_hours, lock_serial_number) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          spot.owner_username, spot.location, spot.coordinates, spot.price,
          spot.description, spot.status, spot.hourly_rate, spot.contact,
          spot.opening_hours, spot.lock_serial_number
        ]
      );
  } catch (error) {
      if (!error.message.includes('UNIQUE constraint failed')) {
        console.error('创建测试停车位失败:', error);
      }
    }
  }
}

// 创建测试评论数据
async function createTestReviews() {
  try {
    // 首先检查是否已有评论数据
    const existingReviews = await new Promise((resolve, reject) => {
      db.get("SELECT COUNT(*) as count FROM reviews", (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    // 如果已有数据，则不重新创建
    if (existingReviews && existingReviews.count > 0) {
      console.log(`数据库中已有${existingReviews.count}条评论数据，跳过创建测试数据`);
      return;
    }

    // 清空现有评论数据
    await runQuery("DELETE FROM reviews");
    await runQuery("DELETE FROM sqlite_sequence WHERE name='reviews'");

    // 获取前10个停车场ID
    const parkingSpots = await new Promise((resolve, reject) => {
      db.all("SELECT id FROM parking_spots LIMIT 10", (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
    });

    // 获取用户列表（用于随机分配评论者）
    const users = await new Promise((resolve, reject) => {
      db.all("SELECT id FROM users", (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
    });

    if (users.length === 0) {
      console.log("没有用户数据，跳过创建测试评论");
      return;
    }

    const comments = [
      '位置很好找，停车方便',
      '价格合理，周边设施齐全',
      '保安很负责，停车很安全',
      '干净整洁，采光很好',
      '位置很好，交通便利',
      '服务态度很好，会再来',
      '停车位宽敞，好停车',
      '环境不错，性价比高',
      '位置很好，下次还会选择',
      '整体体验不错'
    ];

    const reviews = [];
    // 为每个停车场创建1-2条评论
    for (const spot of parkingSpots) {
      const reviewCount = 1 + Math.floor(Math.random() * 2); // 1或2条评论
      
      for (let i = 0; i < reviewCount; i++) {
        const userId = users[Math.floor(Math.random() * users.length)].id;
        const rating = Math.floor(Math.random() * 3) + 3; // 3-5星
        const comment = comments[Math.floor(Math.random() * comments.length)];
        
        reviews.push({
          parking_spot_id: spot.id,
          user_id: userId,
          rating,
          comment
        });
      }
    }

    // 批量插入评论
    for (const review of reviews) {
      await runQuery(
        `INSERT INTO reviews (parking_spot_id, user_id, rating, comment) 
         VALUES (?, ?, ?, ?)`,
        [review.parking_spot_id, review.user_id, review.rating, review.comment]
      );
    }

    // 更新停车场的平均评分
    await runQuery(`
      UPDATE parking_spots 
      SET average_rating = (
        SELECT AVG(rating) 
        FROM reviews 
        WHERE parking_spot_id = parking_spots.id
      )
      WHERE id IN (SELECT DISTINCT parking_spot_id FROM reviews)
    `);

    console.log(`成功创建${reviews.length}条测试评论数据`);
  } catch (error) {
    console.error("创建测试评论数据失败:", error);
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