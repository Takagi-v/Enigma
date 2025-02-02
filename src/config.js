// 创建配置文件
const config = {
  API_URL: process.env.NODE_ENV === 'production' 
    ? 'https://139.196.36.100/api'
    : 'http://localhost:3002/api',  // 确保端口与后端一致
  WS_URL: process.env.NODE_ENV === 'production'
    ? 'wss://139.196.36.100/ws'
    : 'ws://localhost:3002/ws',
  UPLOAD_URL: process.env.NODE_ENV === 'production'
    ? 'https://139.196.36.100/uploads'
    : 'http://localhost:3002/uploads'
};

export default config; 