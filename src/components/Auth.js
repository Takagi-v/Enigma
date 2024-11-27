import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import './styles/Auth.css';

function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [registrationStep, setRegistrationStep] = useState(1);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    phone: '',
    avatar: '',
    bio: '',
    address: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3000/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '登录失败');
      }

      localStorage.setItem('username', formData.username);
      alert('登录成功！');
      navigate('/messages');
    } catch (err) {
      setError(err.message || '登录失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegistration = async (e) => {
    e.preventDefault();
    
    if (registrationStep < 3) {
      setRegistrationStep(prev => prev + 1);
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3000/register', {
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

      alert('注册成功！请登录。');
      setIsLogin(true);
      setRegistrationStep(1);
      setFormData({
        username: '',
        password: '',
        fullName: '',
        phone: '',
        avatar: '',
        bio: '',
        address: ''
      });
    } catch (err) {
      setError(err.message || '注册失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const decoded = jwtDecode(credentialResponse.credential);
      const googleUsername = decoded.email.split('@')[0];
      
      const response = await fetch('http://localhost:3000/google-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          googleId: decoded.sub,
          email: decoded.email,
          username: googleUsername,
          full_name: decoded.name,
          avatar: decoded.picture
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Google 登录失败');
      }

      if (data.needsRegistration) {
        // 设置初始表单数据
        setFormData(prev => ({
          ...prev,
          username: googleUsername,
          fullName: decoded.name,
          avatar: decoded.picture
        }));
        setIsLogin(false);
        setRegistrationStep(2); // 跳过用户名密码步骤
        return;
      }

      localStorage.setItem('username', googleUsername);
      alert('Google 登录成功！');
      navigate('/messages');
    } catch (err) {
      console.error('Google login error:', err);
      setError(err.message || 'Google 登录失败');
    }
  };

  const renderRegistrationStep = () => {
    switch (registrationStep) {
      case 1:
        return (
          <>
            <h3>第 1 步：基本信息</h3>
            <input
              type="text"
              name="username"
              placeholder="用户名"
              value={formData.username}
              onChange={handleInputChange}
              required
            />
            <input
              type="password"
              name="password"
              placeholder="密码"
              value={formData.password}
              onChange={handleInputChange}
              required
            />
          </>
        );
      case 2:
        return (
          <>
            <h3>第 2 步：个人信息</h3>
            <input
              type="text"
              name="fullName"
              placeholder="姓名"
              value={formData.fullName}
              onChange={handleInputChange}
              required
            />
            <input
              type="tel"
              name="phone"
              placeholder="手机号"
              value={formData.phone}
              onChange={handleInputChange}
              required
            />
          </>
        );
      case 3:
        return (
          <>
            <h3>第 3 步：补充信息</h3>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    setFormData(prev => ({
                      ...prev,
                      avatar: reader.result
                    }));
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
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
        );
      default:
        return null;
    }
  };

  return (
    <div className="auth-container">
      <form onSubmit={isLogin ? handleLogin : handleRegistration} className="auth-form">
        <h2>{isLogin ? '登录' : '注册'}</h2>
        
        {error && <div className="error-message">{error}</div>}
        
        {isLogin ? (
          <>
            <input
              type="text"
              name="username"
              placeholder="用户名"
              value={formData.username}
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
          </>
        ) : (
          renderRegistrationStep()
        )}
        
        <button 
          type="submit" 
          disabled={isLoading || (!isLogin && !formData.username) || (!isLogin && !formData.password)}
        >
          {isLoading ? '处理中...' : (isLogin ? '登录' : 
            registrationStep < 3 ? '下一步' : '完成注册')}
        </button>

        {registrationStep > 1 && !isLogin && (
          <button 
            type="button" 
            onClick={() => setRegistrationStep(prev => prev - 1)}
            className="back-button"
          >
            返回上一步
          </button>
        )}

        {registrationStep === 1 && (
          <>
            <div className="divider">
              <span>或</span>
            </div>

            <div className="google-login-container">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google 登录失败，请重试')}
                text="继续使用 Google"
                shape="rectangular"
                locale="zh_CN"
              />
            </div>
          </>
        )}

        <p className="switch-mode">
          {isLogin ? "还没有账号？ " : "已有账号？ "}
          <button 
            type="button" 
            className="switch-button"
            onClick={() => {
              setIsLogin(!isLogin);
              setRegistrationStep(1);
              setFormData({
                username: '',
                password: '',
                fullName: '',
                phone: '',
                avatar: '',
                bio: '',
                address: ''
              });
            }}
          >
            {isLogin ? '注册' : '登录'}
          </button>
        </p>
      </form>
    </div>
  );
}

export default Auth;
