const path = require('path');
// 加载环境变量
require('dotenv').config();

const config = {
  port: process.env.PORT || 3002,
  domain: process.env.DOMAIN || 'localhost',
  corsOrigin: process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? 'https://www.goparkme.com' : 'http://localhost:5050'),
  staticPath: path.join(__dirname, '..', '..', 'public'),
  uploadDir: path.join(__dirname, '../uploads'),
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  ssl: {
    key: path.join(__dirname, '..', 'ssl', 'nginx.key'),
    cert: path.join(__dirname, '..', 'ssl', 'nginx.crt')
  },
  corsOptions: {
    origin: process.env.FRONTEND_URL || 'https://www.goparkme.com',
    credentials: true
  }
};

module.exports = config;