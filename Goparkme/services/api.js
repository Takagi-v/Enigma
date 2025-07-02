// API服务配置
const API_BASE_URL = 'https://www.goparkme.com/api';

// 从安全存储获取token的辅助函数
const getAuthToken = async () => {
  try {
    const { getItemAsync } = await import('expo-secure-store');
    return await getItemAsync('authToken');
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
  getUserProfile: async (token) => {
    return await apiRequest('/users/profile', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  // 获取用户的预约列表
  getUserReservations: async (userId) => {
    return await apiRequest(`/users/${userId}/reservations`, {
      requireAuth: true,
    });
  },
};

export default {
  parkingAPI,
  userAPI,
}; 