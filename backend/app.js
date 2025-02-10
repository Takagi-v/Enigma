require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const serverConfig = require('./config/server');

const app = express();

// 1. 基础中间件配置
app.use(cookieParser());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5050',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Allow-Headers',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['Set-Cookie'],
  optionsSuccessStatus: 200
}));

// 2. API 路由导入
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const parkingRouter = require('./routes/parking');
const parkingUsageRouter = require('./routes/parking-usage');
const messagesRouter = require('./routes/messages');
const adminRouter = require('./routes/admin');
const couponsRouter = require('./routes/coupons');
const paymentRoutes = require('./routes/payment');
const webhookRoutes = require('./routes/webhook');

// 3. API 请求日志
app.use('/api', (req, res, next) => {
  console.log(`API Request: ${req.method} ${req.url}`);
  next();
});

// 4. API 路由处理
// Webhook 路由（使用 raw parser）
app.use('/api/webhook', express.raw({ type: 'application/json' }));
app.use('/api/webhook', webhookRoutes);

// 其他 API 路由（使用 JSON parser）
app.use('/api', express.json());
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/parking-spots/usage', parkingUsageRouter);
app.use('/api/parking-spots', parkingRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/admin', adminRouter);
app.use('/api/coupons', couponsRouter);
app.use('/api/payment', paymentRoutes);

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