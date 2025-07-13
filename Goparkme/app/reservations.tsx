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
import { userAPI, parkingAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useProtectedRoute } from '../hooks/useProtectedRoute';
import AuthModal from '../components/AuthModal';
import ReservationCard, { Reservation } from '../components/ReservationCard';


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

  // 页面聚焦时重新获取数据
  useFocusEffect(
    React.useCallback(() => {
      if (!authLoading && user) {
        fetchReservations();
      }
    }, [user, authLoading])
  );

  const fetchReservations = async () => {
    if (!user) return;

    try {
      const data = await userAPI.getUserReservations();
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
        <Text style={styles.title}>我的预约</Text>
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
            <ReservationCard 
              key={reservation.id}
              reservation={reservation}
              onCancel={handleCancelReservation}
            />
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  exploreButton: {
    marginTop: 24,
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  exploreButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});