const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const serverConfig = require('./config/server');

const app = express();

// CORS 配置
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

// 中间件配置
app.use(express.json());
app.use(cookieParser());

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(serverConfig.staticPath));

// API 请求日志
app.use('/api', (req, res, next) => {
  console.log(`API Request: ${req.method} ${req.url}`);
  next();
});

// 路由
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const parkingRouter = require('./routes/parking');
const parkingUsageRouter = require('./routes/parking-usage');
const messagesRouter = require('./routes/messages');
const adminRouter = require('./routes/admin');

// API 路由注册
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/parking-spots/usage', parkingUsageRouter); // 注意：这个要放在 parkingRouter 前面
app.use('/api/parking-spots', parkingRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/admin', adminRouter);

// 处理前端路由 - 保持在最后
app.get('*', (req, res) => {
  res.sendFile(path.join(serverConfig.staticPath, 'index.html'));
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ 
    message: '服务器内部错误',
    code: 'SERVER_ERROR',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = app; 