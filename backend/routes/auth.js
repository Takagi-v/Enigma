const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const { db } = require('../models/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const serverConfig = require('../config/server');

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
      (err) => {
        if (err) {
          if (err.message.includes("UNIQUE constraint failed")) {
            return res.status(400).json({ message: "用户名已存在" });
          }
          return res.status(500).json({ message: "创建用户失败" });
        }
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
          res.json({ 
            message: "登录成功",
            username: user.username
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

// Google 登录路由
router.post("/google-login", async (req, res) => {
  const { googleId, email, username, full_name, avatar, phone, bio, address } = req.body;

  // 验证必要的字段
  if (!googleId || !email || !username || !full_name) {
    return res.status(400).json({ message: "缺少必要的用户信息" });
  }

  try {
    // 首先检查用户名是否存在
    db().get(
      "SELECT * FROM users WHERE username = ?",
      [username],
      async (err, userByUsername) => {
        if (err) {
          console.error('查询用户名错误:', err);
          return res.status(500).json({ message: "查询用户信息时出错" });
        }

        // 如果用户名不存在，检查邮箱
        if (!userByUsername) {
          db().get(
            "SELECT * FROM users WHERE email = ?",
            [email],
            async (emailErr, userByEmail) => {
              if (emailErr) {
                console.error('查询邮箱错误:', emailErr);
                return res.status(500).json({ message: "查询用户信息时出错" });
              }

              if (!userByEmail) {
                // 用户不存在，创建新用户
                try {
                  const hashedPassword = await bcrypt.hash(googleId, 10);
                  
                  db().run(
                    `INSERT INTO users (
                      username, 
                      password, 
                      email,
                      full_name, 
                      phone, 
                      avatar, 
                      bio, 
                      address
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                      username,
                      hashedPassword,
                      email,
                      full_name,
                      phone || '',
                      avatar || '',
                      bio || `Google用户 - ${full_name}`,
                      address || ''
                    ],
                    (insertErr) => {
                      if (insertErr) {
                        console.error('创建用户错误:', insertErr);
                        return res.status(500).json({ message: "创建用户失败，请重试" });
                      }

                      res.json({ 
                        message: "Google 登录成功",
                        username: username
                      });
                    }
                  );
                } catch (hashErr) {
                  console.error('密码加密错误:', hashErr);
                  return res.status(500).json({ message: "用户创建过程中出错" });
                }
              } else {
                // 邮箱已存在，使用现有账户
                res.json({ 
                  message: "Google 登录成功",
                  username: userByEmail.username
                });
              }
            }
          );
        } else {
          // 用户名已存在，直接登录
          res.json({ 
            message: "Google 登录成功",
            username: userByUsername.username
          });
        }
      }
    );
  } catch (error) {
    console.error('Google 登录错误:', error);
    res.status(500).json({ message: "登录过程中出错，请重试" });
  }
});

module.exports = router; 