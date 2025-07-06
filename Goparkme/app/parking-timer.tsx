import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, SafeAreaView, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { parkingAPI } from '../services/api';

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
  
  const [usage, setUsage] = useState<ParkingUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState(0);

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
      const startTime = new Date(usage.start_time + 'Z'); // 添加Z表示UTC时间
      const now = new Date();
      const diffMs = now.getTime() - startTime.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = diffMs / (1000 * 60 * 60);
      
      setElapsedTime(diffMinutes);
      
      // 计算预估费用（向上取整到小时）
      const hours = Math.ceil(diffHours);
      const cost = hours * usage.hourly_rate;
      setEstimatedCost(cost);
    }
  }, [currentTime, usage]);

  const handleEndParking = async () => {
    if (!usage) return;

    Alert.alert(
      '确认结束',
      `确定要结束使用吗？\n预估费用：¥${estimatedCost}`,
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '确定', 
          style: 'destructive',
          onPress: async () => {
            try {
              setEnding(true);
              await parkingAPI.endParking(usage.parking_spot_id.toString());
              
              Alert.alert('成功', '停车结束，费用已计算', [
                { text: '确定', onPress: () => router.replace('/(tabs)' as any) }
              ]);
            } catch (error: any) {
              console.error('结束使用失败:', error);
              Alert.alert('错误', error.message || '结束使用失败，请重试');
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

      <View style={styles.content}>
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
            <Text style={styles.costAmount}>¥{estimatedCost}</Text>
            <Text style={styles.costNote}>
              按{Math.ceil(elapsedTime / 60)}小时计费
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

        {/* 结束使用按钮 */}
        <TouchableOpacity
          style={[styles.endButton, ending && styles.endButtonDisabled]}
          onPress={handleEndParking}
          disabled={ending}
        >
          {ending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Ionicons name="stop" size={20} color="white" />
              <Text style={styles.endButtonText}>结束使用</Text>
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
    backgroundColor: '#f5f5f7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerBackButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  refreshButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  timerCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  timerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  timerDisplay: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#007AFF',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  timerSubtext: {
    fontSize: 14,
    color: '#666',
  },
  infoCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 16,
    color: '#666',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  costCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  costHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  costTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  costDisplay: {
    alignItems: 'center',
    marginBottom: 8,
  },
  costAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ff9500',
    marginBottom: 4,
  },
  costNote: {
    fontSize: 14,
    color: '#666',
  },
  costDescription: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: '#f0f8ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#007AFF20',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00ff00',
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statusDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  endButton: {
    backgroundColor: '#ff3b30',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  endButtonDisabled: {
    backgroundColor: '#ccc',
  },
  endButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
}); 