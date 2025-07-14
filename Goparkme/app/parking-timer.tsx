import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, SafeAreaView, Alert, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { parkingAPI } from '../services/api';
import { useNavigation } from '@react-navigation/native';

interface ParkingUsage {
  id: number;
  parking_spot_id: number;
  start_time: string;
  vehicle_plate: string;
  location: string;
  hourly_rate: number;
  status: string;
}

export default function ParkingTimerScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  
  const [usage, setUsage] = useState<ParkingUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState(0);

  // 隐藏默认Header，避免与自定义Header重复
  useLayoutEffect(() => {
    navigation.setOptions?.({ headerShown: false });
  }, [navigation]);

  // 获取当前使用状态
  const fetchCurrentUsage = async () => {
    try {
      setLoading(true);
      const response = await parkingAPI.getCurrentUsage();
      
      if (response.usage) {
        setUsage(response.usage);
      } else {
        // 没有正在使用的停车位，跳转回主页
        Alert.alert('提示', '您当前没有正在使用的停车位', [
          { text: '确定', onPress: () => router.replace('/(tabs)' as any) }
        ]);
      }
    } catch (error) {
      console.error('获取使用状态失败:', error);
      Alert.alert('错误', '获取使用状态失败', [
        { text: '返回', onPress: () => router.back() }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // 页面聚焦时刷新数据
  useFocusEffect(
    React.useCallback(() => {
      fetchCurrentUsage();
    }, [])
  );

  // 计时器效果
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 计算已用时间和费用
  useEffect(() => {
    if (usage && usage.start_time) {
      const startTime = new Date(usage.start_time + 'Z'); // 从数据库获取的时间是UTC
      const now = currentTime; // 使用每秒更新的当前时间
      
      const diffMs = now.getTime() - startTime.getTime();
      
      // 确保时间差不为负
      if (diffMs < 0) return;

      const elapsedMinutes = Math.floor(diffMs / (1000 * 60));
      setElapsedTime(elapsedMinutes);
      
      // 计算预估费用 (不足一小时按一小时计)
      // 如果 elapsedMinutes 是 0, elapsedHours 会是 0. 如果是 1-60, 会是 1.
      const elapsedHours = elapsedMinutes === 0 ? 0 : Math.ceil(elapsedMinutes / 60);
      const cost = elapsedHours * usage.hourly_rate;
      setEstimatedCost(cost);
    }
  }, [currentTime, usage]);

  const handleEndParking = async () => {
    if (!usage) return;

    Alert.alert(
      '确认结束停车',
      '请确保您的车辆已完全驶离车位。是否继续？',
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '确定结束', 
          style: 'destructive',
          onPress: async () => {
            try {
              setEnding(true);
              const response = await parkingAPI.endParking(usage.parking_spot_id.toString());
              
              Alert.alert('停车结束', `感谢您的使用！\n最终费用：¥${response.total_amount.toFixed(2)}`, [
                { text: '好的', onPress: () => router.replace('/(tabs)' as any) }
              ]);

            } catch (error: any) {
              console.error('结束使用失败:', error);
              // 直接显示后端返回的错误信息
              Alert.alert('操作失败', error.message || '结束使用失败，请重试');
            } finally {
              setEnding(false);
            }
          }
        }
      ]
    );
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString + 'Z');
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!usage) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={60} color="#ff3b30" />
          <Text style={styles.errorTitle}>没有正在使用的停车位</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/(tabs)' as any)}>
            <Text style={styles.backButtonText}>返回首页</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>停车计时</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={fetchCurrentUsage}>
          <Ionicons name="refresh" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* 计时器显示 */}
        <View style={styles.timerCard}>
          <View style={styles.timerHeader}>
            <Ionicons name="timer" size={24} color="#007AFF" />
            <Text style={styles.timerTitle}>已用时间</Text>
          </View>
          
          <Text style={styles.timerDisplay}>{formatTime(elapsedTime)}</Text>
          <Text style={styles.timerSubtext}>
            开始时间：{formatDateTime(usage.start_time)}
          </Text>
        </View>

        {/* 停车位信息 */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="location" size={20} color="#007AFF" />
            <Text style={styles.infoTitle}>停车位信息</Text>
          </View>
          
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>位置</Text>
            <Text style={styles.infoValue}>{usage.location}</Text>
          </View>
          
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>车牌号</Text>
            <Text style={styles.infoValue}>{usage.vehicle_plate}</Text>
          </View>
          
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>收费标准</Text>
            <Text style={styles.infoValue}>¥{usage.hourly_rate}/小时</Text>
          </View>
        </View>

        {/* 费用信息 */}
        <View style={styles.costCard}>
          <View style={styles.costHeader}>
            <Ionicons name="card" size={20} color="#ff9500" />
            <Text style={styles.costTitle}>费用预估</Text>
          </View>
          
          <View style={styles.costDisplay}>
            <Text style={styles.costAmount}>¥{estimatedCost.toFixed(2)}</Text>
            <Text style={styles.costNote}>
              按{elapsedTime === 0 ? 0 : Math.ceil(elapsedTime / 60)}小时计费
            </Text>
          </View>
          
          <Text style={styles.costDescription}>
            * 不足一小时按一小时计算
          </Text>
        </View>

        {/* 状态指示 */}
        <View style={styles.statusCard}>
          <View style={styles.statusIndicator}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>正在使用中</Text>
          </View>
          
          <Text style={styles.statusDescription}>
            请在停车结束后及时点击"结束使用"按钮
          </Text>
        </View>
      </ScrollView>

      {/* 结束停车按钮 (悬浮) */}
      <View style={styles.fabContainer}>
        <TouchableOpacity 
          style={[styles.endParkingButton, ending && styles.buttonDisabled]}
          onPress={handleEndParking}
          disabled={ending}
        >
          {ending ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="stop-circle-outline" size={24} color="white" />
              <Text style={styles.endParkingButtonText}>结束使用 (¥{estimatedCost.toFixed(2)})</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
  },
  backButton: {
    marginTop: 20,
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerBackButton: {},
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  refreshButton: {},
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100, // Add padding to the bottom to avoid FAB overlap
  },
  timerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  timerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  timerTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  timerDisplay: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  timerSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 10,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  costCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  costHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  costTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    color: '#ff9500',
  },
  costDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 5,
  },
  costAmount: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  costNote: {
    fontSize: 14,
    color: '#666',
  },
  costDescription: {
    fontSize: 12,
    color: '#999',
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#34c759', // Green
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusDescription: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: 'transparent',
  },
  endParkingButton: {
    backgroundColor: '#ff3b30',
    paddingVertical: 15,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  endParkingButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  endButton: {
    backgroundColor: '#ff3b30', // Red
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  closeLockButton: {
    backgroundColor: '#007AFF', // Blue
  },
  endButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
}); 