require('dotenv').config({override: true});
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const serverConfig = require('./config/server');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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

module.exports = app; 