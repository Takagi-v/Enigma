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
      vehicle_model TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME,
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
      updated_at DATETIME,
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
      lock_open_status TEXT DEFAULT 'not_applicable',
      lock_close_status TEXT DEFAULT 'not_applicable',
      lock_error_message TEXT,
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

  // 检查并添加缺失的列 (数据库迁移)
  try {
    const dbInstance = getDB();

    // 1. 检查 users 表
    const usersColumns = await new Promise((resolve, reject) => {
      dbInstance.all("PRAGMA table_info(users)", (err, rows) => {
        if (err) reject(err);
        else resolve(rows ? rows.map(r => r.name) : []);
      });
    });

    if (!usersColumns.includes('vehicle_model')) {
      console.log('Migrating users: adding column vehicle_model');
      await new Promise((resolve, reject) => {
        dbInstance.run("ALTER TABLE users ADD COLUMN vehicle_model TEXT", (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    if (!usersColumns.includes('updated_at')) {
      console.log('Migrating users: adding column updated_at');
      await new Promise((resolve, reject) => {
        dbInstance.run("ALTER TABLE users ADD COLUMN updated_at DATETIME", (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    // 2. 检查 parking_spots 表
    const parkingSpotsColumns = await new Promise((resolve, reject) => {
      dbInstance.all("PRAGMA table_info(parking_spots)", (err, rows) => {
        if (err) reject(err);
        else resolve(rows ? rows.map(r => r.name) : []);
      });
    });

    if (!parkingSpotsColumns.includes('updated_at')) {
      console.log('Migrating parking_spots: adding column updated_at');
      await new Promise((resolve, reject) => {
        dbInstance.run("ALTER TABLE parking_spots ADD COLUMN updated_at DATETIME", (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
    
    if (!parkingSpotsColumns.includes('lock_serial_number')) {
      console.log('Migrating parking_spots: adding column lock_serial_number');
      await new Promise((resolve, reject) => {
        dbInstance.run("ALTER TABLE parking_spots ADD COLUMN lock_serial_number TEXT", (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    // 3. 检查 parking_usage 表
    const parkingUsageColumns = await new Promise((resolve, reject) => {
      dbInstance.all("PRAGMA table_info(parking_usage)", (err, rows) => {
        if (err) reject(err);
        else resolve(rows ? rows.map(r => r.name) : []);
      });
    });

    if (!parkingUsageColumns.includes('lock_closure_status')) {
      console.log('Migrating parking_usage: adding column lock_closure_status');
      await new Promise((resolve, reject) => {
        dbInstance.run("ALTER TABLE parking_usage ADD COLUMN lock_closure_status TEXT DEFAULT 'not_applicable'", (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  } catch (error) {
    console.error('数据库迁移失败:', error);
  }


  // 创建默认管理员账号
  await createDefaultAdmin();
  
  // 只有在需要创建测试数据时才执行
  if (createTestData) {
    // 创建测试用户
    await createTestUsers();
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

// 创建测试用户
async function createTestUsers() {
    const testUsers = [
        { username: 'user1', password: 'password1', email: 'user1@example.com', fullName: '张三', phone: '13800138001', balance: 100 },
        { username: 'user2', password: 'password2', email: 'user2@example.com', fullName: '李四', phone: '13800138002', balance: 250 },
        { username: 'user3', password: 'password3', email: 'user3@example.com', fullName: '王五', phone: '13800138003', balance: 50 },
        { username: 'testuser1', password: 'password123', email: 'testuser1@example.com', fullName: '测试用户一', phone: '13800138000', balance: 150 },
        { username: 'owner1', password: 'password_owner', email: 'owner1@example.com', fullName: '车位主', phone: '13800138004', balance: 500 },
    ];

    console.log("--- 开始创建测试用户 ---");
    for (const userData of testUsers) {
        try {
            const user = await get("SELECT * FROM users WHERE username = ?", [userData.username]);
            if (!user) {
                const hashedPassword = await bcrypt.hash(userData.password, 10);
                await runQuery(`INSERT INTO users (username, password, email, full_name, phone, balance) VALUES (?, ?, ?, ?, ?, ?)`, 
                    [userData.username, hashedPassword, userData.email, userData.fullName, userData.phone, userData.balance]);
                
                // 在控制台输出明文密码
                console.log(`用户: ${userData.username}, 密码: ${userData.password}`);
            }
        } catch (error) {
            if (!error.message.includes('UNIQUE constraint failed')) {
                console.error(`创建测试用户 ${userData.username} 失败:`, error);
            }
        }
    }
    console.log("--- 测试用户创建完成 ---");
}

// 创建测试停车场数据
async function createTestParkingSpots() {
  const testSpots = [];
  const baseLat = 31.2304;
  const baseLng = 121.4737;

  for (let i = 0; i < 20; i++) {
    const deltaLat = (Math.random() - 0.5) * 0.1;
    const deltaLng = (Math.random() - 0.5) * 0.1;
    testSpots.push({
      owner_username: 'owner1', // 所有车位都归属于 owner1
      location: `上海市黄浦区-测试车位-${i + 1}`,
      coordinates: `${(baseLat + deltaLat).toFixed(6)},${(baseLng + deltaLng).toFixed(6)}`,
      price: parseFloat((8 + Math.random() * 12).toFixed(2)),
      description: `这是一个位于上海市中心的示例停车位 #${i + 1}，方便测试使用。`,
      status: 'available',
      hourly_rate: parseFloat((10 + Math.random() * 5).toFixed(2)),
      contact: '13800138004',
      opening_hours: '00:00-23:59',
      lock_serial_number: i % 4 === 0 ? `SH-LOCK-${1000 + i}` : null // 每4个车位有一个地锁
    });
  }

  for (const spot of testSpots) {
    try {
      // 检查是否已存在
      const existingSpot = await get("SELECT id FROM parking_spots WHERE location = ?", [spot.location]);
      if (!existingSpot) {
          await runQuery(
            `INSERT INTO parking_spots (owner_username, location, coordinates, price, description, status, hourly_rate, contact, opening_hours, lock_serial_number) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              spot.owner_username, spot.location, spot.coordinates, spot.price,
              spot.description, spot.status, spot.hourly_rate, spot.contact,
              spot.opening_hours, spot.lock_serial_number
            ]
          );
      }
    } catch (error) {
      if (!error.message.includes('UNIQUE constraint failed')) {
        console.error('创建测试停车位失败:', error);
      }
    }
  }
   console.log("测试停车位数据生成完毕。");
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

async function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDB().get(sql, params, (err, row) => {
        if (err) {
            reject(err);
        } else {
            resolve(row);
        }
    });
  });
}

async function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        getDB().all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

module.exports = {
  db: getDB,
  connectDB,
  closeDB,
  get,
  all,
  runQuery
}; 