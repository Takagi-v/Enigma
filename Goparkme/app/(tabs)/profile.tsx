import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import AuthModal from '../../components/AuthModal';

export default function ProfileScreen() {
  const { user, onLogout, isLoading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const router = useRouter();

  // 如果正在加载，显示加载状态
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>正在加载个人信息...</Text>
      </View>
    );
  }

  // 如果用户未登录，显示引导页面
  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.unauthenticatedContainer}>
          <View style={styles.logoSection}>
            <View style={styles.logo}>
              <Ionicons name="person-outline" size={60} color="#007AFF" />
            </View>
            <Text style={styles.welcomeTitle}>欢迎使用 GoParkMe</Text>
            <Text style={styles.welcomeSubtitle}>
              登录后即可享受完整的停车服务
            </Text>
          </View>

          <View style={styles.featuresSection}>
            <View style={styles.featureItem}>
              <Ionicons name="calendar-outline" size={24} color="#007AFF" />
              <Text style={styles.featureText}>管理预约记录</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="car-outline" size={24} color="#007AFF" />
              <Text style={styles.featureText}>查看停车历史</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="wallet-outline" size={24} color="#007AFF" />
              <Text style={styles.featureText}>管理账户余额</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="settings-outline" size={24} color="#007AFF" />
              <Text style={styles.featureText}>个性化设置</Text>
            </View>
          </View>

          <View style={styles.authButtonsSection}>
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
        </View>

        {/* 登录弹窗 */}
        <AuthModal
          visible={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => setShowAuthModal(false)}
        />
      </View>
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
      onPress: () => {}, // TODO: 实现停车记录页面
    },
    {
      icon: 'wallet-outline',
      title: '账户余额',
      subtitle: '充值和消费记录',
      onPress: () => {}, // TODO: 实现余额页面
    },
    {
      icon: 'settings-outline',
      title: '设置',
      subtitle: '账户设置和偏好',
      onPress: () => {}, // TODO: 实现设置页面
    },
  ];

  return (
    <ScrollView style={styles.container}>
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
        <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
          <Ionicons name="log-out-outline" size={20} color="#ff3b30" />
          <Text style={styles.logoutText}>登出</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f7',
  },
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
  menuSection: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
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
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  logoutSection: {
    margin: 16,
    marginTop: 32,
  },
  logoutButton: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ff3b30',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff3b30',
    marginLeft: 8,
  },
  // 未登录状态的样式
  unauthenticatedContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
    justifyContent: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  featuresSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  featureText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  authButtonsSection: {
    marginBottom: 20,
  },
  loginButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  registerButton: {
    backgroundColor: 'white',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
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
    lineHeight: 20,
  },
}); 