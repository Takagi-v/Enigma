import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void; // 登录成功后的回调
  initialMode?: 'login' | 'register';
}

export default function AuthModal({
  visible,
  onClose,
  onSuccess,
  initialMode = 'login'
}: AuthModalProps) {
  const { onLogin } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [loading, setLoading] = useState(false);
  
  // 登录表单
  const [loginForm, setLoginForm] = useState({
    account: '',
    password: '',
  });

  // 注册表单
  const [registerForm, setRegisterForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: '',
  });

  const resetForms = () => {
    setLoginForm({ account: '', password: '' });
    setRegisterForm({
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      fullName: '',
      phone: '',
    });
  };

  const handleClose = () => {
    resetForms();
    onClose();
  };

  const handleLogin = async () => {
    if (!loginForm.account || !loginForm.password) {
      Alert.alert('错误', '请填写完整的登录信息');
      return;
    }

    try {
      setLoading(true);
      await onLogin(loginForm);
      Alert.alert('成功', '登录成功！', [
        {
          text: '确定',
          onPress: () => {
            handleClose();
            onSuccess?.();
          },
        },
      ]);
    } catch (error) {
      console.error('登录失败:', error);
      Alert.alert('登录失败', (error as Error).message || '请检查账号密码');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!registerForm.username || !registerForm.email || !registerForm.password) {
      Alert.alert('错误', '请填写完整的注册信息');
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      Alert.alert('错误', '两次输入的密码不一致');
      return;
    }

    if (registerForm.password.length < 6) {
      Alert.alert('错误', '密码长度至少6位');
      return;
    }

    try {
      setLoading(true);
      // TODO: 实现注册API调用
      Alert.alert('提示', '注册功能正在开发中，请使用现有账号登录');
    } catch (error) {
      console.error('注册失败:', error);
      Alert.alert('注册失败', (error as Error).message || '注册过程中出现错误');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    resetForms();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* 头部 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>
            {mode === 'login' ? '登录' : '注册'}
          </Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Logo区域 */}
          <View style={styles.logoSection}>
            <View style={styles.logo}>
              <Ionicons name="car" size={40} color="#007AFF" />
            </View>
            <Text style={styles.appName}>GoParkMe</Text>
            <Text style={styles.slogan}>
              {mode === 'login' ? '欢迎回来' : '加入我们'}
            </Text>
          </View>

          {/* 表单区域 */}
          <View style={styles.formSection}>
            {mode === 'login' ? (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>账号</Text>
                  <TextInput
                    style={styles.input}
                    value={loginForm.account}
                    onChangeText={(text) => setLoginForm({ ...loginForm, account: text })}
                    placeholder="手机号或用户名"
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>密码</Text>
                  <TextInput
                    style={styles.input}
                    value={loginForm.password}
                    onChangeText={(text) => setLoginForm({ ...loginForm, password: text })}
                    placeholder="请输入密码"
                    secureTextEntry
                  />
                </View>

                <TouchableOpacity
                  style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                  onPress={handleLogin}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.submitButtonText}>登录</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>用户名</Text>
                  <TextInput
                    style={styles.input}
                    value={registerForm.username}
                    onChangeText={(text) => setRegisterForm({ ...registerForm, username: text })}
                    placeholder="请输入用户名"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>邮箱</Text>
                  <TextInput
                    style={styles.input}
                    value={registerForm.email}
                    onChangeText={(text) => setRegisterForm({ ...registerForm, email: text })}
                    placeholder="请输入邮箱地址"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>姓名</Text>
                  <TextInput
                    style={styles.input}
                    value={registerForm.fullName}
                    onChangeText={(text) => setRegisterForm({ ...registerForm, fullName: text })}
                    placeholder="请输入真实姓名"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>手机号</Text>
                  <TextInput
                    style={styles.input}
                    value={registerForm.phone}
                    onChangeText={(text) => setRegisterForm({ ...registerForm, phone: text })}
                    placeholder="请输入手机号"
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>密码</Text>
                  <TextInput
                    style={styles.input}
                    value={registerForm.password}
                    onChangeText={(text) => setRegisterForm({ ...registerForm, password: text })}
                    placeholder="请输入密码（至少6位）"
                    secureTextEntry
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>确认密码</Text>
                  <TextInput
                    style={styles.input}
                    value={registerForm.confirmPassword}
                    onChangeText={(text) => setRegisterForm({ ...registerForm, confirmPassword: text })}
                    placeholder="请再次输入密码"
                    secureTextEntry
                  />
                </View>

                <TouchableOpacity
                  style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                  onPress={handleRegister}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.submitButtonText}>注册</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* 切换模式 */}
            <View style={styles.switchSection}>
              <Text style={styles.switchText}>
                {mode === 'login' ? '还没有账号？' : '已有账号？'}
              </Text>
              <TouchableOpacity onPress={switchMode}>
                <Text style={styles.switchLink}>
                  {mode === 'login' ? '立即注册' : '立即登录'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
  closeButton: {
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
    padding: 20,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  slogan: {
    fontSize: 16,
    color: '#666',
  },
  formSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  switchSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  switchText: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  switchLink: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
}); 