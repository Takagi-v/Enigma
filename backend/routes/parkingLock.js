/**
 * 地锁API路由
 * 为前端提供安全的地锁控制接口
 */
const express = require('express');
const router = express.Router();
const parkingLockService = require('../services/parkingLockService');
const lockStatusSyncService = require('../services/lockStatusSyncService');
const { authenticateToken, authenticateAdmin } = require('../middleware/auth');

// Webhook 密钥验证中间件
const validateWebhookSecret = (req, res, next) => {
  const secret = req.headers['x-webhook-secret'];
  if (secret !== process.env.LOCK_WEBHOOK_SECRET) {
    console.warn('收到无效的 Webhook 请求，密钥不匹配');
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  next();
};

// Webhook 接口，用于接收来自 Python 服务器的地锁状态更新
router.post('/webhook/status-update', validateWebhookSecret, async (req, res) => {
  try {
    const deviceStatus = req.body;
    console.log('[Webhook] 收到地锁状态更新:', deviceStatus.serialNumber);
    
    // 使用 setImmediate 异步处理，立即响应Webhook请求方
    setImmediate(() => {
      lockStatusSyncService.handleHeartbeatUpdate(deviceStatus).catch(err => {
        console.error('[Webhook] 异步处理心跳更新失败:', err);
      });
    });

    res.status(202).json({ success: true, message: 'Accepted' });
  } catch (error) {
    console.error('[Webhook] 处理地锁状态更新失败:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});


// 使用验证中间件，确保只有已登录用户可以访问地锁API
router.use(authenticateToken);

// 获取停车位地锁状态 - 普通用户也可查看
router.get('/spot/:spotId/status', async (req, res) => {
  try {
    const { spotId } = req.params;
    const result = await lockStatusSyncService.checkSpotLockStatus(spotId);
    res.json(result);
  } catch (error) {
    console.error('检查停车位地锁状态失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

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
router.use(authenticateAdmin);

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

// 检查停车位地锁状态
router.get('/spot/:spotId/status', async (req, res) => {
  try {
    const { spotId } = req.params;
    const result = await lockStatusSyncService.checkSpotLockStatus(spotId);
    res.json(result);
  } catch (error) {
    console.error('检查停车位地锁状态失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 强制同步停车位状态
router.post('/spot/:spotId/sync', async (req, res) => {
  try {
    const { spotId } = req.params;
    const result = await lockStatusSyncService.forceSyncSpotStatus(spotId);
    res.json(result);
  } catch (error) {
    console.error('强制同步停车位状态失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 启动地锁状态同步服务
router.post('/sync/start', async (req, res) => {
  try {
    lockStatusSyncService.startSync();
    res.json({ success: true, message: '地锁状态同步服务已启动' });
  } catch (error) {
    console.error('启动同步服务失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 停止地锁状态同步服务
router.post('/sync/stop', async (req, res) => {
  try {
    lockStatusSyncService.stopSync();
    res.json({ success: true, message: '地锁状态同步服务已停止' });
  } catch (error) {
    console.error('停止同步服务失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 手动执行一次全量同步
router.post('/sync/run', async (req, res) => {
  try {
    await lockStatusSyncService.syncAllLockStatus();
    res.json({ success: true, message: '手动同步已完成' });
  } catch (error) {
    console.error('手动同步失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router; 