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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { userAPI, parkingAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useProtectedRoute } from '../hooks/useProtectedRoute';
import AuthModal from '../components/AuthModal';

interface Reservation {
  id: number;
  parking_spot_id: number;
  reservation_date: string;
  start_time: string;
  end_time: string;
  total_amount: number;
  status: 'active' | 'confirmed' | 'cancelled';
  notes?: string;
  location: string;
  hourly_rate: number;
  created_at: string;
}

export default function ReservationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isLoading: authLoading, showAuthModal, setShowAuthModal } = useProtectedRoute();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      fetchReservations();
    }
  }, [user, authLoading]);

  const fetchReservations = async () => {
    if (!user) return;

    try {
      const data = await userAPI.getUserReservations(user.id);
      setReservations(data || []);
    } catch (error) {
      console.error('获取预约列表失败:', error);
      Alert.alert('错误', '获取预约列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchReservations();
    setRefreshing(false);
  };

  const handleCancelReservation = (reservation: Reservation) => {
    Alert.alert(
      '取消预约',
      `确定要取消 ${reservation.location} 的预约吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          style: 'destructive',
          onPress: async () => {
            try {
              await parkingAPI.cancelReservation(
                reservation.parking_spot_id,
                reservation.id
              );
              Alert.alert('成功', '预约已取消');
              fetchReservations(); // 刷新列表
            } catch (error) {
              console.error('取消预约失败:', error);
              Alert.alert('失败', '取消预约失败，请稍后重试');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatTime = (timeStr: string) => {
    return timeStr.substring(0, 5); // 只显示 HH:MM
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#007AFF';
      case 'confirmed':
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
        return '进行中';
      case 'confirmed':
        return '已确认';
      case 'cancelled':
        return '已取消';
      default:
        return '未知';
    }
  };

  const isUpcoming = (date: string, startTime: string) => {
    const reservationDateTime = new Date(`${date} ${startTime}`);
    return reservationDateTime > new Date();
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>我的预约</Text>
        <View style={styles.placeholder} />
      </View>

      {reservations.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>暂无预约记录</Text>
          <Text style={styles.emptySubtext}>去地图找个停车位预约吧</Text>
          <TouchableOpacity
            style={styles.exploreButton}
            onPress={() => router.push('/(tabs)/' as any)}
          >
            <Text style={styles.exploreButtonText}>浏览停车位</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {reservations.map((reservation) => (
            <View key={reservation.id} style={styles.reservationCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.locationText}>{reservation.location}</Text>
                <Text
                  style={[
                    styles.statusBadge,
                    { color: getStatusColor(reservation.status) },
                  ]}
                >
                  {getStatusText(reservation.status)}
                </Text>
              </View>

              <View style={styles.cardContent}>
                <View style={styles.infoRow}>
                  <Ionicons name="calendar-outline" size={16} color="#666" />
                  <Text style={styles.infoText}>
                    {formatDate(reservation.reservation_date)}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="time-outline" size={16} color="#666" />
                  <Text style={styles.infoText}>
                    {formatTime(reservation.start_time)} - {formatTime(reservation.end_time)}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="cash-outline" size={16} color="#666" />
                  <Text style={styles.infoText}>¥{reservation.total_amount}</Text>
                </View>

                {reservation.notes && (
                  <View style={styles.infoRow}>
                    <Ionicons name="document-text-outline" size={16} color="#666" />
                    <Text style={styles.infoText}>{reservation.notes}</Text>
                  </View>
                )}
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.detailButton}
                  onPress={() => router.push(`/parking/${reservation.parking_spot_id}`)}
                >
                  <Text style={styles.detailButtonText}>查看详情</Text>
                </TouchableOpacity>

                {reservation.status !== 'cancelled' &&
                  isUpcoming(reservation.reservation_date, reservation.start_time) && (
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => handleCancelReservation(reservation)}
                    >
                      <Text style={styles.cancelButtonText}>取消预约</Text>
                    </TouchableOpacity>
                  )}
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
           fetchReservations(); // 登录成功后获取预约数据
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    paddingTop: 60, // 为状态栏留出空间
  },
  backButton: {
    padding: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 34,
  },
  content: {
    flex: 1,
    padding: 16,
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
  reservationCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
    justifyContent: 'space-between',
  },
  detailButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  detailButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#dc3545',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
  },
});