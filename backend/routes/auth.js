const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { db } = require('../models/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const serverConfig = require('../config/server');
const { OAuth2Client } = require('google-auth-library');
const twilio = require('twilio');

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

// 创建Google OAuth client
const googleClient = new OAuth2Client();

// 创建Twilio客户端
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID || 'your_account_sid',
  process.env.TWILIO_AUTH_TOKEN || 'your_auth_token'
);
// Twilio Verify Service SID
const twilioVerifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
// 如果仍需要直接发送SMS，保留phone number配置（对于Verify API不需要）
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

// 存储验证码的对象 (在生产环境中应该使用Redis等缓存服务)
const verificationCodes = {};

// 发送验证码
router.post('/send-verification-code', async (req, res) => {
  const { phone } = req.body;
  
  if (!phone) {
    return res.status(400).json({ message: "手机号不能为空" });
  }
  
  try {
    // 验证手机号格式
    const phoneRegex = /^(\+?1)?[- ()]*([2-9][0-9]{2})[- )]*([2-9][0-9]{2})[- ]*([0-9]{4})$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ message: "无效的电话号码格式" });
    }
    
    // 标准化手机号格式
    const digits = phone.replace(/\D/g, '');
    const standardizedPhone = digits.startsWith('1') && digits.length > 10 ? digits.substring(1) : digits;
    const formattedPhone = `+1${standardizedPhone}`;
    
    // 在生产环境中使用Twilio Verify发送验证码
    if (process.env.NODE_ENV === 'production') {
      // 使用Verify API发送验证码
      await twilioClient.verify.v2.services(twilioVerifyServiceSid)
        .verifications
        .create({
          to: formattedPhone,
          channel: 'sms'
        });
      
      // 当使用Verify API时，不需要自己生成和存储验证码，
      // Twilio会负责验证码的生成、发送和验证
      // 但为了与开发环境保持一致，我们只保存验证状态
      verificationCodes[standardizedPhone] = {
        verifyRequested: true,
        expiresAt: Date.now() + 10 * 60 * 1000 // 10分钟后过期
      };
    } else {
      // 开发环境下，生成6位随机验证码并打印
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      console.log(`开发环境 - 手机号: ${formattedPhone}, 验证码: ${verificationCode}`);
      
      // 存储验证码，设置5分钟过期
      verificationCodes[standardizedPhone] = {
        code: verificationCode,
        expiresAt: Date.now() + 5 * 60 * 1000 // 5分钟后过期
      };
    }
    
    return res.status(200).json({ message: "验证码已发送" });
  } catch (error) {
    console.error('发送验证码错误:', error);
    return res.status(500).json({ message: "发送验证码失败" });
  }
});

// 验证验证码
router.post('/verify-code', async (req, res) => {
  const { phone, code } = req.body;
  
  if (!phone || !code) {
    return res.status(400).json({ message: "手机号和验证码不能为空" });
  }
  
  try {
    // 标准化手机号格式
    const digits = phone.replace(/\D/g, '');
    const standardizedPhone = digits.startsWith('1') && digits.length > 10 ? digits.substring(1) : digits;
    const formattedPhone = `+1${standardizedPhone}`;
    
    // 在生产环境中使用Twilio Verify验证验证码
    if (process.env.NODE_ENV === 'production') {
      // 检查验证状态是否存在
      const storedVerification = verificationCodes[standardizedPhone];
      if (!storedVerification || !storedVerification.verifyRequested) {
        return res.status(400).json({ message: "验证码不存在或已过期，请重新获取" });
      }
      
      // 检查是否过期
      if (Date.now() > storedVerification.expiresAt) {
        // 删除过期的验证状态
        delete verificationCodes[standardizedPhone];
        return res.status(400).json({ message: "验证码已过期，请重新获取" });
      }
      
      // 使用Verify API验证验证码
      const verification_check = await twilioClient.verify.v2.services(twilioVerifyServiceSid)
        .verificationChecks
        .create({
          to: formattedPhone,
          code: code
        });
      
      if (verification_check.status !== 'approved') {
        return res.status(400).json({ message: "验证码不正确" });
      }
      
      // 验证成功，删除验证状态
      delete verificationCodes[standardizedPhone];
    } else {
      // 开发环境下的验证逻辑
      const storedVerification = verificationCodes[standardizedPhone];
      
      if (!storedVerification) {
        return res.status(400).json({ message: "验证码不存在或已过期，请重新获取" });
      }
      
      if (Date.now() > storedVerification.expiresAt) {
        // 删除过期的验证码
        delete verificationCodes[standardizedPhone];
        return res.status(400).json({ message: "验证码已过期，请重新获取" });
      }
      
      if (storedVerification.code !== code) {
        return res.status(400).json({ message: "验证码不正确" });
      }
      
      // 验证成功，删除验证码
      delete verificationCodes[standardizedPhone];
    }
    
    return res.status(200).json({ message: "验证成功" });
  } catch (error) {
    console.error('验证码验证错误:', error);
    return res.status(500).json({ message: "验证码验证失败" });
  }
});

