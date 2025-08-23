// API服务配置
const API_BASE_URL = 'https://www.goparkme.com/api';

// 从安全存储获取token的辅助函数
const getAuthToken = async () => {
  try {
    const { getItemAsync } = await import('expo-secure-store');
    return await getItemAsync('my-jwt');
  } catch (error) {
    console.warn('Failed to get auth token:', error);
    return null;
  }
};

// 通用请求函数
const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  };

  // 如果需要认证且没有提供Authorization头，自动添加token
  if (options.requireAuth && !defaultOptions.headers.Authorization) {
    const token = await getAuthToken();
    if (token) {
      defaultOptions.headers.Authorization = `Bearer ${token}`;
    }
  }

  try {
    const response = await fetch(url, defaultOptions);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

// 停车位相关API
export const parkingAPI = {
  // 获取所有停车位
  getAllParkingSpots: async (page, limit) => {
    const params = new URLSearchParams();
    if (page) params.append('page', page);
    if (limit) params.append('limit', limit);
    
    const queryString = params.toString();
    const endpoint = `/parking-spots${queryString ? `?${queryString}` : ''}`;
    
    return await apiRequest(endpoint);
  },

  // 获取附近停车位
  getNearbyParkingSpots: async () => {
    return await apiRequest('/parking-spots/nearby');
  },

  // 搜索停车位
  searchParkingSpots: async (keyword) => {
    return await apiRequest(`/parking-spots/search?keyword=${encodeURIComponent(keyword)}`);
  },

  // 获取单个停车位详情
  getParkingSpotById: async (id) => {
    return await apiRequest(`/parking-spots/${id}`);
  },

  // 获取停车位的预约列表
  getReservations: async (spotId) => {
    return await apiRequest(`/parking-spots/${spotId}/reservations`);
  },

  // 创建预约
  createReservation: async (spotId, reservationData) => {
    return await apiRequest(`/parking-spots/${spotId}/reserve`, {
      method: 'POST',
      body: JSON.stringify(reservationData),
      requireAuth: true,
    });
  },

  // 取消预约
  cancelReservation: async (spotId, reservationId) => {
    return await apiRequest(`/parking-spots/${spotId}/reservations/${reservationId}/cancel`, {
      method: 'POST',
      requireAuth: true,
    });
  },

  // 开始使用停车位
  startParking: async (spotId, vehiclePlate) => {
    return await apiRequest(`/parking-spots/usage/${spotId}/start`, {
      method: 'POST',
      body: JSON.stringify({ vehicle_plate: vehiclePlate }),
      requireAuth: true,
    });
  },

  // 结束使用停车位
  endParking: async (spotId) => {
    return await apiRequest(`/parking-spots/usage/${spotId}/end`, {
      method: 'POST',
      requireAuth: true,
    });
  },

  // 获取当前使用状态
  getCurrentUsage: async () => {
    return await apiRequest('/parking-spots/usage/current', {
      requireAuth: true,
    });
  },

  // 获取单条停车记录详情
  getParkingUsageById: async (usageId) => {
    return await apiRequest(`/parking-spots/usage/${usageId}`, {
      requireAuth: true,
    });
  },

  // 为停车记录付款
  payForUsage: async (usageId) => {
    return await apiRequest(`/parking-spots/usage/${usageId}/pay`, {
      method: 'POST',
      requireAuth: true,
    });
  },

  // 获取停车位地锁状态
  getLockStatus: async (spotId) => {
    return await apiRequest(`/parking-locks/spot/${spotId}/status`, {
      requireAuth: true,
    });
  },
};

// 用户相关API
export const userAPI = {
  // 用户登录
  login: async (credentials) => {
    return await apiRequest('/auth/mobile-login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  // 用户注册
  register: async (userData) => {
    return await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  // 获取用户信息
  getUserProfile: async () => {
    return await apiRequest('/users/profile', {
      requireAuth: true,
    });
  },

  // 更新用户资料
  updateUserProfile: async (username, userData) => {
    return await apiRequest(`/users/${username}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
      requireAuth: true,
    });
  },

  // 获取用户的预约列表
  getUserReservations: async () => {
    return await apiRequest('/users/my/reservations', {
      requireAuth: true,
    });
  },

  // 获取用户余额
  getUserBalance: async () => {
    return await apiRequest('/users/my/balance', {
      requireAuth: true,
    });
  },

  // 获取用户赠送余额
  getUserGiftBalance: async () => {
    return await apiRequest('/users/my/gift-balance', {
      requireAuth: true,
    });
  },

  // 获取用户优惠券
  getUserCoupons: async () => {
    return await apiRequest('/coupons/user/me', { // 后端需要一个能处理 /me 的路由
      requireAuth: true,
    });
  },

  // 获取用户停车记录
  getUserParkingUsage: async () => {
    return await apiRequest('/parking-spots/usage/my', {
      requireAuth: true,
    });
  },

  // 修改密码
  changePassword: async (currentPassword, newPassword) => {
    return await apiRequest('/users/my/password', {
      method: 'PUT',
      body: JSON.stringify({
        currentPassword,
        newPassword,
      }),
      requireAuth: true,
    });
  },

  // 发送手机验证码
  sendVerificationCode: async (phone) => {
    return await apiRequest('/auth/send-verification-code', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  },

  // 验证手机验证码
  verifyCode: async (phone, code) => {
    return await apiRequest('/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    });
  },
};

// 支付相关API
export const paymentAPI = {
  // 获取支付方式状态
  getPaymentMethodStatus: async () => {
    return await apiRequest('/payment/status', {
      requireAuth: true,
    });
  },
  // 获取完整的默认支付方式（包含 id 用于后续支付）
  getPaymentMethod: async () => {
    return await apiRequest('/payment/method', {
      requireAuth: true,
    });
  },
  // 获取用户首次充值奖励状态
  getGiftStatus: async () => {
    return await apiRequest('/payment/gift-status', {
      requireAuth: true,
    });
  },
  // 保存支付方式
  savePaymentMethod: async (paymentMethodId) => {
    return await apiRequest('/payment/save-method', {
      method: 'POST',
      body: JSON.stringify({ paymentMethodId, paymentType: 'card' }),
      requireAuth: true,
    });
  },
  // 创建充值意图
  createTopUpIntent: async (amount, paymentMethodId, isFirstTopUp = false) => {
    return await apiRequest('/payment/top-up', {
        method: 'POST',
        body: JSON.stringify({ amount, paymentMethodId, isFirstTopUp }),
        requireAuth: true,
    });
  },
  // 获取交易记录（充值）
  getTransactions: async () => {
    return await apiRequest('/payment/transactions', {
      requireAuth: true,
    });
  },
};


export default {
  parkingAPI,
  userAPI,
  paymentAPI,
}; 