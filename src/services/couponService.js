import axios from 'axios';
import config from '../config';

const couponService = {
  // 获取用户的优惠券
  getUserCoupons: async (userId) => {
    try {
      const response = await axios.get(`${config.API_URL}/coupons/user/${userId}`, {
        withCredentials: true
      });
      return response.data;
    } catch (error) {
      console.error('获取优惠券失败:', error);
      throw error;
    }
  }
};

export default couponService; 