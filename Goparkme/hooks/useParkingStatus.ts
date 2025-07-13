import { useState, useEffect } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { Alert } from 'react-native';
import { parkingAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import React from 'react';

interface ParkingUsage {
  id: number;
  parking_spot_id: number;
  start_time: string;
  vehicle_plate: string;
  location: string;
  hourly_rate: number;
  status: string;
}

export const useParkingStatus = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [currentUsage, setCurrentUsage] = useState<ParkingUsage | null>(null);
  const [loading, setLoading] = useState(false);

  // 检查当前使用状态
  const checkCurrentUsage = async (silent: boolean = false) => {
    if (!user) {
      setCurrentUsage(null);
      return null;
    }

    try {
      if (!silent) setLoading(true);
      const response = await parkingAPI.getCurrentUsage();
      const usage = response.usage || null;
      setCurrentUsage(usage);
      return usage;
    } catch (error) {
      console.error('检查使用状态失败:', error);
      if (!silent) {
        Alert.alert('错误', '获取使用状态失败');
      }
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // 跳转到计时页面
  const goToTimer = () => {
    if (currentUsage) {
      router.push('/parking-timer' as any);
    } else {
      Alert.alert('提示', '您当前没有正在使用的停车位');
    }
  };

  // 显示使用状态提示
  const showUsageAlert = () => {
    if (!currentUsage) return;

    const startTime = new Date(currentUsage.start_time + 'Z');
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60));
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;

    Alert.alert(
      '正在使用停车位',
      `位置：${currentUsage.location}\n已用时间：${timeStr}\n车牌：${currentUsage.vehicle_plate}`,
      [
        { text: '取消', style: 'cancel' },
        { text: '查看详情', onPress: goToTimer }
      ]
    );
  };

  // 初始化时检查状态
  useEffect(() => {
    if (user) {
      checkCurrentUsage(true);
    }
  }, [user]);

  // 每次屏幕聚焦时刷新状态
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        checkCurrentUsage(true);
      }
    }, [user])
  );

  return {
    currentUsage,
    loading,
    checkCurrentUsage,
    goToTimer,
    showUsageAlert,
    hasActiveUsage: !!currentUsage
  };
}; 