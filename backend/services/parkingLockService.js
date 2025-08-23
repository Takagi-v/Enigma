/**
 * 地锁服务代理层
 * 用于与地锁API进行内部通信，提供安全的代理服务
 */
const axios = require('axios');

// 地锁服务API地址（内部服务器地址，不暴露给前端）
const LOCK_API_BASE_URL = 'http://localhost:5000/api';

// 创建axios实例
const lockApi = axios.create({
  baseURL: LOCK_API_BASE_URL,
  timeout: 10000, // 超时时间10秒
});

// 地锁服务
const parkingLockService = {
  /**
   * 获取服务器状态
   */
  getStatus: async () => {
    try {
      const response = await lockApi.get('/status');
      return response.data;
    } catch (error) {
      console.error('获取地锁服务器状态失败:', error.message);
      throw new Error('无法连接到地锁服务器');
    }
  },

  /**
   * 获取所有连接的设备
   */
  getDevices: async () => {
    try {
      const response = await lockApi.get('/devices');
      return response.data;
    } catch (error) {
      console.error('获取地锁设备列表失败:', error.message);
      throw new Error('获取设备列表失败');
    }
  },

  /**
   * 获取指定设备的详细状态
   */
  getDeviceStatus: async (deviceSerial) => {
    try {
      const response = await lockApi.get(`/device_status/${deviceSerial}`);
      const data = response.data;
      
      // 如果是成功响应，返回统一格式
      if (data && data.success) {
        return {
          success: true,
          data: {
            ...data,
            last_heartbeat: new Date().toISOString() // 添加当前时间作为获取时间
          }
        };
      }
      
      return data;
    } catch (error) {
      console.error('获取设备状态失败:', error.message);
      return { success: false, message: '获取设备状态失败: ' + error.message };
    }
  },

  /**
   * 获取所有设备的详细状态
   */
  getAllDeviceStatuses: async () => {
    try {
      const response = await lockApi.get('/device_statuses');
      return response.data;
    } catch (error) {
      console.error('获取所有设备状态失败:', error.message);
      throw new Error('获取设备状态列表失败');
    }
  },

  /**
   * 开锁
   */
  openLock: async (deviceSerial) => {
    try {
      const response = await lockApi.post('/open_lock', { deviceSerial });
      return response.data;
    } catch (error) {
      console.error('发送开锁指令失败:', error.message);
      throw new Error('发送开锁指令失败');
    }
  },

  /**
   * 关锁
   */
  closeLock: async (deviceSerial) => {
    try {
      const response = await lockApi.post('/close_lock', { deviceSerial });
      return response.data;
    } catch (error) {
      console.error('发送关锁指令失败:', error.message);
      throw new Error('发送关锁指令失败');
    }
  },

  /**
   * 设置锁状态（0:正常, 1:保持开, 2:保持关）
   */
  setLockState: async (deviceSerial, state) => {
    try {
      const response = await lockApi.post('/set_state', { deviceSerial, state });
      return response.data;
    } catch (error) {
      console.error('设置锁状态失败:', error.message);
      throw new Error('设置锁状态失败');
    }
  },

  /**
   * 重启设备
   */
  restartDevice: async (deviceSerial) => {
    try {
      const response = await lockApi.post('/restart_device', { deviceSerial });
      return response.data;
    } catch (error) {
      console.error('重启设备失败:', error.message);
      throw new Error('重启设备失败');
    }
  },

  /**
   * 同步时间
   */
  syncTime: async (deviceSerial) => {
    try {
      const response = await lockApi.post('/sync_time', { deviceSerial });
      return response.data;
    } catch (error) {
      console.error('同步时间失败:', error.message);
      throw new Error('同步时间失败');
    }
  }
};

module.exports = parkingLockService; 