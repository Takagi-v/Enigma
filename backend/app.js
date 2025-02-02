const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

// 添加静态文件服务
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ... existing routes ... 