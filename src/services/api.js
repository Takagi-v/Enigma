import config from '../config';

export const api = {
  login: (data) => fetch(`${config.API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }),
  
  register: (data) => fetch(`${config.API_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }),
  
  // ... 其他 API 请求
}; 