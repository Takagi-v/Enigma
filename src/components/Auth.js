import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import './styles/Auth.css';
import config from '../config';
import { useAuth } from '../contexts/AuthContext';

// 测试密码生成逻辑
function testPasswordGeneration(phoneNumber) {
  const digits = phoneNumber.replace(/\D/g, '');
  // 如果以1开头（美国国家代码），则去掉
  const phoneDigits = digits.startsWith('1') && digits.length > 10 ? digits.substring(1) : digits;
  const password = phoneDigits.length >= 6 ? phoneDigits.substring(phoneDigits.length - 6) : phoneDigits.padStart(6, '0');
  console.log(`手机号: ${phoneNumber}, 数字: ${phoneDigits}, 密码: ${password}`);
  return password;
}

// 运行一些测试
console.log('密码生成测试:');
testPasswordGeneration('212-555-1230'); // 应该返回 551230
testPasswordGeneration('(212) 555-1230'); // 应该返回 551230
testPasswordGeneration('2125551230'); // 应该返回 551230
testPasswordGeneration('+12125551230'); // 应该返回 551230
testPasswordGeneration('12125551230'); // 应该返回 551230
testPasswordGeneration('12345'); // 应该返回 012345 (不足6位时补0)

// 添加验证规则
const VALIDATION_RULES = {
  username: {
    pattern: /^.{4,20}$/,
    message: '用户名必须在4-20个字符之间'
  },
  password: {
    pattern: /^\d{6}$/,
    message: '密码必须为6位数字'
  },
  phone: {
    pattern: /^(\+?1)?[- ()]*([2-9][0-9]{2})[- )]*([2-9][0-9]{2})[- ]*([0-9]{4})$/,
    message: '请输入正确的美国手机号码'
  },
  fullName: {
    pattern: /^[a-zA-Z\s]{2,}$/,
    message: '姓名至少需要2个字符'
  },
  vehiclePlate: {
    pattern: /^[A-Z0-9]{1,8}$/i,
    message: '请输入正确的美国车牌格式'
  }
};

