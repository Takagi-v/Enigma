import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { userAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useProtectedRoute } from '../hooks/useProtectedRoute';
import AuthModal from '../components/AuthModal';

interface ParkingRecord {
  id: number;
  parking_spot_id: number;
  start_time: string;
  end_time: string | null;
  total_amount: number | null;
  status: 'active' | 'completed' | 'cancelled';
  vehicle_plate?: string;
  location: string;
  hourly_rate: number;
}

export default function ParkingRecordsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isLoading: authLoading, showAuthModal, setShowAuthModal } = useProtectedRoute();
  const [records, setRecords] = useState<ParkingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      fetchParkingRecords();
    }
  }, [user, authLoading]);

  // 页面聚焦时重新获取数据
  useFocusEffect(
    React.useCallback(() => {
      if (!authLoading && user) {
        fetchParkingRecords();
      }
    }, [user, authLoading])
  );

  const fetchParkingRecords = async () => {
    if (!user) return;

    try {
      const data = await userAPI.getUserParkingUsage();
      setRecords(data.records || []);
    } catch (error) {
      console.error('获取停车记录失败:', error);
      Alert.alert('错误', '获取停车记录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchParkingRecords();
    setRefreshing(false);
  };

  const formatDateTime = (dateTimeStr: string) => {
    const date = new Date(dateTimeStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateDuration = (startTime: string, endTime: string | null) => {
    if (!endTime) return '进行中';
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end.getTime() - start.getTime();
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) {
      const diffMinutes = Math.ceil(diffMs / (1000 * 60));
      return `${diffMinutes}分钟`;
    }
    
    return `${diffHours}小时`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#007AFF';
      case 'completed':
        return '#28a745';
      case 'cancelled':
        return '#6c757d';
      default:
        return '#6c757d';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return '使用中';
      case 'completed':
        return '已完成';
      case 'cancelled':
        return '已取消';
      default:
        return '未知';
    }
  };

  if (authLoading || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <Text style={styles.title}>停车记录</Text>
      </View>

      {records.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="car-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>暂无停车记录</Text>
          <Text style={styles.emptySubtext}>开始使用停车位后记录会显示在这里</Text>
          <TouchableOpacity
            style={styles.exploreButton}
            onPress={() => router.push('/(tabs)/' as any)}
          >
            <Text style={styles.exploreButtonText}>寻找停车位</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {records.map((record) => (
            <View key={record.id} style={styles.recordCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.locationText}>{record.location}</Text>
                <Text style={[styles.statusBadge, { color: getStatusColor(record.status) }]}>
                  {getStatusText(record.status)}
                </Text>
              </View>

              <View style={styles.cardContent}>
                <View style={styles.infoRow}>
                  <Ionicons name="time-outline" size={16} color="#666" />
                  <Text style={styles.infoText}>
                    开始: {formatDateTime(record.start_time)}
                  </Text>
                </View>

                {record.end_time && (
                  <View style={styles.infoRow}>
                    <Ionicons name="checkmark-circle-outline" size={16} color="#666" />
                    <Text style={styles.infoText}>
                      结束: {formatDateTime(record.end_time)}
                    </Text>
                  </View>
                )}

                <View style={styles.infoRow}>
                  <Ionicons name="hourglass-outline" size={16} color="#666" />
                  <Text style={styles.infoText}>
                    时长: {calculateDuration(record.start_time, record.end_time)}
                  </Text>
                </View>

                {record.vehicle_plate && (
                  <View style={styles.infoRow}>
                    <Ionicons name="car-outline" size={16} color="#666" />
                    <Text style={styles.infoText}>车牌: {record.vehicle_plate}</Text>
                  </View>
                )}

                <View style={styles.infoRow}>
                  <Ionicons name="cash-outline" size={16} color="#666" />
                  <Text style={styles.infoText}>
                    费用: {record.total_amount ? `¥${record.total_amount}` : '计算中'}
                  </Text>
                </View>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.detailButton}
                  onPress={() => router.push(`/parking/${record.parking_spot_id}` as any)}
                >
                  <Text style={styles.detailButtonText}>查看停车位</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* 登录弹窗 */}
      <AuthModal
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          fetchParkingRecords();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  exploreButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  exploreButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  recordCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },
  cardContent: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  detailButton: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  detailButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
}); 