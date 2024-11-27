import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000';

export const searchParking = async (searchType, keyword) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/parking/search`, {
      params: {
        type: searchType,
        keyword: keyword
      }
    });
    return response.data;
  } catch (error) {
    throw error;
  }
}; 