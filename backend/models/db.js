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
  // 首先检查是否已有停车位数据
  const existingSpots = await new Promise((resolve, reject) => {
    db.get("SELECT COUNT(*) as count FROM parking_spots", (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  // 如果已有数据，则不重新创建
  if (existingSpots && existingSpots.count > 0) {
    console.log(`数据库中已有${existingSpots.count}个停车位数据，跳过创建测试数据`);
    return;
  }

  // 定义一些基础数据用于随机组合
  const districts = [
    { name: '浦东新区', coordinates: ['31.2197,121.5440', '31.2297,121.5340', '31.2397,121.5240'] },
    { name: '徐汇区', coordinates: ['31.1847,121.4372', '31.1947,121.4272', '31.2047,121.4172'] },
    { name: '静安区', coordinates: ['31.2204,121.4737', '31.2304,121.4637', '31.2404,121.4537'] },
    { name: '黄浦区', coordinates: ['31.2204,121.4837', '31.2304,121.4737', '31.2404,121.4637'] },
    { name: '长宁区', coordinates: ['31.2204,121.4237', '31.2304,121.4137', '31.2404,121.4037'] },
    { name: '虹口区', coordinates: ['31.2604,121.4837', '31.2704,121.4737', '31.2804,121.4637'] },
    { name: '杨浦区', coordinates: ['31.2907,121.5185', '31.3007,121.5085', '31.3107,121.4985'] },
    { name: '普陀区', coordinates: ['31.2504,121.4237', '31.2604,121.4137', '31.2704,121.4037'] }
  ];

  const locations = {
    '浦东新区': ['陆家嘴环路', '张杨路', '世纪大道', '金科路', '川沙路'],
    '徐汇区': ['虹桥路', '衡山路', '天钥桥路', '龙华路', '肇嘉浜路'],
    '静安区': ['南京西路', '延安中路', '威海路', '成都北路', '北京西路'],
    '黄浦区': ['人民大道', '南京东路', '西藏中路', '福州路', '中山东路'],
    '长宁区': ['天山路', '娄山关路', '遵义路', '仙霞路', '延安西路'],
    '虹口区': ['四川北路', '大连路', '临平路', '海伦路', '四平路'],
    '杨浦区': ['控江路', '淞沪路', '杨树浦路', '黄兴路', '军工路'],
    '普陀区': ['真北路', '曹杨路', '武宁路', '长寿路', '金沙江路']
  };

  const descriptions = [
    '地铁站附近，交通便利',
    '商圈中心，购物方便',
    '小区内部停车位，安全可靠',
    '办公楼下停车场，适合上班族',
    '医院附近停车位，方便就医',
    '学校周边停车场，接送方便',
    '商场地下停车场，购物方便',
    '住宅区停车位，24小时保安',
    '酒店停车场，配套设施完善',
    '公园旁停车场，环境优美'
  ];

  // 定义一些常见的开放时段
  const openingHoursList = [
    '00:00-23:59',
    '06:00-22:00',
    '07:00-21:00',
    '08:00-20:00',
    '09:00-18:00',
    '10:00-22:00',
    '07:30-23:30'
  ];

  const testSpots = [];
  let spotId = 1;

  // 为每个区域生成多个停车位
  districts.forEach(district => {
    locations[district.name].forEach((street, streetIndex) => {
      // 为每条街道生成2-3个停车位
      const spotsCount = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < spotsCount; i++) {
        const buildingNumber = Math.floor(Math.random() * 2000) + 1;
        const hourlyRate = Math.floor(Math.random() * 15) + 5; // 5-20元每小时
        const description = descriptions[Math.floor(Math.random() * descriptions.length)];
        const coordinates = district.coordinates[Math.floor(Math.random() * district.coordinates.length)];
        const opening_hours = openingHoursList[Math.floor(Math.random() * openingHoursList.length)];
        
        testSpots.push({
          owner_username: 'admin',
          location: `上海市${district.name}${street}${buildingNumber}号`,
          coordinates: coordinates,
          price: hourlyRate,
          hourly_rate: hourlyRate,
          description: `${description}，位于${district.name}${street}，周边配套齐全`,
          status: 'available',
          contact: `1380013${(8000 + spotId).toString().padStart(4, '0')}`,
          current_user_id: null,
          opening_hours: opening_hours
        });
        
        spotId++;
      }
    });
  });

  try {
    // 清空现有数据
    await runQuery("DELETE FROM parking_spots");
    
    // 重置自增ID
    await runQuery("DELETE FROM sqlite_sequence WHERE name='parking_spots'");

    // 插入新数据
    for (const spot of testSpots) {
      await runQuery(
        `INSERT INTO parking_spots (
          owner_username, location, coordinates, price, 
          description, status, contact, hourly_rate,
          current_user_id, opening_hours
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          spot.owner_username,
          spot.location,
          spot.coordinates,
          spot.price,
          spot.description,
          spot.status,
          spot.contact,
          spot.hourly_rate,
          spot.current_user_id,
          spot.opening_hours
        ]
      );
    }
    console.log(`成功创建${testSpots.length}个测试停车场数据`);
  } catch (error) {
    console.error("创建测试停车场数据失败:", error);
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