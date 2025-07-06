import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, SafeAreaView, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { userAPI } from '../services/api';

interface UserInfo {
  id: number;
  username: string;
  email: string;
  fullName: string;
  phone: string;
  avatar?: string;
  bio: string;
  address: string;
}

export default function UserInfoScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserInfo = async () => {
    try {
      setLoading(true);
      const response = await userAPI.getUserProfile();
      setUserInfo(response);
    } catch (error) {
      console.error('获取用户信息失败:', error);
      Alert.alert('错误', '获取用户信息失败');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchUserInfo();
    }, [])
  );

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

  const infoItems = [
    {
      icon: 'person-outline',
      label: '用户名',
      value: userInfo?.username || '未设置',
      editable: false,
    },
    {
      icon: 'mail-outline',
      label: '邮箱',
      value: userInfo?.email || '未设置',
      editable: false,
    },
    {
      icon: 'person-outline',
      label: '姓名',
      value: userInfo?.fullName || '未设置',
      editable: true,
    },
    {
      icon: 'call-outline',
      label: '手机号',
      value: userInfo?.phone || '未设置',
      editable: true,
    },
    {
      icon: 'location-outline',
      label: '地址',
      value: userInfo?.address || '未设置',
      editable: true,
    },
    {
      icon: 'document-text-outline',
      label: '个人简介',
      value: userInfo?.bio || '该用户很神秘',
      editable: true,
    },
  ];

  const actionItems = [
    {
      icon: 'create-outline',
      title: '编辑资料',
      subtitle: '修改个人信息',
      onPress: () => router.push('/edit-profile' as any),
    },
    {
      icon: 'key-outline',
      title: '修改密码',
      subtitle: '更改登录密码',
      onPress: () => router.push('/change-password' as any),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* 头像部分 */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={50} color="#007AFF" />
          </View>
          <Text style={styles.username}>{userInfo?.username || '用户'}</Text>
          <Text style={styles.userEmail}>{userInfo?.email || ''}</Text>
        </View>

        {/* 用户信息卡片 */}
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>个人信息</Text>
          {infoItems.map((item, index) => (
            <View key={index} style={styles.infoItem}>
              <View style={styles.infoLeft}>
                <Ionicons name={item.icon as any} size={20} color="#666" />
                <Text style={styles.infoLabel}>{item.label}</Text>
              </View>
              <Text style={styles.infoValue} numberOfLines={1}>
                {item.value}
              </Text>
            </View>
          ))}
        </View>

        {/* 操作菜单 */}
        <View style={styles.actionCard}>
          <Text style={styles.cardTitle}>账户设置</Text>
          {actionItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.actionItem}
              onPress={item.onPress}
            >
              <View style={styles.actionLeft}>
                <View style={styles.actionIcon}>
                  <Ionicons name={item.icon as any} size={20} color="#007AFF" />
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>{item.title}</Text>
                  <Text style={styles.actionSubtitle}>{item.subtitle}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#ccc" />
            </TouchableOpacity>
          ))}
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
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  avatarSection: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: 'white',
    marginBottom: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#666',
  },
  infoCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  infoLabel: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  infoValue: {
    fontSize: 16,
    color: '#666',
    textAlign: 'right',
    flex: 1,
    marginLeft: 20,
  },
  actionCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 14,
    color: '#666',
  },
}); 