import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, SafeAreaView, Button } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { userAPI } from '../../services/api';
import AuthModal from '../../components/AuthModal';
import { useParkingStatus } from '../../hooks/useParkingStatus';
import UnauthenticatedProfile from '../../components/profile/UnauthenticatedProfile';
import UserCard from '../../components/profile/UserCard';
import ParkingStatusCard from '../../components/profile/ParkingStatusCard';
import StatsCard from '../../components/profile/StatsCard';
import RecentReservations from '../../components/profile/RecentReservations';
import CompleteProfileCard from '../../components/profile/CompleteProfileCard';

export default function ProfileScreen() {
  const { user, onLogout } = useAuth();
  const router = useRouter();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [balance, setBalance] = useState(0);
  const [recentReservations, setRecentReservations] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [showCompleteProfileCard, setShowCompleteProfileCard] = useState(false);
  const { currentUsage, hasActiveUsage, goToTimer, showUsageAlert } = useParkingStatus();

  const fetchUserStats = async () => {
    if (!user) return;
    
    setStatsLoading(true);
    try {
      const [balanceResponse, reservationsResponse] = await Promise.all([
        userAPI.getUserBalance(),
        userAPI.getUserReservations()
      ]);
      
      setBalance(balanceResponse.balance || 0);
      setRecentReservations(reservationsResponse.slice(0, 3) || []);
      
      // 检查用户信息是否完整（需要姓名+车牌，车牌从后端通过 req.user.vehiclePlate 注入）
      if (!user.fullName || !user.vehiclePlate) {
        setShowCompleteProfileCard(true);
      } else {
        setShowCompleteProfileCard(false);
      }
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
      <>
        <UnauthenticatedProfile
          onLogin={() => {
            setAuthMode('login');
            setShowAuthModal(true);
          }}
          onRegister={() => {
            setAuthMode('register');
            setShowAuthModal(true);
          }}
        />
        <AuthModal
          visible={showAuthModal}
          initialMode={authMode}
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => setShowAuthModal(false)}
        />
      </>
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
        {/* 提示用户完善资料 */}
        {showCompleteProfileCard && (
          <CompleteProfileCard 
            onPress={() => router.push('/edit-profile' as any)}
          />
        )}

        {/* 用户信息卡片 */}
        <UserCard user={user} />

        {/* 停车状态卡片 */}
        {hasActiveUsage && currentUsage && (
          <ParkingStatusCard currentUsage={currentUsage} goToTimer={goToTimer} />
        )}

        {/* 统计信息卡片 */}
        <StatsCard 
          balance={balance}
          reservationsCount={recentReservations.length}
          isLoading={statsLoading}
        />

        {/* 最近预约 */}
        <RecentReservations 
          reservations={recentReservations}
          onSeeAll={() => router.push('/reservations' as any)}
        />

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
    padding: 20,
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
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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