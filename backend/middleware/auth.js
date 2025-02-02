const jwt = require('jsonwebtoken');
const { db } = require('../models/db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const authenticateToken = async (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: '未授权访问' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 从数据库获取用户信息
    db().get(
      "SELECT id, username, full_name, phone, avatar, bio, address FROM users WHERE id = ?",
      [decoded.id],
      (err, user) => {
        if (err || !user) {
          return res.status(401).json({ message: '未授权访问' });
        }

        req.user = {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          phone: user.phone,
          avatar: user.avatar,
          bio: user.bio,
          address: user.address
        };
        next();
      }
    );
  } catch (error) {
    return res.status(401).json({ message: '未授权访问' });
  }
};

module.exports = { authenticateToken }; 