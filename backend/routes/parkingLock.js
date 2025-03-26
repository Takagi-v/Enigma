/**
 * 地锁API路由
 * 为前端提供安全的地锁控制接口
 */
const express = require('express');
const router = express.Router();
const parkingLockService = require('../services/parkingLockService');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// 使用验证中间件，确保只有已登录用户可以访问地锁API
router.use(verifyToken);

// 获取服务器状态
router.get('/status', async (req, res) => {
  try {
    const result = await parkingLockService.getStatus();
    res.json(result);
  } catch (error) {
    console.error('获取地锁服务器状态失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取所有连接的设备
router.get('/devices', async (req, res) => {
  try {
    const result = await parkingLockService.getDevices();
    res.json(result);
  } catch (error) {
    console.error('获取地锁设备列表失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取设备详细状态
router.get('/device_status/:deviceSerial', async (req, res) => {
  try {
    const { deviceSerial } = req.params;
    const result = await parkingLockService.getDeviceStatus(deviceSerial);
    res.json(result);
  } catch (error) {
    console.error('获取设备状态失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取所有设备的详细状态
router.get('/device_statuses', async (req, res) => {
  try {
    const result = await parkingLockService.getAllDeviceStatuses();
    res.json(result);
  } catch (error) {
    console.error('获取所有设备状态失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 以下操作需要管理员权限
router.use(requireAdmin);

// 开锁
router.post('/open_lock', async (req, res) => {
  try {
    const { deviceSerial } = req.body;
    const result = await parkingLockService.openLock(deviceSerial);
    res.json(result);
  } catch (error) {
    console.error('发送开锁指令失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 关锁
router.post('/close_lock', async (req, res) => {
  try {
    const { deviceSerial } = req.body;
    const result = await parkingLockService.closeLock(deviceSerial);
    res.json(result);
  } catch (error) {
    console.error('发送关锁指令失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 设置锁状态
router.post('/set_state', async (req, res) => {
  try {
    const { deviceSerial, state } = req.body;
    const result = await parkingLockService.setLockState(deviceSerial, state);
    res.json(result);
  } catch (error) {
    console.error('设置锁状态失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 重启设备
router.post('/restart_device', async (req, res) => {
  try {
    const { deviceSerial } = req.body;
    const result = await parkingLockService.restartDevice(deviceSerial);
    res.json(result);
  } catch (error) {
    console.error('重启设备失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 同步时间
router.post('/sync_time', async (req, res) => {
  try {
    const { deviceSerial } = req.body;
    const result = await parkingLockService.syncTime(deviceSerial);
    res.json(result);
  } catch (error) {
    console.error('同步时间失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router; 