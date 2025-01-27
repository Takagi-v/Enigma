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