// 注册路由
router.post("/register", async (req, res) => {
  const { username, password, full_name, phone, avatar, bio, address, vehicle_plate, verified } = req.body;

  if (!username || !password || !full_name || !phone || !vehicle_plate) {
    return res.status(400).json({ message: "所有必填字段都不能为空" });
  }
  
  // 检查手机号是否已验证
  if (!verified) {
    return res.status(400).json({ message: "请先验证手机号" });
  }

  try {
    // 验证手机号格式
    const phoneRegex = /^(\+?1)?[- ()]*([2-9][0-9]{2})[- )]*([2-9][0-9]{2})[- ]*([0-9]{4})$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ message: "无效的电话号码格式" });
    }

    // 标准化手机号格式
    const digits = phone.replace(/\D/g, '');
    const standardizedPhone = digits.startsWith('1') && digits.length > 10 ? digits.substring(1) : digits;
    
    // 检查手机号是否已存在
    const existingPhone = await new Promise((resolve, reject) => {
      db().get("SELECT id FROM users WHERE phone = ?", [standardizedPhone], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });

    if (existingPhone) {
      return res.status(400).json({ message: "该手机号已被注册" });
    }

    // 检查车牌号是否已存在
    const existingPlate = await new Promise((resolve, reject) => {
      db().get("SELECT id FROM users WHERE vehicle_plate = ?", [vehicle_plate], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });

    if (existingPlate) {
      return res.status(400).json({ message: "该车牌号已被绑定" });
    }

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
      `INSERT INTO users (username, password, full_name, phone, avatar, bio, address, vehicle_plate) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, hashedPassword, full_name, standardizedPhone, avatarUrl, bio || '用户未填写简介', address || '', vehicle_plate],
      async function(err) {
        if (err) {
          if (err.message.includes("UNIQUE constraint failed")) {
            if (err.message.includes("users.username")) {
              return res.status(400).json({ message: "用户名已存在" });
            } else if (err.message.includes("users.phone")) {
              return res.status(400).json({ message: "该手机号已被注册" });
            } else if (err.message.includes("users.vehicle_plate")) {
              return res.status(400).json({ message: "该车牌号已被绑定" });
            }
            return res.status(400).json({ message: "注册信息有误，请检查" });
          }
          return res.status(500).json({ message: "创建用户失败" });
        }

        // 不再赠送初始余额，改为首次充值时赠送
        
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
  const isPhone = /^(\+?1)?[- ()]*([2-9][0-9]{2})[- )]*([2-9][0-9]{2})[- ]*([0-9]{4})$/.test(account);
  const query = isPhone ? 
    "SELECT * FROM users WHERE phone = ?" : 
    "SELECT * FROM users WHERE username = ?";

  // 如果是手机号，需要标准化格式
  let searchAccount = account;
  if (isPhone) {
    // 提取纯数字
    const digits = account.replace(/\D/g, '');
    // 如果以1开头（美国国家代码），则去掉
    searchAccount = digits.startsWith('1') && digits.length > 10 ? digits.substring(1) : digits;
    console.log('登录时检测到手机号格式，标准化为:', searchAccount);
  }

  db().get(query, [searchAccount], async (err, user) => {
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
            email: user.email,
            vehiclePlate: user.vehicle_plate
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
      "SELECT id, username, full_name, phone, avatar, bio, address, email, vehicle_plate FROM users WHERE id = ?",
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
            email: user.email,
            vehiclePlate: user.vehicle_plate
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

// Google登录路由
router.post('/google-login', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ message: '未提供Google令牌' });
    }
    
    // 验证Google令牌
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: serverConfig.googleClientId // 使用配置中的Google Client ID
    });
    
    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;
    
    if (!email) {
      return res.status(401).json({ message: 'Google账号未提供邮箱信息' });
    }
    
    // 检查用户是否已存在
    db().get(
      "SELECT * FROM users WHERE email = ? OR google_id = ?",
      [email, googleId],
      async (err, user) => {
        if (err) {
          console.error('数据库查询错误:', err);
          return res.status(500).json({ message: '服务器错误' });
        }
        
        // 如果用户存在，生成token并登录
        if (user) {
          // 如果是老用户但没有google_id，则更新用户记录添加google_id
          if (!user.google_id) {
            await db().run(
              "UPDATE users SET google_id = ? WHERE id = ?",
              [googleId, user.id]
            );
          }
          
          // 生成JWT token
          const token = jwt.sign(
            { 
              id: user.id,
              username: user.username
            },
            JWT_SECRET,
            { expiresIn: '24h' }
          );
          
          // 设置cookie
          res.cookie('token', token, COOKIE_OPTIONS);
          
          // 返回用户信息
          return res.json({
            message: "登录成功",
            isAuthenticated: true,
            user: {
              id: user.id,
              username: user.username,
              fullName: user.full_name,
              phone: user.phone,
              avatar: user.avatar || picture, // 如果用户没有头像则使用Google头像
              bio: user.bio,
              address: user.address,
              email: user.email,
              vehiclePlate: user.vehicle_plate
            }
          });
        }
        
        // 如果用户不存在，但需要绑定车牌，返回202状态码
        return res.status(202).json({ 
          message: '需要绑定车牌',
          needsVehiclePlate: true,
          email: email
        });
      }
    );
  } catch (error) {
    console.error('Google登录错误:', error);
    res.status(500).json({ message: 'Google登录失败' });
  }
});

// Google用户绑定车牌并完成注册
router.post('/google-bind-vehicle', async (req, res) => {
  try {
    const { token, vehicle_plate } = req.body;
    
    if (!token || !vehicle_plate) {
      return res.status(400).json({ message: '缺少必要信息' });
    }
    
    // 验证Google令牌
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: serverConfig.googleClientId // 使用配置中的Google Client ID
    });
    
    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;
    
    if (!email) {
      return res.status(401).json({ message: 'Google账号未提供邮箱信息' });
    }
    
    // 检查该车牌是否已被使用
    const existingPlate = await new Promise((resolve, reject) => {
      db().get("SELECT id FROM users WHERE vehicle_plate = ?", [vehicle_plate], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
    
    if (existingPlate) {
      return res.status(400).json({ message: '该车牌号已被绑定' });
    }
    
    // 生成随机用户名
    let username = `g_${Math.random().toString(36).substring(2, 10)}`;
    // 确保用户名唯一
    while (true) {
      const existingUser = await new Promise((resolve, reject) => {
        db().get("SELECT id FROM users WHERE username = ?", [username], (err, row) => {
          if (err) reject(err);
          resolve(row);
        });
      });
      
      if (!existingUser) break;
      username = `g_${Math.random().toString(36).substring(2, 10)}`;
    }
    
    // 创建用户
    await db().run(
      `INSERT INTO users (username, google_id, email, full_name, avatar, bio, vehicle_plate) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [username, googleId, email, name || '未设置', picture || '', '使用Google登录的用户', vehicle_plate],
      async function(err) {
        if (err) {
          console.error('创建用户错误:', err);
          return res.status(500).json({ message: '创建用户失败' });
        }
        
        const userId = this.lastID;
        
        // 不再赠送初始余额，改为首次充值时赠送
        
        // 生成JWT token
        const token = jwt.sign(
          { 
            id: userId,
            username: username
          },
          JWT_SECRET,
          { expiresIn: '24h' }
        );
        
        // 设置cookie
        res.cookie('token', token, COOKIE_OPTIONS);
        
        // 返回用户信息
        return res.json({
          message: "注册成功",
          isAuthenticated: true,
          user: {
            id: userId,
            username: username,
            fullName: name || '未设置',
            avatar: picture || '',
            bio: '使用Google登录的用户',
            email: email,
            vehiclePlate: vehicle_plate
          }
        });
      }
    );
  } catch (error) {
    console.error('Google绑定车牌错误:', error);
    res.status(500).json({ message: 'Google绑定车牌失败' });
  }
});