function Auth() {
  const { setUser, login, authFetch, googleLogin, bindGoogleVehicle } = useAuth();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/profile';
  const [isLogin, setIsLogin] = useState(false);
  const [registrationStep, setRegistrationStep] = useState(0);
  const [registrationType, setRegistrationType] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    phone: '',
    bio: '',
    address: '',
    account: '',
    vehicle_plate: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showVehiclePlateInput, setShowVehiclePlateInput] = useState(false);
  const [googleUserData, setGoogleUserData] = useState(null);
  const navigate = useNavigate();
  const [fieldErrors, setFieldErrors] = useState({});

  const handleBack = () => {
    if (registrationStep > 0) {
      setRegistrationStep(prev => prev - 1);
    } else if (!isLogin) {
      setIsLogin(true);
    } else {
      navigate(-1);
    }
  };

  const validateField = (name, value) => {
    if (!VALIDATION_RULES[name]) return true;
    
    const { pattern, message } = VALIDATION_RULES[name];
    const isValid = pattern.test(value);
    
    setFieldErrors(prev => ({
      ...prev,
      [name]: isValid ? '' : message
    }));
    
    return isValid;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    validateField(name, value);
  };

  const validateForm = () => {
    const currentStep = registrationStep;
    let isValid = true;
    const newErrors = {};

    if (currentStep === 1) {
      if (!validateField('username', formData.username)) {
        newErrors.username = VALIDATION_RULES.username.message;
        isValid = false;
      }
      if (!validateField('password', formData.password)) {
        newErrors.password = VALIDATION_RULES.password.message;
        isValid = false;
      }
    } else if (currentStep === 2) {
      if (!validateField('fullName', formData.fullName)) {
        newErrors.fullName = VALIDATION_RULES.fullName.message;
        isValid = false;
      }
      if (!validateField('phone', formData.phone)) {
        newErrors.phone = VALIDATION_RULES.phone.message;
        isValid = false;
      }
      if (!validateField('vehiclePlate', formData.vehicle_plate)) {
        newErrors.vehicle_plate = VALIDATION_RULES.vehiclePlate.message;
        isValid = false;
      }
    }

    setFieldErrors(newErrors);
    return isValid;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // 检查是否是手机号格式，如果是则标准化格式
      let account = formData.account;
      if (/^(\+?1)?[- ()]*([2-9][0-9]{2})[- )]*([2-9][0-9]{2})[- ]*([0-9]{4})$/.test(account)) {
        // 提取纯数字
        const digits = account.replace(/\D/g, '');
        // 如果以1开头（美国国家代码），则去掉
        const phoneDigits = digits.startsWith('1') && digits.length > 10 ? digits.substring(1) : digits;
        console.log('登录时检测到手机号格式，标准化为:', phoneDigits);
        account = phoneDigits;
      }
      
      console.log('开始登录请求，账号:', account);
      const response = await login(account, formData.password);
      console.log('登录响应:', response);

      if (response.user) {
        setUser(response.user);
        navigate(from);
      } else {
        throw new Error('登录失败：未收到用户信息');
      }
    } catch (err) {
      console.error('登录错误:', err);
      setError(err.message || '登录失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegistration = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      setError('请修正表单中的错误');
      return;
    }

    if (registrationStep < 2) {
      setRegistrationStep(prev => prev + 1);
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(`${config.API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          full_name: formData.fullName,
          phone: formData.phone,
          bio: formData.bio,
          address: formData.address,
          vehicle_plate: formData.vehicle_plate
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '注册失败');
      }

      // 注册成功后自动登录
      try {
        const loginResponse = await login(formData.username, formData.password);
        if (loginResponse.user) {
          alert('注册成功并已自动登录！');
          navigate(from);
        }
      } catch (loginError) {
        console.error('自动登录失败:', loginError);
        alert('注册成功！但自动登录失败，请手动登录。');
        setIsLogin(true);
        setRegistrationStep(0);
        setFormData({
          username: '',
          password: '',
          fullName: '',
          phone: '',
          bio: '',
          address: '',
          account: '',
          vehicle_plate: ''
        });
      }
    } catch (err) {
      setError(err.message || '注册失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const generateRandomUsername = (phone) => {
    // 从美国手机号中提取数字
    const digits = phone.replace(/\D/g, '');
    // 如果以1开头（美国国家代码），则去掉
    const phoneDigits = digits.startsWith('1') && digits.length > 10 ? digits.substring(1) : digits;
    // 提取最后4位数字作为用户名的一部分
    const lastFourDigits = phoneDigits.slice(-4);
    const prefix = 'user';
    const randomNum = Math.floor(Math.random() * 10000);
    return `${prefix}${lastFourDigits}${randomNum}`;
  };

  const handleQuickRegistration = async (e) => {
    e.preventDefault();
    
    if (!formData.phone || !VALIDATION_RULES.phone.pattern.test(formData.phone)) {
      setError('请输入正确的美国手机号码');
      return;
    }

    if (!formData.vehicle_plate || !VALIDATION_RULES.vehiclePlate.pattern.test(formData.vehicle_plate)) {
      setError('请输入正确的美国车牌号');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const username = generateRandomUsername(formData.phone);
      // 从美国手机号中提取数字
      const digits = formData.phone.replace(/\D/g, '');
      // 如果以1开头（美国国家代码），则去掉
      const phoneDigits = digits.startsWith('1') && digits.length > 10 ? digits.substring(1) : digits;
      
      // 确保提取的是最后6位数字
      const password = phoneDigits.length >= 6 ? phoneDigits.substring(phoneDigits.length - 6) : phoneDigits.padStart(6, '0');
      
      // 调试信息
      console.log('手机号:', formData.phone);
      console.log('处理后的数字:', phoneDigits);
      console.log('生成的密码:', password);

      const response = await fetch(`${config.API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username,
          password: password,
          full_name: '未设置',
          phone: formData.phone,
          bio: '这个用户很神秘',
          address: '',
          vehicle_plate: formData.vehicle_plate
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '注册失败');
      }

      // 注册成功后自动登录
      try {
        const loginResponse = await login(username, password);
        if (loginResponse.user) {
          alert(`注册成功并已自动登录！\n请记住您的登录信息：\n用户名：${username}\n密码：${password}（您手机号的后6位数字）\n您可以稍后在个人设置中修改这些信息。`);
          navigate(from);
        }
      } catch (loginError) {
        console.error('自动登录失败:', loginError);
        alert(`注册成功！但自动登录失败。\n您的登录信息：\n用户名：${username}\n密码：${password}（您手机号的后6位数字）\n请使用这些信息手动登录。`);
        setIsLogin(true);
        setRegistrationStep(0);
        setRegistrationType('');
        setFormData({
          username: '',
          password: '',
          fullName: '',
          phone: '',
          bio: '',
          address: '',
          account: '',
          vehicle_plate: ''
        });
      }
    } catch (err) {
      setError(err.message || '注册失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLoginSuccess = async (credentialResponse) => {
    try {
      setIsLoading(true);
      setError('');
      
      const decoded = jwtDecode(credentialResponse.credential);
      console.log('Google登录成功:', decoded);
      
      // 使用AuthContext中的googleLogin方法
      const loginResult = await googleLogin(credentialResponse.credential);
      
      // 如果需要绑定车牌
      if (loginResult.status === 'needs_vehicle_plate') {
        setGoogleUserData({
          token: credentialResponse.credential,
          email: decoded.email,
          name: decoded.name
        });
        setShowVehiclePlateInput(true);
        return;
      }
      
      // 登录成功，导航到目标页面
      if (loginResult.status === 'success') {
        navigate(from);
      }
    } catch (err) {
      console.error('Google登录错误:', err);
      setError(err.message || 'Google登录失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGoogleLoginError = () => {
    console.error('Google登录失败');
    setError('Google登录失败，请重试');
  };
  
  const handleGoogleUserBindVehiclePlate = async (e) => {
    e.preventDefault();
    
    if (!formData.vehicle_plate || !VALIDATION_RULES.vehiclePlate.pattern.test(formData.vehicle_plate)) {
      setError('请输入正确的美国车牌号');
      return;
    }
    
    setError('');
    setIsLoading(true);
    
    try {
      // 使用AuthContext中的bindGoogleVehicle方法
      const bindResult = await bindGoogleVehicle(googleUserData.token, formData.vehicle_plate);
      
      // 绑定成功，导航到目标页面
      if (bindResult.status === 'success') {
        navigate(from);
      }
    } catch (err) {
      console.error('绑定车牌错误:', err);
      setError(err.message || '绑定车牌失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const renderRegistrationChoice = () => {
    return (
      <div className="auth-form">
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={handleBack}
          className="back-button"
        />
        <h2>选择注册方式</h2>
        <div className="registration-choice">
          <button
            className="choice-button"
            onClick={() => {
              setRegistrationType('quick');
              setRegistrationStep(1);
            }}
          >
            快速注册
            <small>使用手机号快速注册账号</small>
          </button>
          <button
            className="choice-button"
            onClick={() => {
              setRegistrationType('full');
              setRegistrationStep(1);
            }}
          >
            完整注册
            <small>填写完整信息进行注册</small>
          </button>
        </div>
        <div className="social-login">
          <p className="divider"><span>或</span></p>
          <div className="google-login-container">
            <GoogleLogin
              onSuccess={handleGoogleLoginSuccess}
              onError={handleGoogleLoginError}
              theme="filled_blue"
              shape="rectangular"
              text="signup_with"
              locale="zh_CN"
            />
          </div>
        </div>
        <p className="switch-mode">
          已有账号？ 
          <button 
            type="button" 
            className="switch-button"
            onClick={() => {
              setIsLogin(true);
              setRegistrationStep(0);
              setRegistrationType('');
              setFormData({
                username: '',
                password: '',
                fullName: '',
                phone: '',
                bio: '',
                address: '',
                account: '',
                vehicle_plate: ''
              });
            }}
          >
            立即登录
          </button>
        </p>
      </div>
    );
  };

  const renderQuickRegistration = () => {
    return (
      <div className="auth-form">
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={handleBack}
          className="back-button"
        />
        <h2>快速注册</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleQuickRegistration}>
          <input
            type="tel"
            name="phone"
            placeholder="美国手机号 (任意格式均可)"
            value={formData.phone}
            onChange={handleInputChange}
            required
          />
          {fieldErrors.phone && <div className="field-error">{fieldErrors.phone}</div>}
          <input
            type="text"
            name="vehicle_plate"
            placeholder="纽约车牌号 (例如: ABC1234)"
            value={formData.vehicle_plate}
            onChange={handleInputChange}
            required
          />
          {fieldErrors.vehicle_plate && <div className="field-error">{fieldErrors.vehicle_plate}</div>}
          <small className="quick-reg-note">
            注册后，您的用户名将自动生成，密码为您手机号的后6位数字
          </small>
          <button type="submit" disabled={isLoading}>
            {isLoading ? '注册中...' : '立即注册'}
          </button>
        </form>
        <div className="social-login">
          <p className="divider"><span>或</span></p>
          <div className="google-login-container">
            <GoogleLogin
              onSuccess={handleGoogleLoginSuccess}
              onError={handleGoogleLoginError}
              theme="filled_blue"
              shape="rectangular"
              text="signup_with"
              locale="zh_CN"
            />
          </div>
        </div>
      </div>
    );
  };

  const renderRegistrationStep = () => {
    return (
      <div className="auth-form">
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={handleBack}
          className="back-button"
        />
        <h2>{registrationStep === 1 ? '基本信息' : '个人资料'}</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleRegistration}>
          {registrationStep === 1 && (
            <>
              <input
                type="text"
                name="username"
                placeholder="用户名（4-20个字符）"
                value={formData.username}
                onChange={handleInputChange}
                required
              />
              {fieldErrors.username && <div className="field-error">{fieldErrors.username}</div>}
              <input
                type="password"
                name="password"
                placeholder="密码（6位数字）"
                value={formData.password}
                onChange={handleInputChange}
                required
              />
              {fieldErrors.password && <div className="field-error">{fieldErrors.password}</div>}
            </>
          )}
          {registrationStep === 2 && (
            <>
              <input
                type="text"
                name="fullName"
                placeholder="姓名（至少2个字符）"
                value={formData.fullName}
                onChange={handleInputChange}
                required
              />
              {fieldErrors.fullName && <div className="field-error">{fieldErrors.fullName}</div>}
              <input
                type="tel"
                name="phone"
                placeholder="美国手机号 (任意格式均可)"
                value={formData.phone}
                onChange={handleInputChange}
                required
              />
              {fieldErrors.phone && <div className="field-error">{fieldErrors.phone}</div>}
              <input
                type="text"
                name="vehicle_plate"
                placeholder="纽约车牌号 (例如: ABC1234)"
                value={formData.vehicle_plate}
                onChange={handleInputChange}
                required
              />
              {fieldErrors.vehicle_plate && <div className="field-error">{fieldErrors.vehicle_plate}</div>}
              <textarea
                name="bio"
                placeholder="个人简介（选填）"
                value={formData.bio}
                onChange={handleInputChange}
              />
              <input
                type="text"
                name="address"
                placeholder="家庭住址（选填）"
                value={formData.address}
                onChange={handleInputChange}
              />
            </>
          )}
          <button 
            type="submit" 
            disabled={isLoading}
          >
            {isLoading ? '处理中...' : (registrationStep < 2 ? '下一步' : '完成注册')}
          </button>
        </form>
        
        {registrationStep === 1 && (
          <div className="social-login">
            <p className="divider"><span>或</span></p>
            <div className="google-login-container">
              <GoogleLogin
                onSuccess={handleGoogleLoginSuccess}
                onError={handleGoogleLoginError}
                theme="filled_blue"
                shape="rectangular"
                text="signup_with"
                locale="zh_CN"
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderGoogleVehiclePlateForm = () => {
    return (
      <div className="auth-form">
        <h2>完成注册</h2>
        <p>欢迎您，{googleUserData.name}！请绑定您的车牌号以完成注册。</p>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleGoogleUserBindVehiclePlate}>
          <input
            type="text"
            name="vehicle_plate"
            placeholder="纽约车牌号 (例如: ABC1234)"
            value={formData.vehicle_plate}
            onChange={handleInputChange}
            required
          />
          {fieldErrors.vehicle_plate && <div className="field-error">{fieldErrors.vehicle_plate}</div>}
          <button type="submit" disabled={isLoading}>
            {isLoading ? '处理中...' : '完成注册'}
          </button>
        </form>
      </div>
    );
  };

  const renderLoginForm = () => {
    return (
      <div className="auth-form">
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={handleBack}
          className="back-button"
        />
        <h2>登录</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleLogin}>
          <input
            type="text"
            name="account"
            placeholder="手机号/用户名 (任意格式手机号均可)"
            value={formData.account}
            onChange={handleInputChange}
            required
            disabled={isLoading}
          />
          <input
            type="password"
            name="password"
            placeholder="密码"
            value={formData.password}
            onChange={handleInputChange}
            required
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? '登录中...' : '登录'}
          </button>
        </form>
        
        <div className="social-login">
          <p className="divider"><span>或</span></p>
          <div className="google-login-container">
            <GoogleLogin
              onSuccess={handleGoogleLoginSuccess}
              onError={handleGoogleLoginError}
              theme="filled_blue"
              shape="rectangular"
              text="signin_with"
              locale="zh_CN"
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="auth-container">
      {showVehiclePlateInput ? renderGoogleVehiclePlateForm() : (
        isLogin ? renderLoginForm() : (
          <>
            {registrationStep === 0 && renderRegistrationChoice()}
            {registrationStep > 0 && registrationType === 'quick' && renderQuickRegistration()}
            {registrationStep > 0 && registrationType === 'full' && renderRegistrationStep()}
          </>
        )
      )}
    </div>
  );
}

export default Auth;
