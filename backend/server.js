const https = require("https");
const fs = require('fs');
const path = require("path");
const WebSocket = require("ws");
const serverConfig = require('./config/server');
const { connectDB, closeDB } = require('./models/db');
const http = require('http');
const app = require('./app');

// 创建 HTTP 服务器
const server = http.createServer(app);

// WebSocket 服务器配置
const wss = new WebSocket.Server({ server });

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
const gracefulShutdown = () => {
  console.info('Received shutdown signal.');
  server.close(() => {
    console.log('Server closed.');
    closeDB();
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// 启动服务器
server.listen(serverConfig.port, '0.0.0.0', () => {
  console.log(`Server running on:
- HTTP: http://${serverConfig.domain}:${serverConfig.port}
- WebSocket: ws://${serverConfig.domain}:${serverConfig.port}
- Environment: ${process.env.NODE_ENV || 'development'}
- Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5050'}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${serverConfig.port} is already in use.`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
}); 