import React, { useState, useEffect } from 'react';
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
import { userAPI } from '../services/api';

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMode?: 'login' | 'register';
}

/**
 * @name AuthModal
 * @description 一个处理用户登录和多步骤注册流程的模态框组件。
 *
 * @prop {boolean} visible - 控制模态框的显示与隐藏。
 * @prop {() => void} onClose - 关闭模态框时调用的函数。
 * @prop {() => void} [onSuccess] - 登录或注册成功后调用的可选函数。
 * @prop {'login' | 'register'} [initialMode] - 模态框打开时默认显示的模式。
 */
export default function AuthModal({
  visible,
  onClose,
  onSuccess,
  initialMode = 'login',
}: AuthModalProps) {
  const { onLogin, onRegister } = useAuth(); // 使用AuthContext中的onRegister
  
  // 'login' 或 'register'，控制当前显示的表单类型
  const [mode, setMode] = useState(initialMode);
  const [loading, setLoading] = useState(false);

  // 注册流程分为三个步骤: 1: 输入手机号, 2: 输入验证码, 3: 输入个人信息
  const [registerStep, setRegisterStep] = useState(1);
  
  // 用于在界面上显示测试验证码
  const [displayedCode, setDisplayedCode] = useState<string | null>(null);

  // 登录表单的状态
  const [loginForm, setLoginForm] = useState({ account: '', password: '' });

  // 注册表单的统一状态管理
  const [registerForm, setRegisterForm] = useState({
    phone: '',
    code: '',
    username: '',
    password: '',
    fullName: '',
    vehiclePlate: '',
    isVerified: false, // 标记手机号是否已通过验证
  });

  // Effect: 当模态框可见性或初始模式变化时，重置所有状态
  useEffect(() => {
    if (visible) {
      setMode(initialMode);
      setRegisterStep(1); // 每次打开时重置注册步骤
      setDisplayedCode(null); // 重置显示的验证码
      resetForms();
    }
  }, [visible, initialMode]);

  // 重置所有表单数据
  const resetForms = () => {
    setLoginForm({ account: '', password: '' });
    setRegisterForm({
      phone: '',
      code: '',
      username: '',
      password: '',
      fullName: '',
      vehiclePlate: '',
      isVerified: false,
    });
  };

  // 封装的关闭处理函数，确保在关闭前回滚所有状态
  const handleClose = () => {
    resetForms();
    onClose();
  };

  /**
   * @description 处理用户登录
   */
  const handleLogin = async () => {
    if (!loginForm.account || !loginForm.password) {
      Alert.alert('错误', '请填写完整的登录信息');
      return;
    }
    setLoading(true);
    try {
      await onLogin(loginForm);
      Alert.alert('成功', '登录成功！', [
        { text: '确定', onPress: () => { handleClose(); onSuccess?.(); } },
      ]);
    } catch (error) {
      console.error('登录失败:', error);
      Alert.alert('登录失败', (error as Error).message || '请检查账号密码');
    } finally {
      setLoading(false);
    }
  };

  // --- 注册流程函数 ---

  /**
   * @description 步骤1: 发送手机验证码
   */
  const handleSendCode = async () => {
    if (!registerForm.phone) {
      Alert.alert('错误', '请输入手机号码');
      return;
    }
    setLoading(true);
    try {
      const response = await userAPI.sendVerificationCode(registerForm.phone);
      // 在测试环境中，直接显示验证码
      if (response.verificationCode) {
        setDisplayedCode(response.verificationCode);
        Alert.alert('成功', '测试验证码已生成');
      } else {
        Alert.alert('成功', '验证码已发送');
      }
      setRegisterStep(2);
    } catch (error: any) {
      Alert.alert('错误', error.message || '发送验证码失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * @description 步骤2: 校验验证码
   */
  const handleVerifyCode = async () => {
    if (!registerForm.code) {
      Alert.alert('错误', '请输入验证码');
      return;
    }
    setLoading(true);
    try {
      await userAPI.verifyCode(registerForm.phone, registerForm.code);
      setRegisterForm(prev => ({ ...prev, isVerified: true }));
      Alert.alert('成功', '手机号验证成功！');
      setRegisterStep(3);
    } catch (error: any) {
      Alert.alert('错误', error.message || '验证码不正确或已过期');
    } finally {
      setLoading(false);
    }
  };

  /**
   * @description 步骤3: 提交完整的注册信息
   */
  const handleRegister = async () => {
    const { username, password, fullName, vehiclePlate, phone, isVerified } = registerForm;
    if (!username || !password || !fullName || !vehiclePlate) {
      Alert.alert('错误', '请填写所有必填项');
      return;
    }
    if (password.length < 6) {
      Alert.alert('错误', '密码长度至少6位');
      return;
    }
    setLoading(true);
    try {
      await onRegister({
        username,
        password,
        fullName,
        vehiclePlate,
        phone,
        verified: isVerified,
      });
      Alert.alert('成功', '注册成功！现在您可以登录了。', [
        { text: '好的', onPress: handleClose },
      ]);
    } catch (error: any) {
      Alert.alert('注册失败', error.message || '注册过程中出现错误');
    } finally {
      setLoading(false);
    }
  };

  /**
   * @description 在登录和注册模式之间切换，并重置状态
   */
  const switchMode = () => {
    setMode(prev => (prev === 'login' ? 'register' : 'login'));
    setRegisterStep(1); // 切换模式时重置注册步骤
    resetForms();
  };

  // --- 渲染函数 ---

  /**
   * @description 根据注册步骤 `registerStep` 渲染不同的表单视图
   */
  const renderRegisterForm = () => {
    // 步骤1: 用户输入手机号以下发验证码
    if (registerStep === 1) { 
      return (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>手机号码</Text>
            <TextInput
              style={styles.input}
              value={registerForm.phone}
              onChangeText={(text) => setRegisterForm({ ...registerForm, phone: text })}
              placeholder="请输入您的手机号"
              keyboardType="phone-pad"
            />
          </View>
          <TouchableOpacity style={[styles.submitButton, loading && styles.submitButtonDisabled]} onPress={handleSendCode} disabled={loading}>
            {loading ? <ActivityIndicator color="white" /> : <Text style={styles.submitButtonText}>发送验证码</Text>}
          </TouchableOpacity>
        </>
      );
    }
    // 步骤2: 用户输入收到的验证码进行校验
    if (registerStep === 2) { 
      return (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>验证码</Text>
            {displayedCode && (
              <View style={styles.codeDisplayContainer}>
                <Text style={styles.codeDisplayText}>
                  测试验证码: {displayedCode}
                </Text>
              </View>
            )}
            <TextInput
              style={styles.input}
              value={registerForm.code}
              onChangeText={(text) => setRegisterForm({ ...registerForm, code: text })}
              placeholder="请输入6位验证码"
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>
          <TouchableOpacity style={[styles.submitButton, loading && styles.submitButtonDisabled]} onPress={handleVerifyCode} disabled={loading}>
            {loading ? <ActivityIndicator color="white" /> : <Text style={styles.submitButtonText}>验证并继续</Text>}
          </TouchableOpacity>
           <TouchableOpacity onPress={() => setRegisterStep(1)} style={styles.linkButton}>
            <Text style={styles.linkText}>返回修改手机号</Text>
          </TouchableOpacity>
        </>
      );
    }
    // 步骤3: 手机号验证通过后，用户输入其余个人信息
    if (registerStep === 3) { 
      return (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>用户名</Text>
            <TextInput style={styles.input} value={registerForm.username} onChangeText={(text) => setRegisterForm({ ...registerForm, username: text })} placeholder="创建您的用户名" />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>密码 (至少6位)</Text>
            <TextInput style={styles.input} value={registerForm.password} onChangeText={(text) => setRegisterForm({ ...registerForm, password: text })} placeholder="创建您的密码" secureTextEntry />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>姓名</Text>
            <TextInput style={styles.input} value={registerForm.fullName} onChangeText={(text) => setRegisterForm({ ...registerForm, fullName: text })} placeholder="您的真实姓名" />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>车牌号</Text>
            <TextInput style={styles.input} value={registerForm.vehiclePlate} onChangeText={(text) => setRegisterForm({ ...registerForm, vehiclePlate: text })} placeholder="您的常用车牌号" />
          </View>
          <TouchableOpacity style={[styles.submitButton, loading && styles.submitButtonDisabled]} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="white" /> : <Text style={styles.submitButtonText}>完成注册</Text>}
          </TouchableOpacity>
        </>
      );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>{mode === 'login' ? '登录' : '创建账户'}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.logoSection}>
            <Ionicons name="car-sport" size={40} color="#007AFF" />
            <Text style={styles.appName}>停车易</Text>
            <Text style={styles.slogan}>{mode === 'login' ? '欢迎回来' : '只需几步，轻松停车'}</Text>
          </View>

          <View style={styles.formSection}>
            {mode === 'login' ? (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>账号</Text>
                  <TextInput style={styles.input} value={loginForm.account} onChangeText={(text) => setLoginForm({ ...loginForm, account: text })} placeholder="手机号或用户名" autoCapitalize="none" />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>密码</Text>
                  <TextInput style={styles.input} value={loginForm.password} onChangeText={(text) => setLoginForm({ ...loginForm, password: text })} placeholder="请输入密码" secureTextEntry />
                </View>
                <TouchableOpacity style={[styles.submitButton, loading && styles.submitButtonDisabled]} onPress={handleLogin} disabled={loading}>
                  {loading ? <ActivityIndicator color="white" /> : <Text style={styles.submitButtonText}>登录</Text>}
                </TouchableOpacity>
              </>
            ) : (
              renderRegisterForm()
            )}
          </View>

          <View style={styles.switchModeContainer}>
            <Text style={styles.switchModeText}>{mode === 'login' ? '还没有账户？' : '已经有账户了？'}</Text>
            <TouchableOpacity onPress={switchMode}>
              <Text style={styles.switchModeButton}>{mode === 'login' ? '立即注册' : '立即登录'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f7' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: Platform.OS === 'ios' ? 20 : 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  closeButton: {},
  title: { fontSize: 18, fontWeight: '600', color: '#333' },
  content: { flex: 1, paddingHorizontal: 25 },
  logoSection: { alignItems: 'center', paddingVertical: 30 },
  appName: { fontSize: 24, fontWeight: 'bold', color: '#007AFF', marginTop: 10 },
  slogan: { fontSize: 16, color: '#666', marginTop: 5 },
  formSection: {},
  inputGroup: {
    width: '100%',
    marginBottom: 20,
  },
  label: { fontSize: 14, color: '#666', marginBottom: 8, fontWeight: '500' },
  input: {
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    height: 50,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  switchModeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  switchModeText: { fontSize: 14, color: '#666' },
  switchModeButton: { fontSize: 14, color: '#007AFF', marginLeft: 5, fontWeight: '600' },
  linkButton: { marginTop: 15, alignItems: 'center' },
  linkText: { fontSize: 14, color: '#007AFF' },
  codeDisplayContainer: {
    marginVertical: 10,
    padding: 10,
    backgroundColor: '#eef2f5',
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  codeDisplayText: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
  },
}); 