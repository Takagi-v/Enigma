import config from '../config';

export const searchParking = async (type, keyword) => {
  try {
    const response = await fetch(`${config.API_URL}/parking-spots/search?type=${type}&keyword=${keyword}`);
    return await response.json();
  } catch (error) {
    console.error('搜索错误:', error);
    throw error;
  }
};

// 开始使用停车场
export const startParking = async (parkingId, userId) => {
  try {
    const response = await fetch(`${config.API_URL}/parking-spots/${parkingId}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ user_id: userId })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || '开始使用停车场失败');
    }

    return await response.json();
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};

// 结束使用停车场
export const endParking = async (parkingId, userId) => {
  try {
    const response = await fetch(`${config.API_URL}/parking-spots/${parkingId}/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ user_id: userId })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || '结束使用停车场失败');
    }

    return await response.json();
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};

// 支付停车费用
export const payParking = async (parkingId, usageId) => {
  try {
    const response = await fetch(`${config.API_URL}/parking-spots/${parkingId}/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ usage_id: usageId })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || '支付失败');
    }

    return await response.json();
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};

export const parkingService = {
  async getParkingSpots() {
    try {
      const response = await fetch(`${config.API_URL}/parking-spots`, {
        credentials: 'include'
      });
      return await response.json();
    } catch (error) {
      console.error('获取停车位失败:', error);
      throw error;
    }
  },

  async reserveParkingSpot(spotId, vehiclePlate) {
    try {
      const response = await fetch(`${config.API_URL}/parking-spots/${spotId}/reserve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ vehicle_plate: vehiclePlate })
      });
      return await response.json();
    } catch (error) {
      console.error('预约停车位失败:', error);
      throw error;
    }
  },

  async endParking(spotId) {
    try {
      const response = await fetch(`${config.API_URL}/parking-spots/${spotId}/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      return await response.json();
    } catch (error) {
      console.error('结束停车失败:', error);
      throw error;
    }
  }
}; 