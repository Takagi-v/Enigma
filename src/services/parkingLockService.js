import config from '../config';

const PARKING_LOCK_API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://www.goparkme.com/lock-api'
  : 'http://localhost:5000/api';

export const parkingLockService = {
  // 获取服务器状态
  getStatus: async () => {
    try {
      const response = await fetch(`${PARKING_LOCK_API_URL}/status`);
      return await response.json();
    } catch (error) {
      console.error('获取地锁服务器状态失败:', error);
      throw error;
    }
  },

  // 获取所有连接的设备
  getDevices: async () => {
    try {
      const response = await fetch(`${PARKING_LOCK_API_URL}/devices`);
      return await response.json();
    } catch (error) {
      console.error('获取地锁设备列表失败:', error);
      throw error;
    }
  },

  // 获取指定设备的详细状态
  getDeviceStatus: async (deviceSerial) => {
    try {
      const response = await fetch(`${PARKING_LOCK_API_URL}/device_status/${deviceSerial}`);
      return await response.json();
    } catch (error) {
      console.error('获取设备状态失败:', error);
      throw error;
    }
  },

  // 获取所有设备的详细状态
  getAllDeviceStatuses: async () => {
    try {
      const response = await fetch(`${PARKING_LOCK_API_URL}/device_statuses`);
      return await response.json();
    } catch (error) {
      console.error('获取所有设备状态失败:', error);
      throw error;
    }
  },

  // 开锁
  openLock: async (deviceSerial) => {
    try {
      const response = await fetch(`${PARKING_LOCK_API_URL}/open_lock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deviceSerial }),
      });
      return await response.json();
    } catch (error) {
      console.error('发送开锁指令失败:', error);
      throw error;
    }
  },

  // 关锁
  closeLock: async (deviceSerial) => {
    try {
      const response = await fetch(`${PARKING_LOCK_API_URL}/close_lock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deviceSerial }),
      });
      return await response.json();
    } catch (error) {
      console.error('发送关锁指令失败:', error);
      throw error;
    }
  },

  // 设置锁状态（0:正常, 1:保持开, 2:保持关）
  setLockState: async (deviceSerial, state) => {
    try {
      const response = await fetch(`${PARKING_LOCK_API_URL}/set_state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deviceSerial, state }),
      });
      return await response.json();
    } catch (error) {
      console.error('设置锁状态失败:', error);
      throw error;
    }
  },

  // 重启设备
  restartDevice: async (deviceSerial) => {
    try {
      const response = await fetch(`${PARKING_LOCK_API_URL}/restart_device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deviceSerial }),
      });
      return await response.json();
    } catch (error) {
      console.error('重启设备失败:', error);
      throw error;
    }
  },

  // 同步时间
  syncTime: async (deviceSerial) => {
    try {
      const response = await fetch(`${PARKING_LOCK_API_URL}/sync_time`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deviceSerial }),
      });
      return await response.json();
    } catch (error) {
      console.error('同步时间失败:', error);
      throw error;
    }
  },

  // 启动服务器
  startServer: async (host = '18.220.204.146', port = 11457) => {
    try {
      const response = await fetch(`${PARKING_LOCK_API_URL}/start_server`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ host, port }),
      });
      return await response.json();
    } catch (error) {
      console.error('启动服务器失败:', error);
      throw error;
    }
  },

  // 停止服务器
  stopServer: async () => {
    try {
      const response = await fetch(`${PARKING_LOCK_API_URL}/stop_server`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return await response.json();
    } catch (error) {
      console.error('停止服务器失败:', error);
      throw error;
    }
  }
}; 