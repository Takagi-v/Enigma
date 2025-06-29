import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function AuthScreen() {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { onLogin } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!account || !password) {
      Alert.alert('提示', '请输入账号和密码');
      return;
    }

    setIsLoading(true);
    try {
      await onLogin({ account, password });
      // 登录成功后，根布局的useEffect会自动处理跳转，这里不需要额外操作
    } catch (error: any) {
      Alert.alert('登录失败', error.message || '发生了未知错误');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.inner}>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Ionicons name="close-circle" size={32} color="#aaa" />
        </TouchableOpacity>

        <Text style={styles.title}>欢迎回来！</Text>
        <Text style={styles.subtitle}>登录以继续使用 GoParkMe</Text>

        <View style={styles.inputContainer}>
          <Ionicons name="person-outline" size={24} color="#888" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="用户名或邮箱"
            value={account}
            onChangeText={setAccount}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor="#888"
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={24} color="#888" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="密码"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor="#888"
          />
        </View>

        <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.loginButtonText}>登 录</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>还没有账号？</Text>
          <TouchableOpacity onPress={() => { /* TODO: Navigate to Register Screen */ }}>
            <Text style={styles.linkText}>立即注册</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f5f5f7',
    width: '100%',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    width: '100%',
    height: 50,
    marginBottom: 15,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: '#333',
  },
  loginButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    marginTop: 20,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    marginTop: 30,
  },
  footerText: {
    color: '#666',
    fontSize: 14,
  },
  linkText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
  },
}); 