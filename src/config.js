// 创建配置文件
const config = {
  API_URL: process.env.NODE_ENV === 'production' 
    ? 'https://www.goparkme.com/api'
    : 'http://localhost:3002/api',
  WS_URL: process.env.NODE_ENV === 'production'
    ? 'wss://www.goparkme.com/ws'
    : 'ws://localhost:3002/ws',
  UPLOAD_URL: process.env.NODE_ENV === 'production'
    ? 'https://www.goparkme.com/uploads'
    : 'http://localhost:3002/uploads',
  COOKIE_DOMAIN: process.env.NODE_ENV === 'production'
    ? 'www.goparkme.com'
    : 'localhost',
  COOKIE_SECURE: true,  // 启用 secure，只允许 HTTPS 使用 cookie
  COOKIE_SAMESITE: 'none',  // 保持关闭 samesite 限制
  GOOGLE_CLIENT_ID: process.env.REACT_APP_GOOGLE_CLIENT_ID || '' // 从环境变量获取Google Client ID
};

export default config; 