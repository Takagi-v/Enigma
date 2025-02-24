import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import './styles/Auth.css';
import config from '../config';
import { useAuth } from '../contexts/AuthContext';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif'];

// 添加验证规则
const VALIDATION_RULES = {
  username: {
    pattern: /^.{4,20}$/,
    message: '用户名必须在4-20个字符之间'
  },
  password: {
    pattern: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/,
    message: '密码必须至少8位，包含数字和字母'
  },
  phone: {
    pattern: /^1[3-9]\d{9}$/,
    message: '请输入正确的手机号码'
  },
  fullName: {
    pattern: /^[\u4e00-\u9fa5a-zA-Z]{2,}$/,
    message: '姓名至少需要2个字符'
  }
};

function Auth() {
  const { setUser, login, authFetch } = useAuth();
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
    avatar: '',
    bio: '',
    address: '',
    account: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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
    }

    setFieldErrors(newErrors);
    return isValid;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      console.log('开始登录请求，账号:', formData.account);
      const response = await login(formData.account, formData.password);
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

    if (registrationStep < 3) {
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
          avatar: formData.avatar,
          bio: formData.bio,
          address: formData.address
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
          avatar: '',
          bio: '',
          address: '',
          account: ''
        });
      }
    } catch (err) {
      setError(err.message || '注册失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 验证文件大小
    if (file.size > MAX_FILE_SIZE) {
      setError('文件大小不能超过5MB');
      return;
    }

    // 验证文件类型
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('只支持 JPG、PNG 和 GIF 格式的图片');
      return;
    }

    try {
      // 创建预览
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          avatar: reader.result
        }));
      };
      reader.readAsDataURL(file);

      // 创建 FormData 用于文件上传
      const formData = new FormData();
      formData.append('avatar', file);

      // 上传到服务器
      const response = await fetch(`${config.API_URL}/auth/upload-avatar`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || '头像上传失败');
      }

      // 更新表单数据中的头像URL
      setFormData(prev => ({
        ...prev,
        avatar: data.avatarUrl
      }));
    } catch (err) {
      setError(err.message || '头像上传失败，请重试');
    }
  };

  const generateRandomUsername = (phone) => {
    const prefix = 'user';
    const randomNum = Math.floor(Math.random() * 10000);
    return `${prefix}${phone.slice(-4)}${randomNum}`;
  };

  const handleQuickRegistration = async (e) => {
    e.preventDefault();
    
    if (!formData.phone || !VALIDATION_RULES.phone.pattern.test(formData.phone)) {
      setError('请输入正确的手机号码');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const username = generateRandomUsername(formData.phone);
      const password = formData.phone.slice(-8);

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
          avatar: '',
          bio: '这个用户很神秘',
          address: ''
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
          alert(`注册成功并已自动登录！\n请记住您的登录信息：\n用户名：${username}\n密码：您手机号的后8位\n您可以稍后在个人设置中修改这些信息。`);
          navigate(from);
        }
      } catch (loginError) {
        console.error('自动登录失败:', loginError);
        alert(`注册成功！但自动登录失败。\n您的登录信息：\n用户名：${username}\n密码：您手机号的后8位\n请使用这些信息手动登录。`);
        setIsLogin(true);
        setRegistrationStep(0);
        setRegistrationType('');
        setFormData({
          username: '',
          password: '',
          fullName: '',
          phone: '',
          avatar: '',
          bio: '',
          address: '',
          account: ''
        });
      }
    } catch (err) {
      setError(err.message || '注册失败，请重试');
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
                avatar: '',
                bio: '',
                address: '',
                account: ''
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
            placeholder="请输入手机号（11位）"
            value={formData.phone}
            onChange={handleInputChange}
            required
          />
          {fieldErrors.phone && <div className="field-error">{fieldErrors.phone}</div>}
          <small className="quick-reg-note">
            注册后，您的用户名将自动生成，密码为手机号后8位
          </small>
          <button type="submit" disabled={isLoading}>
            {isLoading ? '注册中...' : '立即注册'}
          </button>
        </form>
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
        <h2>{registrationStep === 1 ? '基本信息' : registrationStep === 2 ? '个人资料' : '完成注册'}</h2>
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
                placeholder="密码（至少8位，包含数字和字母）"
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
                placeholder="手机号（11位）"
                value={formData.phone}
                onChange={handleInputChange}
                required
              />
              {fieldErrors.phone && <div className="field-error">{fieldErrors.phone}</div>}
            </>
          )}
          {registrationStep === 3 && (
            <>
              <div className="avatar-upload">
                {formData.avatar && (
                  <img 
                    src={formData.avatar} 
                    alt="头像预览" 
                    className="avatar-preview"
                  />
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif"
                  onChange={handleFileUpload}
                />
                <small>支持 JPG、PNG 和 GIF 格式，最大5MB</small>
              </div>
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
            {isLoading ? '处理中...' : (registrationStep < 3 ? '下一步' : '完成注册')}
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
            placeholder="手机号/用户名"
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
      </div>
    );
  };

  return (
    <div className="auth-container">
      {isLogin ? renderLoginForm() : (
        <>
          {registrationStep === 0 && renderRegistrationChoice()}
          {registrationStep > 0 && registrationType === 'quick' && renderQuickRegistration()}
          {registrationStep > 0 && registrationType === 'full' && renderRegistrationStep()}
        </>
      )}
    </div>
  );
}

export default Auth;
