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
      current_user_id INTEGER,
      hourly_rate REAL NOT NULL DEFAULT 10.0,
      contact TEXT,
      average_rating REAL DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
        
        testSpots.push({
          owner_username: 'admin',
          location: `上海市${district.name}${street}${buildingNumber}号`,
          coordinates: coordinates,
          price: hourlyRate,
          hourly_rate: hourlyRate,
          description: `${description}，位于${district.name}${street}，周边配套齐全`,
          status: 'available',
          contact: `1380013${(8000 + spotId).toString().padStart(4, '0')}`,
          current_user_id: null
        });
        
        spotId++;
      }
    });
  });

  try {
    // 清空现有数据
    await runQuery("DELETE FROM parking_spots");
    await runQuery("DELETE FROM parking_usage");
    
    // 重置自增ID
    await runQuery("DELETE FROM sqlite_sequence WHERE name='parking_spots'");
    await runQuery("DELETE FROM sqlite_sequence WHERE name='parking_usage'");

    // 插入新数据
    for (const spot of testSpots) {
      await runQuery(
        `INSERT INTO parking_spots (
          owner_username, location, coordinates, price, 
          description, status, contact, hourly_rate,
          current_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          spot.owner_username,
          spot.location,
          spot.coordinates,
          spot.price,
          spot.description,
          spot.status,
          spot.contact,
          spot.hourly_rate,
          spot.current_user_id
        ]
      );
    }
    console.log(`成功创建${testSpots.length}个测试停车场数据`);
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