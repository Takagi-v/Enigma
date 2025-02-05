const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { db } = require('../models/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const serverConfig = require('../config/server');

// JWT密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Cookie 配置
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 24 * 60 * 60 * 1000, // 24小时
  path: '/'
};

// 配置文件上传
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    try {
      await fs.mkdir(serverConfig.uploadDir, { recursive: true });
      cb(null, serverConfig.uploadDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('不支持的文件类型'), false);
  }
};

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: fileFilter
});

// 注册路由
router.post("/register", async (req, res) => {
  const { username, password, full_name, phone, avatar, bio, address } = req.body;

  if (!username || !password || !full_name || !phone) {
    return res.status(400).json({ message: "必填信息不能为空" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 如果avatar是base64格式，需要先保存为文件
    let avatarUrl = avatar;
    if (avatar && avatar.startsWith('data:image')) {
      const matches = avatar.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const imageBuffer = Buffer.from(matches[2], 'base64');
        const fileExtension = matches[1].replace('+', '');
        const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}.${fileExtension}`;
        const filePath = path.join(serverConfig.uploadDir, fileName);
        
        await fs.mkdir(serverConfig.uploadDir, { recursive: true });
        await fs.writeFile(filePath, imageBuffer);
        
        const baseUrl = process.env.NODE_ENV === 'production'
          ? `https://139.196.36.100:${serverConfig.port}`
          : `http://localhost:${serverConfig.port}`;
        avatarUrl = `${baseUrl}/uploads/${fileName}`;
      }
    }
    
    db().run(
      `INSERT INTO users (username, password, full_name, phone, avatar, bio, address) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [username, hashedPassword, full_name, phone, avatarUrl, bio || '该用户很神秘', address || ''],
      async function(err) {
        if (err) {
          if (err.message.includes("UNIQUE constraint failed")) {
            return res.status(400).json({ message: "用户名已存在" });
          }
          return res.status(500).json({ message: "创建用户失败" });
        }

        // 为新用户创建优惠券
        try {
          const userId = this.lastID;
          const expiryDate = new Date();
          expiryDate.setMonth(expiryDate.getMonth() + 1);

          await new Promise((resolve, reject) => {
            db().run(
              `INSERT INTO coupons (user_id, amount, status, expiry_date, description) 
               VALUES (?, ?, ?, ?, ?)`,
              [userId, 5.0, 'valid', expiryDate.toISOString(), '新用户注册优惠券'],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });

          res.status(201).json({ message: "注册成功，已发放新用户优惠券" });
        } catch (error) {
          console.error('创建优惠券失败:', error);
          res.status(201).json({ message: "注册成功，但优惠券创建失败" });
        }
      }
    );
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ message: "创建用户失败" });
  }
});

// 登录路由
router.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "用户名和密码不能为空" });
  }

  db().get(
    "SELECT * FROM users WHERE username = ?",
    [username],
    async (err, user) => {
      if (err) {
        return res.status(500).json({ message: "登录过程中出错" });
      }
      
      if (!user) {
        return res.status(401).json({ message: "用户名或密码错误" });
      }

      try {
        const match = await bcrypt.compare(password, user.password);
        if (match) {
          // 生成JWT token
          const token = jwt.sign(
            { 
              id: user.id,
              username: user.username
            },
            JWT_SECRET,
            { expiresIn: '24h' }
          );

          // 设置 HttpOnly Cookie
          res.cookie('token', token, COOKIE_OPTIONS);

          // 返回用户信息（不包含密码）
          const { password: _, ...userWithoutPassword } = user;
          
          res.json({ 
            message: "登录成功",
            isAuthenticated: true,
            user: {
              id: user.id,
              username: user.username,
              fullName: user.full_name,
              phone: user.phone,
              avatar: user.avatar,
              bio: user.bio,
              address: user.address,
              email: user.email
            }
          });
        } else {
          res.status(401).json({ message: "用户名或密码错误" });
        }
      } catch (error) {
        res.status(500).json({ message: "登录过程中出错" });
      }
    }
  );
});

// 头像上传路由
router.post('/upload-avatar', upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '没有上传文件' });
    }

    const baseUrl = process.env.NODE_ENV === 'production'
      ? `https://139.196.36.100:${serverConfig.port}`
      : `http://localhost:${serverConfig.port}`;

    const avatarUrl = `${baseUrl}/uploads/${req.file.filename}`;

    res.json({
      message: '头像上传成功',
      avatarUrl: avatarUrl
    });
  } catch (error) {
    console.error('头像上传错误:', error);
    res.status(500).json({ message: '头像上传失败' });
  }
});

// 验证登录状态的路由
router.get('/status', async (req, res) => {
  try {
    const token = req.cookies.token;
    
    if (!token) {
      return res.status(401).json({ isAuthenticated: false });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 从数据库获取最新的用户信息
    db().get(
      "SELECT id, username, full_name, phone, avatar, bio, address, email FROM users WHERE id = ?",
      [decoded.id],
      (err, user) => {
        if (err || !user) {
          return res.status(401).json({ isAuthenticated: false });
        }

        res.json({
          isAuthenticated: true,
          user: {
            id: user.id,
            username: user.username,
            fullName: user.full_name,
            phone: user.phone,
            avatar: user.avatar,
            bio: user.bio,
            address: user.address,
            email: user.email
          }
        });
      }
    );
  } catch (error) {
    res.status(401).json({ isAuthenticated: false });
  }
});

// 登出路由
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    ...COOKIE_OPTIONS,
    maxAge: 0
  });
  res.json({ message: '登出成功' });
});

// Token 检查路由
router.get('/check-token', (req, res) => {
  try {
    const token = req.cookies.token;
    console.log('收到的 token:', token);
    
    if (!token) {
      console.log('没有收到 token');
      return res.status(401).json({ 
        status: 'error',
        message: 'No token found',
        cookiesReceived: req.cookies 
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('解码后的 token 信息:', decoded);

    res.json({ 
      status: 'success',
      tokenInfo: {
        userId: decoded.id,
        username: decoded.username,
        expiresAt: new Date(decoded.exp * 1000).toISOString()
      },
      cookiesReceived: req.cookies
    });
  } catch (error) {
    console.error('Token 验证错误:', error);
    res.status(401).json({ 
      status: 'error',
      message: error.message,
      cookiesReceived: req.cookies 
    });
  }
});

module.exports = router; 