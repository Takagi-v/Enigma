import config from '../config';

/**
 * 停车位服务
 * 所有需要认证的方法都需要传入 authFetch
 */
const parkingService = {
  // 搜索停车位
  async searchParking(type, keyword) {
    try {
      const response = await fetch(`${config.API_URL}/parking-spots/search?type=${type}&keyword=${keyword}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '搜索失败');
      }
      return await response.json();
    } catch (error) {
      console.error('搜索错误:', error);
      throw error;
    }
  },

  // 获取停车位列表
  async getParkingSpots(params = {}) {
    try {
      const queryString = new URLSearchParams(params).toString();
      const response = await fetch(`${config.API_URL}/parking-spots?${queryString}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '获取停车位列表失败');
      }
      return await response.json();
    } catch (error) {
      console.error('获取停车位列表失败:', error);
      throw error;
    }
  },

  // 获取单个停车位详情
  async getParkingSpotDetail(id) {
    try {
      const response = await fetch(`${config.API_URL}/parking-spots/${id}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '获取停车位详情失败');
      }
      return await response.json();
    } catch (error) {
      console.error('获取停车位详情失败:', error);
      throw error;
    }
  },

  // 获取用户的停车记录
  async getParkingRecords(authFetch) {
    try {
      const response = await authFetch(`${config.API_URL}/parking-spots/usage/my`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '获取停车记录失败');
      }
      return await response.json();
    } catch (error) {
      console.error('获取停车记录失败:', error);
      throw error;
    }
  },

  // 开始使用停车位
  async startParking(spotId, authFetch, vehiclePlate) {
    try {
      const response = await authFetch(`${config.API_URL}/parking-spots/usage/${spotId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ vehicle_plate: vehiclePlate })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '开始使用停车位失败');
      }

      return await response.json();
    } catch (error) {
      console.error('开始使用停车位失败:', error);
      throw error;
    }
  },

  // 结束使用停车位
  async endParking(spotId, authFetch) {
    try {
      const response = await authFetch(`${config.API_URL}/parking-spots/usage/${spotId}/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '结束使用停车位失败');
      }

      return await response.json();
    } catch (error) {
      console.error('结束使用停车位失败:', error);
      throw error;
    }
  },

  // 支付停车费用
  async payParking(usageId, authFetch) {
    try {
      const response = await authFetch(`${config.API_URL}/parking-spots/usage/${usageId}/payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '支付失败');
      }

      return await response.json();
    } catch (error) {
      console.error('支付失败:', error);
      throw error;
    }
  },

  // 预约停车位
  async reserveParkingSpot(spotId, authFetch, vehiclePlate) {
    try {
      const response = await authFetch(`${config.API_URL}/parking-spots/${spotId}/reserve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ vehicle_plate: vehiclePlate })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '预约停车位失败');
      }

      return await response.json();
    } catch (error) {
      console.error('预约停车位失败:', error);
      throw error;
    }
  }
};

export default parkingService; 