// 重置密码请求
router.post('/forgot-password', async (req, res) => {
  const { phone } = req.body;
  
  if (!phone) {
    return res.status(400).json({ message: "手机号不能为空" });
  }
  
  try {
    // 验证手机号格式
    const phoneRegex = /^(\+?1)?[- ()]*([2-9][0-9]{2})[- )]*([2-9][0-9]{2})[- ]*([0-9]{4})$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ message: "无效的电话号码格式" });
    }
    
    // 标准化手机号格式
    const digits = phone.replace(/\D/g, '');
    const standardizedPhone = digits.startsWith('1') && digits.length > 10 ? digits.substring(1) : digits;
    const formattedPhone = `+1${standardizedPhone}`;
    
    // 检查手机号是否已注册
    const user = await new Promise((resolve, reject) => {
      db().get("SELECT id FROM users WHERE phone = ?", [standardizedPhone], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });

    if (!user) {
      return res.status(400).json({ message: "该手机号未注册" });
    }
    
    // 在生产环境中使用Twilio Verify发送验证码
    if (process.env.NODE_ENV === 'production') {
      // 使用Verify API发送验证码
      await twilioClient.verify.v2.services(twilioVerifyServiceSid)
        .verifications
        .create({
          to: formattedPhone,
          channel: 'sms'
        });
      
      // 存储验证状态，设置10分钟过期
      verificationCodes[standardizedPhone] = {
        verifyRequested: true,
        expiresAt: Date.now() + 10 * 60 * 1000, // 10分钟后过期
        type: 'reset_password' // 标记这是重置密码的验证码
      };
    } else {
      // 开发环境下，生成6位随机验证码并打印
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      console.log(`开发环境 - 重置密码 - 手机号: ${formattedPhone}, 验证码: ${verificationCode}`);
      
      // 存储验证码，设置5分钟过期
      verificationCodes[standardizedPhone] = {
        code: verificationCode,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5分钟后过期
        type: 'reset_password' // 标记这是重置密码的验证码
      };
    }
    
    return res.status(200).json({ message: "验证码已发送" });
  } catch (error) {
    console.error('发送重置密码验证码错误:', error);
    return res.status(500).json({ message: "发送验证码失败" });
  }
});

