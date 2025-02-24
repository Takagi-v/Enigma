import React, { createContext, useState, useContext, useEffect } from 'react';
import config from '../config';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 创建带有认证头的 fetch 函数
  const authFetch = async (url, options = {}) => {
    try {
      const headers = {
        ...options.headers,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      };

      console.log('发送认证请求:', url);
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include'
      });

      // 如果是 401，清除用户状态并重定向到登录页面
      if (response.status === 401) {
        console.log('认证失败，清除用户状态');
        setUser(null);
        throw new Error('请重新登录');
      }

      return response;
    } catch (error) {
      console.error('请求失败:', error);
      // 如果是认证相关的错误，清除用户状态
      if (error.message.includes('登录') || error.message.includes('认证')) {
        setUser(null);
      }
      throw error;
    }
  };

  const checkAuthStatus = async () => {
    try {
      console.log('检查认证状态...');
      const response = await fetch(`${config.API_URL}/auth/status`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      console.log('认证状态响应:', response.status);
      const data = await response.json();
      console.log('认证状态数据:', data);

      if (response.ok && data.isAuthenticated) {
        console.log('用户已认证:', data.user);
        setUser(data.user);
        return true;
      } else {
        console.log('用户未认证');
        setUser(null);
        return false;
      }
    } catch (error) {
      console.error('认证状态检查失败:', error);
      setUser(null);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const login = async (account, password) => {
    try {
      console.log('发送登录请求...');
      const response = await fetch(`${config.API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ account, password })
      });

      console.log('登录响应状态:', response.status);
      console.log('登录响应头:', [...response.headers.entries()]);
      const data = await response.json();
      console.log('登录响应数据:', data);

      if (!response.ok) {
        throw new Error(data.message || '登录失败');
      }

      // 检查 cookie 是否设置成功
      console.log('登录成功，所有 cookies:', document.cookie);
      console.log('当前域名:', window.location.hostname);
      console.log('API URL:', config.API_URL);

      if (data.user) {
        setUser(data.user);
        // 等待一小段时间确保 cookie 已经设置
        await new Promise(resolve => setTimeout(resolve, 500));  // 增加等待时间
        
        console.log('准备验证 token, 当前 cookies:', document.cookie);
        // 验证 token
        const checkResponse = await fetch(`${config.API_URL}/auth/check-token`, {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'  // 添加无缓存头
          }
        });
        
        console.log('Token 检查响应状态:', checkResponse.status);
        console.log('Token 检查响应头:', [...checkResponse.headers.entries()]);
        const checkData = await checkResponse.json();
        console.log('Token 检查结果:', checkData);

        if (checkData.status !== 'success') {
          throw new Error('Token 验证失败');
        }
      } else {
        throw new Error('登录失败：未收到用户信息');
      }

      return data;
    } catch (error) {
      console.error('登录失败:', error);
      setUser(null);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authFetch(`${config.API_URL}/auth/logout`, {
        method: 'POST'
      });
    } catch (error) {
      console.error('登出失败:', error);
    } finally {
      setUser(null);
    }
  };

  // 初始化时检查认证状态
  useEffect(() => {
    const initAuth = async () => {
      await checkAuthStatus();
    };
    initAuth();
  }, []);

  // 定期检查认证状态（仅在用户已登录时）
  useEffect(() => {
    let interval;
    if (user) {
      interval = setInterval(checkAuthStatus, 5 * 60 * 1000); // 每5分钟检查一次
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [user]);

  const value = {
    user,
    setUser,
    loading,
    checkAuthStatus,
    logout,
    login,
    authFetch
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth 必须在 AuthProvider 内部使用');
  }
  return context;
}; 