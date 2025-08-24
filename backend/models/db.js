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
  const runMigrations = async () => {
    const dbInstance = getDB();

    const checkAndAddColumn = async (tableName, columnName, columnDefinition) => {
      const columns = await new Promise((resolve, reject) => {
        dbInstance.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
          if (err) reject(err);
          else resolve(rows ? rows.map(r => r.name) : []);
        });
      });

      if (!columns.includes(columnName)) {
        console.log(`Migrating ${tableName}: adding column ${columnName}`);
        await new Promise((resolve, reject) => {
          dbInstance.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
    };

    try {
      // users table
      await checkAndAddColumn('users', 'vehicle_model', 'TEXT');
      await checkAndAddColumn('users', 'updated_at', 'DATETIME');
      await checkAndAddColumn('users', 'balance', 'REAL DEFAULT 0');
      await checkAndAddColumn('users', 'google_id', 'TEXT UNIQUE');
      await checkAndAddColumn('users', 'bio', 'TEXT DEFAULT "该用户很神秘"');
      await checkAndAddColumn('users', 'address', 'TEXT');
      await checkAndAddColumn('users', 'vehicle_plate', 'TEXT UNIQUE');

      // parking_spots table
      await checkAndAddColumn('parking_spots', 'updated_at', 'DATETIME');
      await checkAndAddColumn('parking_spots', 'opening_hours', 'TEXT DEFAULT "00:00-23:59"');
      await checkAndAddColumn('parking_spots', 'lock_serial_number', 'TEXT');
      await checkAndAddColumn('parking_spots', 'average_rating', 'REAL DEFAULT NULL');
      
      // parking_usage table
      await checkAndAddColumn('parking_usage', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
      await checkAndAddColumn('parking_usage', 'vehicle_plate', 'TEXT');
      await checkAndAddColumn('parking_usage', 'vehicle_type', 'TEXT');
      await checkAndAddColumn('parking_usage', 'payment_method', 'TEXT');
      await checkAndAddColumn('parking_usage', 'payment_time', 'DATETIME');
      await checkAndAddColumn('parking_usage', 'transaction_id', 'TEXT');
      await checkAndAddColumn('parking_usage', 'notes', 'TEXT');
      await checkAndAddColumn('parking_usage', 'rating', 'INTEGER CHECK (rating >= 1 AND rating <= 5)');
      await checkAndAddColumn('parking_usage', 'review_comment', 'TEXT');
      await checkAndAddColumn('parking_usage', 'review_time', 'DATETIME');
      await checkAndAddColumn('parking_usage', 'lock_open_status', 'TEXT DEFAULT "not_applicable"');
      await checkAndAddColumn('parking_usage', 'lock_close_status', 'TEXT DEFAULT "not_applicable"');
      await checkAndAddColumn('parking_usage', 'lock_error_message', 'TEXT');

      // coupons table
      await checkAndAddColumn('coupons', 'description', 'TEXT');

      // reservations table
      await checkAndAddColumn('reservations', 'total_amount', 'REAL');
      await checkAndAddColumn('reservations', 'payment_status', 'TEXT DEFAULT "pending"');
      await checkAndAddColumn('reservations', 'notes', 'TEXT');

      // transactions table
      await checkAndAddColumn('transactions', 'error_message', 'TEXT');

      // disputes table
      await checkAndAddColumn('disputes', 'resolved_at', 'DATETIME');

      console.log('数据库迁移检查完成');
    } catch (error) {
      console.error('数据库迁移失败:', error);
    }
  };

  await runMigrations();

  // 创建默认管理员账号
  await createDefaultAdmin();
  
  // 只有在需要创建测试数据时才执行
  if (createTestData) {
    // 创建测试用户
    await createTestUsers();
    // 创建测试停车场数据
    await createTestParkingSpots();
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
  const users = await all("SELECT username FROM users");
  if (users.length === 0) {
    console.log("没有用户数据，无法创建测试停车位");
    return;
  }
  const owners = users.map(u => u.username);

  const shanghai = { 
    name: '上海', 
    lat: 31.2304, 
    lng: 121.4737, 
    districts: ['黄浦区', '徐汇区', '长宁区', '静安区', '普陀区', '虹口区', '杨浦区', '浦东新区'] 
  };
  
  const openingHoursOptions = ['00:00-23:59', '08:00-22:00', '09:00-21:00', '24小时营业'];
  const descriptions = [
    '市中心黄金地段，交通便利，购物方便。',
    '安静小区内，适合长期租用，安全性高。',
    '靠近地铁站，出行方便，适合上班族。',
    '大型商场地下停车场，车位充足，监控覆盖。',
    '写字楼专属车位，管理规范，环境整洁。'
  ];

  const testSpots = [];

  for (let i = 0; i < 20; i++) {
    const district = shanghai.districts[Math.floor(Math.random() * shanghai.districts.length)];
    const deltaLat = (Math.random() - 0.5) * 0.05; // 缩小范围，更集中于上海市区
    const deltaLng = (Math.random() - 0.5) * 0.05;

    testSpots.push({
      owner_username: owners[Math.floor(Math.random() * owners.length)],
      location: `${shanghai.name}市${district}-测试车位-${i + 1}`,
      coordinates: `${(shanghai.lat + deltaLat).toFixed(6)},${(shanghai.lng + deltaLng).toFixed(6)}`,
      price: parseFloat((8 + Math.random() * 12).toFixed(2)),
      description: descriptions[Math.floor(Math.random() * descriptions.length)],
      status: 'available', // 所有车位状态均为 aponvailable
      hourly_rate: parseFloat((10 + Math.random() * 5).toFixed(2)),
      contact: '138' + Math.floor(10000000 + Math.random() * 90000000), // 随机手机号
      opening_hours: openingHoursOptions[Math.floor(Math.random() * openingHoursOptions.length)],
      lock_serial_number: null 
    });
  }

  for (const spot of testSpots) {
    try {
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