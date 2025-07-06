import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, SafeAreaView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { userAPI } from '../services/api';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleChangePassword = async () => {
    // 验证表单
    if (!formData.currentPassword.trim()) {
      Alert.alert('提示', '请输入当前密码');
      return;
    }

    if (!formData.newPassword.trim()) {
      Alert.alert('提示', '请输入新密码');
      return;
    }

    if (!formData.confirmPassword.trim()) {
      Alert.alert('提示', '请确认新密码');
      return;
    }

    // 验证新密码格式
    if (!/^\d{6}$/.test(formData.newPassword)) {
      Alert.alert('提示', '新密码必须为6位数字');
      return;
    }

    // 验证两次密码输入是否一致
    if (formData.newPassword !== formData.confirmPassword) {
      Alert.alert('提示', '两次输入的新密码不一致');
      return;
    }

    // 验证新密码不能与当前密码相同
    if (formData.currentPassword === formData.newPassword) {
      Alert.alert('提示', '新密码不能与当前密码相同');
      return;
    }

    try {
      setLoading(true);
      await userAPI.changePassword(formData.currentPassword, formData.newPassword);
      
      Alert.alert('成功', '密码修改成功，请重新登录', [
        { text: '确定', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      console.error('修改密码失败:', error);
      let errorMessage = '修改密码失败，请重试';
      
      if (error.message.includes('当前密码不正确')) {
        errorMessage = '当前密码不正确';
      } else if (error.message.includes('新密码必须为6位数字')) {
        errorMessage = '新密码必须为6位数字';
      }
      
      Alert.alert('错误', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>修改密码</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        {/* 说明文字 */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={20} color="#007AFF" />
          <Text style={styles.infoText}>
            为了您的账户安全，密码必须为6位数字
          </Text>
        </View>

        {/* 表单 */}
        <View style={styles.formCard}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>当前密码</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={formData.currentPassword}
                onChangeText={(text) => setFormData({...formData, currentPassword: text})}
                placeholder="请输入当前密码"
                placeholderTextColor="#999"
                secureTextEntry={!showCurrentPassword}
                keyboardType="numeric"
                maxLength={6}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                <Ionicons
                  name={showCurrentPassword ? "eye-off" : "eye"}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>新密码</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={formData.newPassword}
                onChangeText={(text) => setFormData({...formData, newPassword: text})}
                placeholder="请输入新密码（6位数字）"
                placeholderTextColor="#999"
                secureTextEntry={!showNewPassword}
                keyboardType="numeric"
                maxLength={6}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowNewPassword(!showNewPassword)}
              >
                <Ionicons
                  name={showNewPassword ? "eye-off" : "eye"}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>确认新密码</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={formData.confirmPassword}
                onChangeText={(text) => setFormData({...formData, confirmPassword: text})}
                placeholder="请再次输入新密码"
                placeholderTextColor="#999"
                secureTextEntry={!showConfirmPassword}
                keyboardType="numeric"
                maxLength={6}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons
                  name={showConfirmPassword ? "eye-off" : "eye"}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 提交按钮 */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleChangePassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.submitButtonText}>确认修改</Text>
          )}
        </TouchableOpacity>

        {/* 安全提示 */}
        <View style={styles.securityTips}>
          <Text style={styles.tipsTitle}>安全提示：</Text>
          <Text style={styles.tipsText}>• 密码必须为6位数字</Text>
          <Text style={styles.tipsText}>• 新密码不能与当前密码相同</Text>
          <Text style={styles.tipsText}>• 修改密码后需要重新登录</Text>
          <Text style={styles.tipsText}>• 请妥善保管您的密码</Text>
        </View>
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
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 8,
    flex: 1,
  },
  formCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  input: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  eyeButton: {
    padding: 12,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  securityTips: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  tipsText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
}); 