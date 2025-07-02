import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function useProtectedRoute() {
  const { user, isLoading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      // 用户未登录，显示登录弹窗
      setShowAuthModal(true);
    } else if (user) {
      // 用户已登录，隐藏弹窗
      setShowAuthModal(false);
    }
  }, [user, isLoading]);

  return { 
    user, 
    isLoading, 
    showAuthModal, 
    setShowAuthModal 
  };
} 