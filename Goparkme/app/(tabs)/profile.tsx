import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, SafeAreaView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { userAPI } from '../../services/api';
import AuthModal from '../../components/AuthModal';
import { useParkingStatus } from '../../hooks/useParkingStatus';

export default function ProfileScreen() {
  const { user, onLogout } = useAuth();
  const router = useRouter();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [balance, setBalance] = useState(0);
  const [recentReservations, setRecentReservations] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const { currentUsage, hasActiveUsage, goToTimer, showUsageAlert } = useParkingStatus();

  const fetchUserStats = async () => {
    if (!user) return;
    
    setStatsLoading(true);
    try {
      const [balanceResponse, reservationsResponse] = await Promise.all([
        userAPI.getUserBalance(),
        userAPI.getUserReservations()
      ]);
      
      setBalance(balanceResponse.data.balance || 0);
      setRecentReservations(reservationsResponse.data.slice(0, 3) || []);
    } catch (error) {
      console.error('获取用户统计信息失败:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  // 页面聚焦时刷新数据
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        fetchUserStats();
      }
    }, [user])
  );

  const handleLogout = async () => {
    await onLogout();
    router.replace('/(tabs)' as any);
  };

  // 如果用户未登录，显示引导页面
  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.unauthenticatedContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoSection}>
            <View style={styles.logo}>
              <Ionicons name="car" size={60} color="#007AFF" />
            </View>
            <Text style={styles.appName}>停车易</Text>
            <Text style={styles.welcomeText}>
              欢迎使用停车易！登录后享受更多功能
            </Text>
          </View>

          <View style={styles.featuresSection}>
            <Text style={styles.featuresTitle}>功能特色</Text>
            <View style={styles.featureItem}>
              <Ionicons name="location" size={20} color="#007AFF" />
              <Text style={styles.featureText}>智能找车位</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="time" size={20} color="#007AFF" />
              <Text style={styles.featureText}>在线预约</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="card" size={20} color="#007AFF" />
              <Text style={styles.featureText}>便捷支付</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="shield-checkmark" size={20} color="#007AFF" />
              <Text style={styles.featureText}>安全保障</Text>
            </View>
          </View>

          <View style={styles.authButtons}>
            <TouchableOpacity 
              style={styles.loginButton}
              onPress={() => setShowAuthModal(true)}
            >
              <Text style={styles.loginButtonText}>登录</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.registerButton}
              onPress={() => {
                setShowAuthModal(true);
                // 这里可以传递初始模式为注册，但由于我们的AuthModal组件中有切换功能，先保持简单
              }}
            >
              <Text style={styles.registerButtonText}>注册</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.guestModeText}>
            或者继续以游客身份浏览停车位
          </Text>

          <AuthModal
            visible={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            onSuccess={() => setShowAuthModal(false)}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const menuItems = [
    {
      icon: 'calendar-outline',
      title: '我的预约',
      subtitle: '查看和管理预约记录',
      onPress: () => router.push('/reservations' as any),
    },
    {
      icon: 'car-outline',
      title: '停车记录',
      subtitle: '查看历史停车记录',
      onPress: () => router.push('/parking-records' as any),
    },
    {
      icon: 'wallet-outline',
      title: '账户余额',
      subtitle: '充值和消费记录',
      onPress: () => router.push('/balance' as any),
    },
    {
      icon: 'settings-outline',
      title: '设置',
      subtitle: '账户设置和偏好',
      onPress: () => router.push('/settings' as any),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* 用户信息卡片 */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color="#007AFF" />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.username}>{user.fullName || user.username || '用户'}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
            {user.phone && (
              <Text style={styles.userPhone}>{user.phone}</Text>
            )}
          </View>
        </View>

        {/* 停车状态卡片 */}
        {hasActiveUsage && currentUsage && (
          <View style={styles.parkingStatusCard}>
            <View style={styles.parkingStatusHeader}>
              <View style={styles.parkingStatusIndicator}>
                <View style={styles.parkingStatusDot} />
                <Text style={styles.parkingStatusTitle}>正在使用停车位</Text>
              </View>
              <TouchableOpacity onPress={goToTimer}>
                <Ionicons name="chevron-forward" size={20} color="#007AFF" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.parkingStatusInfo}>
              <View style={styles.parkingStatusItem}>
                <Ionicons name="location" size={16} color="#666" />
                <Text style={styles.parkingStatusText}>{currentUsage.location}</Text>
              </View>
              <View style={styles.parkingStatusItem}>
                <Ionicons name="car" size={16} color="#666" />
                <Text style={styles.parkingStatusText}>{currentUsage.vehicle_plate}</Text>
              </View>
            </View>
            
            <TouchableOpacity style={styles.parkingStatusButton} onPress={goToTimer}>
              <Text style={styles.parkingStatusButtonText}>查看详情</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 统计信息卡片 */}
        <View style={styles.statsCard}>
          <View style={styles.statsHeader}>
            <Text style={styles.statsTitle}>我的数据</Text>
            {statsLoading && <ActivityIndicator size="small" color="#007AFF" />}
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>¥{balance.toFixed(2)}</Text>
              <Text style={styles.statLabel}>账户余额</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{recentReservations.length}</Text>
              <Text style={styles.statLabel}>最近预约</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>积分</Text>
            </View>
          </View>
        </View>

        {/* 最近预约 */}
        {recentReservations.length > 0 && (
          <View style={styles.recentSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>最近预约</Text>
              <TouchableOpacity onPress={() => router.push('/reservations' as any)}>
                <Text style={styles.seeAllText}>查看全部</Text>
              </TouchableOpacity>
            </View>
            {recentReservations.map((reservation: any, index) => (
              <View key={index} style={styles.reservationItem}>
                <View style={styles.reservationIcon}>
                  <Ionicons name="car" size={20} color="#007AFF" />
                </View>
                <View style={styles.reservationInfo}>
                  <Text style={styles.reservationLocation}>{reservation.location}</Text>
                  <Text style={styles.reservationTime}>
                    {reservation.reservation_date} {reservation.start_time.substring(0, 5)} - {reservation.end_time.substring(0, 5)}
                  </Text>
                </View>
                <Text style={styles.reservationAmount}>¥{reservation.total_amount}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 菜单项 */}
        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={item.onPress}
            >
              <View style={styles.menuIcon}>
                <Ionicons name={item.icon as any} size={24} color="#007AFF" />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#ccc" />
            </TouchableOpacity>
          ))}
        </View>

        {/* 登出按钮 */}
        <View style={styles.logoutSection}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#ff3b30" />
            <Text style={styles.logoutText}>登出</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f7',
  },
  // 未登录状态样式
  unauthenticatedContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  welcomeText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresSection: {
    width: '100%',
    marginBottom: 40,
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  featureText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 15,
  },
  authButtons: {
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  loginButton: {
    backgroundColor: '#007AFF',
    borderRadius: 25,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 15,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  registerButton: {
    backgroundColor: 'white',
    borderRadius: 25,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  registerButtonText: {
    color: '#007AFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  guestModeText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 10,
  },
  // 已登录状态样式
  userCard: {
    backgroundColor: 'white',
    padding: 20,
    margin: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 14,
    color: '#666',
  },
  parkingStatusCard: {
    backgroundColor: '#f0f8ff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#007AFF20',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  parkingStatusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  parkingStatusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  parkingStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00ff00',
    marginRight: 8,
  },
  parkingStatusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  parkingStatusInfo: {
    marginBottom: 12,
  },
  parkingStatusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  parkingStatusText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  parkingStatusButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  parkingStatusButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  statsCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  recentSection: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  seeAllText: {
    fontSize: 14,
    color: '#007AFF',
  },
  reservationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  reservationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reservationInfo: {
    flex: 1,
  },
  reservationLocation: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  reservationTime: {
    fontSize: 14,
    color: '#666',
  },
  reservationAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  menuSection: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  logoutSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  logoutButton: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  logoutText: {
    fontSize: 16,
    color: '#ff3b30',
    fontWeight: '500',
    marginLeft: 8,
  },
}); 