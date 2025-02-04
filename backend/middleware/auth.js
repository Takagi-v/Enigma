const jwt = require('jsonwebtoken');
const { db } = require('../models/db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const authenticateToken = async (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ 
      message: '请先登录',
      code: 'AUTH_REQUIRED'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 从数据库获取用户信息
    db().get(
      `SELECT id, username, email, full_name, phone, avatar, bio, address 
       FROM users WHERE id = ?`,
      [decoded.id],
      (err, user) => {
        if (err) {
          console.error('数据库查询错误:', err);
          return res.status(500).json({ 
            message: '服务器错误',
            code: 'SERVER_ERROR'
          });
        }

        if (!user) {
          return res.status(401).json({ 
            message: '用户不存在',
            code: 'USER_NOT_FOUND'
          });
        }

        // 将用户信息添加到请求对象
        req.user = {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.full_name,
          phone: user.phone,
          avatar: user.avatar,
          bio: user.bio,
          address: user.address
        };

        // 将解码后的token信息也添加到请求对象
        req.token = decoded;
        
        next();
      }
    );
  } catch (error) {
    console.error('Token验证错误:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: '登录已过期，请重新登录',
        code: 'TOKEN_EXPIRED'
      });
    }
    return res.status(401).json({ 
      message: '认证失败，请重新登录',
      code: 'AUTH_FAILED'
    });
  }
};

// 检查用户是否有权限访问特定用户的数据
const checkUserAccess = (req, res, next) => {
  const { username } = req.params;
  
  if (username !== req.user.username) {
    return res.status(403).json({ 
      message: '无权访问其他用户的信息',
      code: 'ACCESS_DENIED'
    });
  }
  
  next();
};

// 管理员认证中间件
const authenticateAdmin = async (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ 
      message: '请先登录',
      code: 'AUTH_REQUIRED'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 从数据库获取管理员信息
    db().get(
      "SELECT * FROM admins WHERE id = ?",
      [decoded.id],
      (err, admin) => {
        if (err) {
          console.error('数据库查询错误:', err);
          return res.status(500).json({ 
            message: '服务器错误',
            code: 'SERVER_ERROR'
          });
        }

        if (!admin) {
          return res.status(403).json({ 
            message: '需要管理员权限',
            code: 'ADMIN_REQUIRED'
          });
        }

        // 将管理员信息添加到请求对象
        req.admin = admin;
        next();
      }
    );
  } catch (error) {
    console.error('Token验证错误:', error);
    return res.status(401).json({ 
      message: '认证失败，请重新登录',
      code: 'AUTH_FAILED'
    });
  }
};

module.exports = { 
  authenticateToken,
  checkUserAccess,
  authenticateAdmin
}; 