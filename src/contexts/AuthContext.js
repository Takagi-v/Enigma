import React, { createContext, useState, useContext, useEffect } from 'react';
import config from '../config';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  // 创建带有认证头的 fetch 函数
  const authFetch = async (url, options = {}) => {
    const headers = {
      ...options.headers,
      'Accept': 'application/json',
    };

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include'
    });

    return response;
  };

  const checkAuthStatus = async () => {
    try {
      const response = await authFetch(`${config.API_URL}/auth/status`);
      const data = await response.json();
      console.log(data);
      if (data.isAuthenticated) {
        setUser(data.user);
        return true;
      } else {
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

  const login = async (username, password) => {
    const response = await authFetch(`${config.API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || '登录失败');
    }

    if (data.user) {
      setUser(data.user);
      // 不再立即检查认证状态
    } else {
      console.error('登录响应缺少用户信息:', data);
      throw new Error('登录失败：未收到完整的用户信息');
    }

    return data;
  };

  const logout = async () => {
    try {
      await authFetch(`${config.API_URL}/auth/logout`, {
        method: 'POST'
      });
      setUser(null);
      setToken(null);
    } catch (error) {
      console.error('登出失败:', error);
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
      interval = setInterval(async () => {
        const isStillAuthenticated = await checkAuthStatus();
        if (!isStillAuthenticated) {
          clearInterval(interval);
        }
      }, 5 * 60 * 1000); // 每5分钟检查一次
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