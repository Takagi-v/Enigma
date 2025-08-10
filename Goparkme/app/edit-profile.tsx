import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, SafeAreaView, Alert } from 'react-native';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
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
  vehiclePlate: string;
  vehicleModel: string;
}

export default function EditProfileScreen() {
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // 表单数据
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    bio: '',
    address: '',
    vehiclePlate: '',
    vehicleModel: '',
  });

  const fetchUserInfo = async () => {
    try {
      setLoading(true);
      const response = await userAPI.getUserProfile();
      setUserInfo(response);
      setFormData({
        fullName: response.fullName || '',
        phone: response.phone || '',
        bio: response.bio || '',
        address: response.address || '',
        vehiclePlate: response.vehiclePlate || '',
        vehicleModel: response.vehicleModel || '',
      });
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

  const handleSave = async () => {
    if (!userInfo) return;

    // 验证必填字段
    if (!formData.fullName.trim()) {
      Alert.alert('提示', '请输入姓名');
      return;
    }

    if (!formData.phone.trim()) {
      Alert.alert('提示', '请输入手机号');
      return;
    }

    if (!formData.vehiclePlate.trim()) {
      Alert.alert('提示', '请输入车牌号');
      return;
    }

    // 验证手机号格式
    const phoneRegex = /^(\+?1)?[- ()]*([2-9][0-9]{2})[- )]*([2-9][0-9]{2})[- ]*([0-9]{4})$/;
    if (!phoneRegex.test(formData.phone)) {
      Alert.alert('提示', '请输入有效的手机号');
      return;
    }

    try {
      setSaving(true);
      const response = await userAPI.updateUserProfile(userInfo.username, {
        full_name: formData.fullName,
        phone: formData.phone,
        bio: formData.bio,
        address: formData.address,
        vehicle_plate: formData.vehiclePlate,
        vehicle_model: formData.vehicleModel,
      });

      // 更新 AuthContext 中的用户信息
      if (response && response.user) {
        updateUser(response.user);
      }
      
      Alert.alert('成功', '个人信息更新成功', [
        { text: '确定', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      console.error('更新用户信息失败:', error);
      Alert.alert('错误', error.message || '更新失败，请重试');
    } finally {
      setSaving(false);
    }
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

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: '编辑资料',
          headerRight: () => (
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <Text style={styles.saveButtonText}>保存</Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* 头像部分 */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color="#007AFF" />
          </View>
          <TouchableOpacity style={styles.changeAvatarButton}>
            <Text style={styles.changeAvatarText}>更换头像</Text>
          </TouchableOpacity>
        </View>

        {/* 表单部分 */}
        <View style={styles.formCard}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>用户名</Text>
            <View style={styles.disabledInput}>
              <Text style={styles.disabledText}>{userInfo?.username || ''}</Text>
            </View>
            <Text style={styles.hint}>用户名不可修改</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>邮箱</Text>
            <View style={styles.disabledInput}>
              <Text style={styles.disabledText}>{userInfo?.email || '未设置'}</Text>
            </View>
            <Text style={styles.hint}>邮箱不可修改</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>姓名 *</Text>
            <TextInput
              style={styles.input}
              value={formData.fullName}
              onChangeText={(text) => setFormData({...formData, fullName: text})}
              placeholder="请输入您的姓名"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>手机号 *</Text>
            <TextInput
              style={styles.input}
              value={formData.phone}
              onChangeText={(text) => setFormData({...formData, phone: text})}
              placeholder="请输入手机号"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
            />
          </View>
          
          <View style={styles.formSectionTitle}>
            <Ionicons name="car-sport-outline" size={20} color="#333" />
            <Text style={styles.sectionTitleText}>车辆信息</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>车牌号 *</Text>
            <TextInput
              style={styles.input}
              value={formData.vehiclePlate}
              onChangeText={(text) => setFormData({...formData, vehiclePlate: text})}
              placeholder="请输入车牌号"
              placeholderTextColor="#999"
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>车型</Text>
            <TextInput
              style={styles.input}
              value={formData.vehicleModel}
              onChangeText={(text) => setFormData({...formData, vehicleModel: text})}
              placeholder="例如：Tesla Model 3"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.formSectionTitle}>
            <Ionicons name="person-outline" size={20} color="#333" />
            <Text style={styles.sectionTitleText}>个人信息</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>地址</Text>
            <TextInput
              style={styles.input}
              value={formData.address}
              onChangeText={(text) => setFormData({...formData, address: text})}
              placeholder="请输入您的地址"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>个人简介</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.bio}
              onChangeText={(text) => setFormData({...formData, bio: text})}
              placeholder="请输入个人简介"
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>车牌号 *</Text>
            <TextInput
              style={styles.input}
              value={formData.vehiclePlate}
              onChangeText={(text) => setFormData({ ...formData, vehiclePlate: text })}
              placeholder="请输入车牌号"
              placeholderTextColor="#999"
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>车辆型号</Text>
            <TextInput
              style={styles.input}
              value={formData.vehicleModel}
              onChangeText={(text) => setFormData({ ...formData, vehicleModel: text })}
              placeholder="例如 Toyota Camry"
              placeholderTextColor="#999"
            />
          </View>
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
  saveButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
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
  changeAvatarButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#f0f8ff',
    borderRadius: 16,
  },
  changeAvatarText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  formCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  formSectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 10,
  },
  sectionTitleText: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: 'white',
  },
  textArea: {
    height: 100,
  },
  disabledInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f5f5f5',
  },
  disabledText: {
    fontSize: 16,
    color: '#999',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
}); 