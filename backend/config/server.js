const path = require('path');

const config = {
  port: process.env.PORT || 3002,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5050',
  staticPath: path.join(__dirname, '..', '..', 'public'),
  uploadDir: path.join(__dirname, '..', 'uploads'),
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key'
};

module.exports = config; 