// 验证重置密码验证码
router.post('/verify-reset-code', async (req, res) => {
  const { phone, code } = req.body;
  
  if (!phone || !code) {
    return res.status(400).json({ message: "手机号和验证码不能为空" });
  }
  
  try {
    // 标准化手机号格式
    const digits = phone.replace(/\D/g, '');
    const standardizedPhone = digits.startsWith('1') && digits.length > 10 ? digits.substring(1) : digits;
    
    // 检查验证码是否存在且有效
    const storedVerification = verificationCodes[standardizedPhone];
    
    if (!storedVerification || storedVerification.type !== 'reset_password') {
      return res.status(400).json({ message: "验证码不存在或已过期，请重新获取" });
    }
    
    if (Date.now() > storedVerification.expiresAt) {
      // 删除过期的验证码
      delete verificationCodes[standardizedPhone];
      return res.status(400).json({ message: "验证码已过期，请重新获取" });
    }
    
    if (storedVerification.code !== code) {
      return res.status(400).json({ message: "验证码不正确" });
    }
    
    // 验证成功，生成临时token
    const token = jwt.sign(
      { 
        phone: standardizedPhone,
        type: 'reset_password'
      },
      JWT_SECRET,
      { expiresIn: '5m' } // 5分钟有效期
    );
    
    // 删除验证码
    delete verificationCodes[standardizedPhone];
    
    return res.status(200).json({ 
      message: "验证成功",
      token
    });
  } catch (error) {
    console.error('验证重置密码验证码错误:', error);
    return res.status(500).json({ message: "验证码验证失败" });
  }
});

// 重置密码
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  
  if (!token || !newPassword) {
    return res.status(400).json({ message: "token和新密码不能为空" });
  }
  
  try {
    // 验证token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.type !== 'reset_password') {
      return res.status(400).json({ message: "无效的token" });
    }
    
    // 验证密码格式
    if (!/^\d{6}$/.test(newPassword)) {
      return res.status(400).json({ message: "密码必须为6位数字" });
    }
    
    // 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // 更新密码
    await new Promise((resolve, reject) => {
      db().run(
        "UPDATE users SET password = ? WHERE phone = ?",
        [hashedPassword, decoded.phone],
        function(err) {
          if (err) reject(err);
          resolve(this);
        }
      );
    });
    
    return res.status(200).json({ message: "密码重置成功" });
  } catch (error) {
    console.error('重置密码错误:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({ message: "重置密码链接已过期，请重新获取验证码" });
    }
    return res.status(500).json({ message: "重置密码失败" });
  }
});

module.exports = router; 

