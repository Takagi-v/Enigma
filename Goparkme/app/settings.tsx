import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

interface SettingItemBase {
  icon: string;
  title: string;
  subtitle: string;
}

interface SettingItemWithPress extends SettingItemBase {
  onPress: () => void;
  showArrow: boolean;
}

interface SettingItemWithSwitch extends SettingItemBase {
  value: boolean;
  onToggle: (value: boolean) => void;
  showSwitch: boolean;
}

type SettingItem = SettingItemWithPress | SettingItemWithSwitch;

export default function SettingsScreen() {
  const router = useRouter();
  const { user, onLogout } = useAuth();
  const [notifications, setNotifications] = useState(true);
  const [locationServices, setLocationServices] = useState(true);
  const [autoLogin, setAutoLogin] = useState(true);

  const handleEditProfile = () => {
    router.push('/user-info' as any);
  };

  const handleChangePassword = () => {
    router.push('/change-password' as any);
  };

  const handlePrivacyPolicy = () => {
    Alert.alert('隐私政策', '隐私政策功能正在开发中...');
  };

  const handleTermsOfService = () => {
    Alert.alert('服务条款', '服务条款功能正在开发中...');
  };

  const handleAbout = () => {
    Alert.alert('关于我们', 'GoParkMe v1.0.0\n\n一个便捷的停车位预约应用');
  };

  const handleLogout = () => {
    Alert.alert(
      '确认登出',
      '您确定要登出吗？',
      [
        { text: '取消', style: 'cancel' },
        { text: '确定', style: 'destructive', onPress: onLogout },
      ]
    );
  };

  const settingsSections = [
    {
      title: '账户设置',
      items: [
        {
          icon: 'person-outline',
          title: '编辑资料',
          subtitle: '修改个人信息',
          onPress: handleEditProfile,
          showArrow: true,
        },
        {
          icon: 'lock-closed-outline',
          title: '修改密码',
          subtitle: '更改登录密码',
          onPress: handleChangePassword,
          showArrow: true,
        },
      ],
    },
    {
      title: '应用设置',
      items: [
        {
          icon: 'notifications-outline',
          title: '推送通知',
          subtitle: '接收预约和支付通知',
          value: notifications,
          onToggle: setNotifications,
          showSwitch: true,
        },
        {
          icon: 'location-outline',
          title: '位置服务',
          subtitle: '允许获取您的位置信息',
          value: locationServices,
          onToggle: setLocationServices,
          showSwitch: true,
        },
        {
          icon: 'log-in-outline',
          title: '自动登录',
          subtitle: '启动时自动登录',
          value: autoLogin,
          onToggle: setAutoLogin,
          showSwitch: true,
        },
      ],
    },
    {
      title: '帮助与支持',
      items: [
        {
          icon: 'shield-outline',
          title: '隐私政策',
          subtitle: '了解我们如何保护您的隐私',
          onPress: handlePrivacyPolicy,
          showArrow: true,
        },
        {
          icon: 'document-text-outline',
          title: '服务条款',
          subtitle: '使用条款和条件',
          onPress: handleTermsOfService,
          showArrow: true,
        },
        {
          icon: 'information-circle-outline',
          title: '关于我们',
          subtitle: '应用版本和信息',
          onPress: handleAbout,
          showArrow: true,
        },
      ],
    },
  ];

  return (
    <View style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <Text style={styles.title}>设置</Text>
      </View>

      <ScrollView>
        {/* 用户信息卡片 */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color="#007AFF" />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.username}>{user?.fullName || user?.username || '用户'}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
        </View>

        {/* 设置选项 */}
        {settingsSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionContent}>
              {section.items.map((item, itemIndex) => (
                                 <TouchableOpacity
                   key={itemIndex}
                   style={[
                     styles.settingItem,
                     itemIndex === section.items.length - 1 && styles.lastItem,
                   ]}
                   onPress={'onPress' in item ? item.onPress : undefined}
                   disabled={'showSwitch' in item}
                 >
                   <View style={styles.settingIcon}>
                     <Ionicons name={item.icon as any} size={20} color="#007AFF" />
                   </View>
                   <View style={styles.settingContent}>
                     <Text style={styles.settingTitle}>{item.title}</Text>
                     <Text style={styles.settingSubtitle}>{item.subtitle}</Text>
                   </View>
                   {'showSwitch' in item && (
                     <Switch
                       value={item.value}
                       onValueChange={item.onToggle}
                       trackColor={{ false: '#767577', true: '#007AFF' }}
                       thumbColor={item.value ? '#ffffff' : '#f4f3f4'}
                     />
                   )}
                   {'showArrow' in item && (
                     <Ionicons name="chevron-forward" size={20} color="#ccc" />
                   )}
                 </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* 登出按钮 */}
        <View style={styles.logoutSection}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#ff3b30" />
            <Text style={styles.logoutText}>登出</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
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
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 16,
    marginBottom: 8,
  },
  sectionContent: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  settingIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  settingSubtitle: {
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
    fontWeight: '600',
    color: '#ff3b30',
    marginLeft: 8,
  },
}); 