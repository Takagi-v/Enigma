const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

const app = express();

// 解析 cookies
app.use(cookieParser());

// 解析 JSON 请求体
app.use(express.json());

// 添加静态文件服务
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ... existing routes ... 