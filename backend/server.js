const http = require("http");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const WebSocket = require("ws");
const path = require("path");
const fs = require('fs');

// 导入配置
const serverConfig = require('./config/server');
const { connectDB, closeDB } = require('./models/db');

// 导入路由
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const parkingRouter = require('./routes/parking');
const messagesRouter = require('./routes/messages');
const usersRouter = require('./routes/users');

// 创建应用
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 中间件配置
app.use(bodyParser.json());
app.use(cors({
  origin: serverConfig.corsOrigin,
  credentials: true,
}));

// 静态文件服务 - 移到API路由之前
app.use('/uploads', express.static(serverConfig.uploadDir));
app.use(express.static(serverConfig.staticPath));

// API 路由前缀
app.use('/api', (req, res, next) => {
  console.log(`API Request: ${req.method} ${req.url}`);
  next();
});

// 注册API路由
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/parking-spots', parkingRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/users', usersRouter);

// WebSocket 连接处理
wss.on("connection", (ws) => {
  console.log("New client connected");

  ws.on("message", (message) => {
    console.log("Received:", message);
    // 广播消息给所有客户端
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});

// 测试路由
app.get("/test", (req, res) => {
  res.json({ 
    message: "Server is running",
    env: process.env.NODE_ENV,
    staticPath: serverConfig.staticPath
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ 
    message: "服务器内部错误",
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 处理前端路由 - 保持在最后
app.get('*', (req, res) => {
  res.sendFile(path.join(serverConfig.staticPath, 'index.html'));
});

// 确保上传目录存在
fs.mkdir(serverConfig.uploadDir, { recursive: true }, (err) => {
  if (err) {
    console.error('Error creating uploads directory:', err);
    process.exit(1);
  }
});

// 连接数据库
connectDB();

// 优雅关闭
process.on('SIGTERM', () => {
  console.info('SIGTERM signal received.');
  server.close(() => {
    console.log('Server closed.');
    closeDB();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.info('SIGINT signal received.');
  server.close(() => {
    console.log('Server closed.');
    closeDB();
    process.exit(0);
  });
});

// 启动服务器
server.listen(serverConfig.port, '0.0.0.0', () => {
  console.log(`Server running on:\n- HTTP: http://localhost:${serverConfig.port}\n- WebSocket: ws://localhost:${serverConfig.port}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${serverConfig.port} is already in use.`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
}); 