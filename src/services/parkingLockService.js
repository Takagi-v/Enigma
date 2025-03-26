import config from '../config';

// 使用我们自己的后端代理
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? '/api/parking-locks'  // 生产环境使用相对路径
  : 'http://localhost:3002/api/parking-locks'; // 开发环境使用本地后端

// 获取管理员认证令牌
const getAuthToken = () => localStorage.getItem('adminToken') || '';

export const parkingLockService = {
  // 获取服务器状态
  getStatus: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/status`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
      return await response.json();
    } catch (error) {
      console.error('获取地锁服务器状态失败:', error);
      throw error;
    }
  },

  // 获取所有连接的设备
  getDevices: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/devices`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
      return await response.json();
    } catch (error) {
      console.error('获取地锁设备列表失败:', error);
      throw error;
    }
  },

  // 获取指定设备的详细状态
  getDeviceStatus: async (deviceSerial) => {
    try {
      const response = await fetch(`${API_BASE_URL}/device_status/${deviceSerial}`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
      return await response.json();
    } catch (error) {
      console.error('获取设备状态失败:', error);
      throw error;
    }
  },

  // 获取所有设备的详细状态
  getAllDeviceStatuses: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/device_statuses`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
      return await response.json();
    } catch (error) {
      console.error('获取所有设备状态失败:', error);
      throw error;
    }
  },

  // 开锁
  openLock: async (deviceSerial) => {
    try {
      const response = await fetch(`${API_BASE_URL}/open_lock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
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
      const response = await fetch(`${API_BASE_URL}/close_lock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
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
      const response = await fetch(`${API_BASE_URL}/set_state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
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
      const response = await fetch(`${API_BASE_URL}/restart_device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
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
      const response = await fetch(`${API_BASE_URL}/sync_time`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ deviceSerial }),
      });
      return await response.json();
    } catch (error) {
      console.error('同步时间失败:', error);
      throw error;
    }
  },

  // 测试连接
  testConnection: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/status`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
      return await response.json();
    } catch (error) {
      console.error('测试连接失败:', error);
      return { success: false, error: error.message };
    }
  }
}; 