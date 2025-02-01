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
    const response = await fetch(`${config.API_URL}/parking/${parkingId}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId }),
    });
    return await response.json();
  } catch (error) {
    console.error('开始使用停车场失败:', error);
    throw error;
  }
};

// 结束使用停车场
export const endParking = async (parkingId, userId) => {
  try {
    const response = await fetch(`${config.API_URL}/parking/${parkingId}/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId }),
    });
    return await response.json();
  } catch (error) {
    console.error('结束使用停车场失败:', error);
    throw error;
  }
};

// 支付停车费用
export const payParking = async (parkingId, usageId) => {
  try {
    const response = await fetch(`${config.API_URL}/parking/${parkingId}/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ usage_id: usageId }),
    });
    return await response.json();
  } catch (error) {
    console.error('支付停车费用失败:', error);
    throw error;
  }
}; 