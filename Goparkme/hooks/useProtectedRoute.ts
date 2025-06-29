import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

export function useProtectedRoute() {
  const { authState, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // 如果认证状态还在加载中，则不做任何事
    if (isLoading) {
      return;
    }

    // Expo Router's useSegments can have strict typing.
    // We cast to any to avoid a type error, as we know this logic is sound.
    const inAuthGroup = (segments as any)[0] === 'auth';

    // 如果用户未认证，并且当前不在认证流程相关的页面中
    if (!authState.authenticated && !inAuthGroup) {
      // 重定向到登录页面
      router.replace('/auth');
    }
  }, [authState.authenticated, isLoading, segments, router]);
} 