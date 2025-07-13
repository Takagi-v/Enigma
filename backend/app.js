require('dotenv').config({override: true});
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const cron = require('node-cron');
const serverConfig = require('./config/server');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const { db, get, all, run } = require('./models/db');
const parkingLockService = require('./services/parkingLockService');

// API 路由导入
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const parkingRouter = require('./routes/parking');
const parkingUsageRouter = require('./routes/parking-usage');
const messagesRouter = require('./routes/messages');
const adminRouter = require('./routes/admin');
const couponsRouter = require('./routes/coupons');
const paymentRoutes = require('./routes/payment');
const parkingLockRouter = require('./routes/parkingLock');

const app = express();

// CORS配置
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.NODE_ENV === 'production' 
      ? ['https://www.goparkme.com']
      : ['http://localhost:5050', 'http://localhost:3002', 'https://www.goparkme.com'];
      
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// 1. 基础中间件配置
app.use(cookieParser());
app.use(cors(corsOptions));

// 确保在任何body parser之前处理webhook
app.use('/api/payment/webhook', express.raw({type: 'application/json'}));

// 其他路由使用JSON parser
app.use(express.json());

// 处理预检请求的中间件
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin;
    const allowedOrigins = process.env.NODE_ENV === 'production' 
      ? ['https://www.goparkme.com']
      : ['http://localhost:5050', 'http://localhost:3002', 'https://www.goparkme.com'];
      
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.status(200).send();
      return;
    }
  }
  next();
});

// 设置安全相关的响应头
app.use((req, res, next) => {
  res.set({
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  });
  next();
});

// 3. API 请求日志
app.use('/api', (req, res, next) => {
  console.log(`API Request: ${req.method} ${req.url}`);
  next();
});

// 4. API 路由处理
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/parking-spots', parkingRouter);
app.use('/api/parking-spots/usage', parkingUsageRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/admin', adminRouter);
app.use('/api/coupons', couponsRouter);
app.use('/api/payment', paymentRoutes);
app.use('/api/parking-locks', parkingLockRouter);

// 5. 静态文件服务（放在 API 路由之后）
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(serverConfig.staticPath));

// 6. 前端路由处理
app.get('*', (req, res) => {
  res.sendFile(path.join(serverConfig.staticPath, 'index.html'));
});

// 7. 错误处理
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ 
    message: '服务器内部错误',
    code: 'SERVER_ERROR',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// --- 后台定时任务 ---

/**
 * @name 地锁自动关闭定时任务
 * @description 该定时任务每分钟运行一次，用于处理已结束但地锁尚未升起的停车记录。
 *
 * 核心逻辑:
 * 1. 从数据库中查询所有 `lock_closure_status` 为 'pending_close' 的停车记录。
 *    这些记录表示用户已在App上结束计费，但系统需要确认车辆已离开才能升起地锁。
 * 2. 遍历这些记录，并调用地锁API查询其状态。
 * 3. 如果地锁API返回 "无车" (carStatus.code === 2)，则执行以下操作:
 *    a. 发送指令升起地锁。
 *    b. 如果升锁成功，则在一个数据库事务中：
 *       - 将停车记录的 `lock_closure_status` 更新为 'completed'。
 *       - 将车位的状态 `status` 更新为 'available'，并清空 `current_user_id`。
 * 4. 如果地锁API返回 "有车" 或查询失败，则跳过，等待下一分钟的检查。
 */
cron.schedule('* * * * *', async () => {
  console.log('【定时任务】开始检查待处理的地锁...');
  
  try {
    // 1. 查找所有等待关闭的地锁记录
    const pendingLocks = await all(
      `SELECT pu.id as usage_id, ps.id as spot_id, ps.lock_serial_number
       FROM parking_usage pu
       JOIN parking_spots ps ON pu.parking_spot_id = ps.id
       WHERE pu.lock_closure_status = 'pending_close'`
    );

    if (pendingLocks.length === 0) {
      // console.log('【定时任务】没有需要处理的地锁。'); // 在没有任务时，减少不必要的日志输出
      return;
    }

    console.log(`【定时任务】发现 ${pendingLocks.length} 个待处理的地锁。`);

    // 2. 遍历每一个待处理的地锁
    for (const lock of pendingLocks) {
      console.log(`【定时任务】处理地锁: ${lock.lock_serial_number} (停车记录ID: ${lock.usage_id})`);
      try {
        // 3. 查询地锁硬件状态，确认车辆是否已离开
        const status = await parkingLockService.getDeviceStatus(lock.lock_serial_number);

        // carStatus: 1=有车, 2=无车。确认车辆已离开。
        if (status && status.success && status.carStatus.code === 2) {
          console.log(` - 车辆已离开地锁 ${lock.lock_serial_number}，发送关锁指令...`);
          
          // 4. 发送关闭（升起）地锁的指令
          const closeResult = await parkingLockService.closeLock(lock.lock_serial_number);
          
          if (closeResult && closeResult.success) {
            // 5. 使用事务确保数据一致性
            await run("BEGIN TRANSACTION");
            // a. 更新停车记录的状态为“已完成”
            await run(`UPDATE parking_usage SET lock_closure_status = 'completed' WHERE id = ?`, [lock.usage_id]);
            // b. 释放车位，使其可被其他用户使用
            await run(`UPDATE parking_spots SET status = 'available', current_user_id = NULL WHERE id = ?`, [lock.spot_id]);
            await run("COMMIT");

            console.log(` - 地锁 ${lock.lock_serial_number} 已成功关闭，车位 ${lock.spot_id} 已释放。`);
          } else {
            console.error(` - 关锁指令失败: ${closeResult.message || '未知错误'}`);
          }
        } else {
          // 车辆仍在，或查询状态失败，等待下一次轮询
          console.log(` - 车辆仍在车位上或无法获取地锁状态: ${lock.lock_serial_number}`);
        }
      } catch (error) {
        // 捕获单个地锁处理过程中的错误，防止整个定时任务中断
        console.error(`【定时任务】处理地锁 ${lock.lock_serial_number} 时出错:`, error);
      }
    }
  } catch (error) {
    console.error('【定时任务】执行失败:', error);
  }
});


module.exports = app; 