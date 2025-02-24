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
  secure: process.env.NODE_ENV === 'production',  // 开发环境下设为 false
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 86400 * 1000,
  path: '/',
  ...(process.env.NODE_ENV === 'production' 
    ? { domain: 'www.goparkme.com' }
    : {})  // 本地开发环境不设置 domain
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
    
    await db().run(
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

        // 赠送 20 美元余额
        const giftBalance = 20;
        await db().run(
          `INSERT INTO coupons (user_id, type, amount, description) 
           VALUES (?, 'gift_balance', ?, '新用户注册赠送余额')`,
          [this.lastID, giftBalance]
        );

        res.status(201).json({ message: "注册成功" });
      }
    );
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ message: "创建用户失败" });
  }
});

// 登录路由
router.post("/login", (req, res) => {
  const { account, password } = req.body;

  if (!account || !password) {
    return res.status(400).json({ message: "账号和密码不能为空" });
  }

  // 判断是手机号还是用户名
  const isPhone = /^1[3-9]\d{9}$/.test(account);
  const query = isPhone ? 
    "SELECT * FROM users WHERE phone = ?" : 
    "SELECT * FROM users WHERE username = ?";

  db().get(query, [account], async (err, user) => {
    if (err) {
      return res.status(500).json({ message: "登录过程中出错" });
    }
    
    if (!user) {
      return res.status(401).json({ message: "账号或密码错误" });
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

        // 设置 Cookie，确保只设置一次，并打印 Cookie 设置
        console.log('设置 Cookie:', {
          token: token,
          options: COOKIE_OPTIONS,
          environment: process.env.NODE_ENV || 'development',
          host: req.get('host'),
          origin: req.get('origin')
        });
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
        res.status(401).json({ message: "账号或密码错误" });
      }
    } catch (error) {
      res.status(500).json({ message: "登录过程中出错" });
    }
  });
});

// 头像上传路由
router.post('/upload-avatar', upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '没有上传文件' });
    }

    const baseUrl = process.env.NODE_ENV === 'production'
      ? `https://www.goparkme.com`      : `http://localhost:${serverConfig.port}`;

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
    // 打印完整的请求信息
    console.log('收到 check-token 请求');
    console.log('请求头:', req.headers);
    console.log('Cookies:', req.cookies);
    
    const token = req.cookies.token;
    
    if (!token) {
      console.log('没有收到 token');
      return res.status(401).json({ 
        status: 'error',
        message: 'No token found',
        cookies: req.cookies,
        headers: req.headers
      });
    }

    // 验证 token
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Token 解码成功:', decoded);

    res.json({ 
      status: 'success',
      tokenInfo: {
        userId: decoded.id,
        username: decoded.username,
        expiresAt: new Date(decoded.exp * 1000).toISOString()
      }
    });
  } catch (error) {
    console.error('Token 验证错误:', error);
    res.status(401).json({ 
      status: 'error',
      message: error.message,
      cookies: req.cookies,
      headers: req.headers
    });
  }
});

module.exports = router; 

