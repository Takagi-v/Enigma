// API服务配置
const API_BASE_URL = 'https://www.goparkme.com/api';

// 通用请求函数
const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  };

  try {
    const response = await fetch(url, defaultOptions);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
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
};

export default {
  parkingAPI,
  userAPI,
}; 