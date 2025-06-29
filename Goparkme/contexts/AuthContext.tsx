import React, { createContext, useState, useContext, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { userAPI } from '../services/api'; // 假设你的api.js导出了这些

const TOKEN_KEY = 'my-jwt'; // 用于存储token的key

// 定义User类型
interface User {
  id: number;
  username: string;
  email: string;
  // ... 其他用户字段
}

// 定义AuthContext类型
interface AuthContextType {
  authState: { token: string | null; authenticated: boolean };
  onLogin: (credentials: any) => Promise<void>; // 暂时保持any，或定义具体类型
  onLogout: () => Promise<void>;
  user: User | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  authState: { token: null, authenticated: false },
  onLogin: async () => {},
  onLogout: async () => {},
  user: null,
  isLoading: true,
});

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [authState, setAuthState] = useState<{ token: string | null; authenticated: boolean }>({
    token: null,
    authenticated: false,
  });
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTokenAndUser = async () => {
      try {
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        if (token) {
          // 使用token获取用户信息
          const userData = await userAPI.getUserProfile(token);
          if (userData) {
            setUser(userData);
            setAuthState({ token, authenticated: true });
          } else {
            // token无效，清除
            await SecureStore.deleteItemAsync(TOKEN_KEY);
          }
        }
      } catch (e) {
        console.error('Failed to load token or user', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadTokenAndUser();
  }, []);

  const login = async (credentials: any) => {
    try {
      const response = await userAPI.login(credentials);
      if (response && response.token && response.user) {
        setAuthState({ token: response.token, authenticated: true });
        setUser(response.user);
        await SecureStore.setItemAsync(TOKEN_KEY, response.token);
      } else {
        throw new Error('Login failed: No token or user info received');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setAuthState({ token: null, authenticated: false });
    setUser(null);
  };

  const value = {
    onLogin: login,
    onLogout: logout,
    authState,
    user,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 