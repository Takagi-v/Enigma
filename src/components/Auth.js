import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import './styles/Auth.css';
import config from '../config';
import { useAuth } from '../contexts/AuthContext';

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
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetPasswordStep, setResetPasswordStep] = useState(0);
  const [resetToken, setResetToken] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    phone: '',
    bio: '',
    address: '',
    account: '',
    vehicle_plate: '',
    verificationCode: '',
    newPassword: '',
    confirmPassword: '',
    agreementChecked: false,
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showVehiclePlateInput, setShowVehiclePlateInput] = useState(false);
  const [googleUserData, setGoogleUserData] = useState(null);
  const navigate = useNavigate();
  const [fieldErrors, setFieldErrors] = useState({});
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

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

  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: checked
    }));
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
      if (!formData.agreementChecked) {
        newErrors.agreementChecked = '请阅读并勾选同意注册协议';
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

  const sendVerificationCode = async () => {
    if (!formData.phone || !VALIDATION_RULES.phone.pattern.test(formData.phone)) {
      setError('请输入正确的美国手机号码');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${config.API_URL}/auth/send-verification-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: formData.phone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '发送验证码失败');
      }

      setCodeSent(true);
      setError('');
      
      // 设置60秒倒计时
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      console.error('发送验证码错误:', err);
      setError(err.message || '发送验证码失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!formData.verificationCode) {
      setError('请输入验证码');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${config.API_URL}/auth/verify-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: formData.phone,
          code: formData.verificationCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '验证码验证失败');
      }

      setPhoneVerified(true);
      setError('');
      
      // 验证成功后进入下一步
      setRegistrationStep(prev => prev + 1);
    } catch (err) {
      console.error('验证码验证错误:', err);
      setError(err.message || '验证码验证失败，请重试');
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

    // 如果是第一步（手机号验证步骤）
    if (registrationStep === 0) {
      if (!phoneVerified) {
        if (!codeSent) {
          sendVerificationCode();
        } else {
          verifyCode();
        }
      } else {
        setRegistrationStep(prev => prev + 1);
      }
      return;
    }

    // 如果是中间步骤
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
          vehicle_plate: formData.vehicle_plate,
          verified: phoneVerified
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
          vehicle_plate: '',
          verificationCode: '',
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
    e && e.preventDefault();
    
    // 如果手机号还未验证
    if (!phoneVerified) {
      if (!codeSent) {
        // 发送验证码
        sendVerificationCode();
        return;
      } else {
        // 验证验证码
        verifyCode();
        return;
      }
    }
    
    // 验证必填字段
    if (!formData.phone) {
      setError('手机号不能为空');
      return;
    }
    
    if (!formData.vehicle_plate) {
      setError('车牌号不能为空');
      return;
    }
    
    if (!formData.agreementChecked) {
      setError('请阅读并勾选同意注册协议');
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
          bio: '',
          address: '',
          vehicle_plate: formData.vehicle_plate,
          verified: phoneVerified
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
          vehicle_plate: '',
          verificationCode: '',
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
    
    if (!formData.vehicle_plate) {
      setError('请输入车牌号');
      return;
    }
    
    if (!formData.agreementChecked) {
      setError('请阅读并勾选同意注册协议');
      return;
    }
    
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

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!formData.phone || !VALIDATION_RULES.phone.pattern.test(formData.phone)) {
      setError('请输入正确的美国手机号码');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${config.API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: formData.phone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '发送验证码失败');
      }

      setCodeSent(true);
      setError('');
      
      // 设置60秒倒计时
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      console.error('发送重置密码验证码错误:', err);
      setError(err.message || '发送验证码失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyResetCode = async () => {
    if (!formData.verificationCode) {
      setError('请输入验证码');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${config.API_URL}/auth/verify-reset-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: formData.phone,
          code: formData.verificationCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '验证码验证失败');
      }

      setResetToken(data.token);
      setError('');
      
      // 验证成功后进入下一步
      setResetPasswordStep(1);
    } catch (err) {
      console.error('验证重置密码验证码错误:', err);
      setError(err.message || '验证码验证失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    if (!formData.newPassword || !formData.confirmPassword) {
      setError('请填写新密码和确认密码');
      return;
    }
    
    if (formData.newPassword !== formData.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    
    if (!/^\d{6}$/.test(formData.newPassword)) {
      setError('密码必须为6位数字');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${config.API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: resetToken,
          newPassword: formData.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '重置密码失败');
      }

      // 重置成功，返回登录界面
      setIsForgotPassword(false);
      setResetPasswordStep(0);
      setResetToken('');
      setFormData({
        ...formData,
        phone: '',
        verificationCode: '',
        newPassword: '',
        confirmPassword: '',
      });
      setError('');
      alert('密码重置成功，请使用新密码登录');
    } catch (err) {
      console.error('重置密码错误:', err);
      setError(err.message || '重置密码失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const renderAgreement = () => {
    return (
      <div className="agreement-container">
        <div className="agreement-checkbox-container">
          <input
            type="checkbox"
            id="agreementChecked"
            name="agreementChecked"
            checked={formData.agreementChecked}
            onChange={handleCheckboxChange}
          />
          <label htmlFor="agreementChecked">我已阅读并同意</label>
          <button 
            type="button" 
            className="agreement-link"
            onClick={() => document.getElementById('agreementModal').style.display = 'block'}
          >
            《注册使用协议》
          </button>
        </div>
        {fieldErrors.agreementChecked && <span className="error-message">{fieldErrors.agreementChecked}</span>}
        
        <div id="agreementModal" className="agreement-modal">
          <div className="agreement-modal-content">
            <span className="close" onClick={() => document.getElementById('agreementModal').style.display = 'none'}>&times;</span>
            <h2>注册使用协议</h2>
            <div className="agreement-text">
              <p><strong>最后更新日期： [2025年4月18日]</strong></p>
              <p>欢迎使用 Goparkme（以下简称"本平台"或"我们"）！</p>
              <p>本协议是您（以下简称"用户"或"您"）与 Goparkme之间关于注册和使用本平台所提供服务的法律协议。</p>
              <p>在您点击"同意"按钮完成注册程序前，请务必仔细阅读、充分理解本协议各条款内容，特别是免除或者限制责任的条款、法律适用和争议解决条款。</p>
              <p>如果您不同意本协议的任何内容，或者无法准确理解本协议任何条款的含义，请不要进行后续操作。一旦您点击"同意"并完成注册，即表示您已充分阅读、理解并接受本协议的全部内容，并同意作为协议一方受其约束。</p>
              
              <h3>1. 服务描述</h3>
              <p>1.1 本平台是一个信息共享平台，旨在连接拥有闲置停车位（通常是住宅停车场或车道）的业主（以下简称"车位主"）与寻找停车位的驾驶员（即"用户"）。</p>
              <p>1.2 车位主可以在其闲置停车位安装由我们提供的指定地锁，并将停车位信息（位置、可用时间、价格等）发布在本平台上。</p>
              <p>1.3 注册用户可以通过本平台浏览、搜索车位信息，并根据显示的价格和时间预订并支付停车费用。</p>
              <p>1.4 本平台提供信息发布、搜索、预订、支付处理等技术服务，以促进车位主与用户之间的交易。</p>
              
              <h3>2. 用户资格与义务</h3>
              <p>2.1 您确认，在您完成注册程序或以其他本平台允许的方式实际使用服务时，您应当是具备完全民事权利能力和完全民事行为能力的自然人、法人或其他组织。若您不具备前述主体资格，则您及您的监护人应承担因此而导致的一切后果，且本平台有权注销您的账户。</p>
              <p>2.2 您需要提供准确、最新、完整的注册信息，并及时更新。</p>
              <p>2.3 您对您的账户和密码负有保管责任，并对通过您的账户进行的所有活动承担责任。</p>
              <p>2.4 保险要求（重要条款）：</p>
              <ul>
                <li>您确认并承诺，在使用本平台任何服务前，您已为您计划用于停泊的车辆购买了符合当地（您计划停车地点所属司法管辖区）所有法律要求的有效汽车保险，包括但不限于责任险。</li>
                <li>您理解并同意，维持有效的、符合当地法律要求的汽车保险是使用本平台服务的前提条件。如果您未能持有或维持此类保险，您将无权使用本平台的任何服务。</li>
                <li>您同意在本平台要求时，提供您的保险证明。</li>
                <li>您同意，对于因使用停车位而可能发生的任何车辆损坏、被盗、个人物品损失、对车位主财产（包括房屋、车道、地锁等）造成的损坏、或其他任何事故或损失，均由您和/或您的保险公司承担责任。</li>
              </ul>
              <p>2.5 您同意遵守所有适用的地方、州和联邦法律法规，包括但不限于交通规则和停车规定。</p>
              <p>2.6 您同意按照预订的时间使用和离开停车位，尊重车位主的财产，不进行任何非法或滋扰活动。</p>
              
              <h3>3. 服务使用规范</h3>
              <p>3.1 您应通过本平台完成停车位的预订和支付流程。</p>
              <p>3.2 您应妥善使用车位主提供的停车位及相关设施（如地锁），如因您的原因造成损坏，您应承担赔偿责任。</p>
              <p>3.3 您停放的车辆尺寸和类型应符合车位主在平台上描述的要求。</p>
              
              <h3>4. 费用与支付</h3>
              <p>4.1 您同意按照本平台公示的价格支付停车费用。</p>
              <p>4.2 支付将通过本平台指定的第三方支付渠道进行。您同意遵守相关支付服务的条款和条件。</p>
              <p>4.3 退款政策（如有）将另行规定或在本平台相关页面公示。</p>
              
              <h3>5. 责任限制与免责声明</h3>
              <p>5.1 本平台仅作为信息发布和交易促成平台，并非停车服务的直接提供者，也不是车位主或用户的代理人。</p>
              <p>5.2 本平台不对以下事项承担任何责任：</p>
              <ul>
                <li>任何用户车辆的损坏、被盗或车内物品的损失。</li>
                <li>用户在使用停车位过程中对车位主财产（包括但不限于房屋、车道、景观、地锁）造成的任何碰撞、损坏。</li>
                <li>因使用停车位或进出停车位而导致的任何人身伤害。</li>
                <li>车位主提供信息的准确性、完整性或及时性（尽管我们会进行合理审核）。</li>
                <li>停车位的实际可用性、安全性或适用性。</li>
                <li>用户与车位主之间的任何争议。</li>
              </ul>
              <p>5.3 您明确同意，所有因停车引起的风险、责任和索赔，包括但不限于车辆损坏、财产损失、人身伤害等，均由涉及的用户、车位主及其各自的保险公司根据适用的法律和保险条款处理。本平台不参与任何保险索赔过程，也不承担任何赔偿责任。</p>
              <p>5.4 您自行负责确保您的车辆已根据当地法律充分投保。因未投保或保险不足导致的任何损失或责任，由您自行承担。</p>
              
              <h3>6. 保险确认</h3>
              <p>您确认持有并将在使用本平台服务期间始终维持有效的、符合您计划停车所在地所有法律要求的汽车保险。您理解，这是使用本平台服务的强制性条件。如未持有有效保险，您不得使用此服务。</p>
              
              <h3>7. 知识产权</h3>
              <p>本平台及其所有内容，包括但不限于文字、图像、标识、用户界面、软件等，其知识产权归本平台或相关权利人所有。未经事先书面许可，您不得复制、修改、传播或以其他方式使用。</p>
              
              <h3>8. 协议的终止</h3>
              <p>8.1 您可以随时通过平台指定的方式注销账户。</p>
              <p>8.2 如果您违反本协议的任何条款，特别是关于保险要求的条款，本平台有权随时暂停或终止向您提供服务，并注销您的账户，且无需承担任何责任。</p>
              
              <h3>9. 隐私政策</h3>
              <p>我们重视您的隐私。关于我们如何收集、使用、存储和保护您的个人信息，请参阅我们的《隐私政策》。《隐私政策》是本协议不可分割的一部分。</p>
              
              <h3>10. 协议修改</h3>
              <p>本平台有权根据需要不时地修订本协议及/或各类规则，并在本平台公示。修订后的协议和规则一经公布，立即生效。如您在协议修订后继续使用本平台服务，则表示您已接受修订后的协议。</p>
            </div>
            <button 
              type="button" 
              className="agreement-close-btn"
              onClick={() => {
                document.getElementById('agreementModal').style.display = 'none';
                if (!formData.agreementChecked) {
                  setFormData(prev => ({...prev, agreementChecked: true}));
                }
              }}
            >
              我已阅读并同意
            </button>
          </div>
        </div>
      </div>
    );
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
                vehicle_plate: '',
                verificationCode: '',
              });
            }}
          >
            立即登录
          </button>
        </p>
      </div>
    );
  };

  const renderPhoneVerificationStep = () => {
    return (
      <div className="auth-form">
        <h2>手机号验证</h2>
        <p>请输入您的手机号码，我们将发送验证码</p>
        
        <div className="form-group">
          <label htmlFor="phone">手机号码</label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            placeholder="例如: (123) 456-7890"
            className={fieldErrors.phone ? 'error' : ''}
            disabled={codeSent}
          />
          {fieldErrors.phone && <span className="error-message">{fieldErrors.phone}</span>}
        </div>
        
        {codeSent && (
          <div className="form-group">
            <label htmlFor="verificationCode">验证码</label>
            <div className="verification-code-container">
              <input
                type="text"
                id="verificationCode"
                name="verificationCode"
                value={formData.verificationCode}
                onChange={handleInputChange}
                placeholder="请输入6位验证码"
                maxLength="6"
              />
              <button 
                type="button" 
                onClick={sendVerificationCode} 
                disabled={countdown > 0 || isLoading}
                className="resend-button"
              >
                {countdown > 0 ? `重新发送(${countdown}s)` : '重新发送'}
              </button>
            </div>
          </div>
        )}
        
        {error && <div className="error-message">{error}</div>}
        
        <div className="form-actions">
          <button 
            type="button" 
            onClick={handleBack} 
            className="back-button"
          >
            返回
          </button>
          
          <button 
            type="button" 
            onClick={codeSent ? verifyCode : sendVerificationCode} 
            disabled={isLoading}
            className="primary-button"
          >
            {isLoading ? '处理中...' : (codeSent ? '验证' : '发送验证码')}
          </button>
        </div>
      </div>
    );
  };

  const renderRegistrationStep = () => {
    switch (registrationStep) {
      case 0:
        return renderPhoneVerificationStep();
      case 1:
        return (
          <div className="auth-form">
            <h2>创建账户</h2>
            <p>请填写以下信息完成注册</p>
            
            <div className="form-group">
              <label htmlFor="username">用户名</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="请输入用户名"
                className={fieldErrors.username ? 'error' : ''}
              />
              {fieldErrors.username && <span className="error-message">{fieldErrors.username}</span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="password">密码</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="请输入6位数字密码"
                className={fieldErrors.password ? 'error' : ''}
              />
              {fieldErrors.password && <span className="error-message">{fieldErrors.password}</span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="fullName">姓名</label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                placeholder="请输入您的姓名"
                className={fieldErrors.fullName ? 'error' : ''}
              />
              {fieldErrors.fullName && <span className="error-message">{fieldErrors.fullName}</span>}
            </div>
            
            {error && <div className="error-message">{error}</div>}
            
            <div className="form-actions">
              <button 
                type="button" 
                onClick={handleBack} 
                className="back-button"
              >
                返回
              </button>
              
              <button 
                type="button" 
                onClick={handleRegistration} 
                disabled={isLoading}
                className="primary-button"
              >
                {isLoading ? '处理中...' : '下一步'}
              </button>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="auth-form">
            <Button 
              icon={<ArrowLeftOutlined />} 
              onClick={handleBack}
              className="back-button"
            />
            <h2>个人资料</h2>
            {error && <div className="error-message">{error}</div>}
            <form onSubmit={handleRegistration}>
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
              {renderAgreement()}
              <button 
                type="submit" 
                disabled={isLoading}
              >
                {isLoading ? '处理中...' : '完成注册'}
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
      default:
        return null;
    }
  };

  const renderQuickRegistration = () => {
    if (!phoneVerified) {
      return (
        <div className="auth-form">
          <h2>快速注册</h2>
          <p>请输入您的手机号码和车牌号</p>
          
          <div className="form-group">
            <label htmlFor="phone">手机号码</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="例如: (123) 456-7890"
              className={fieldErrors.phone ? 'error' : ''}
              disabled={codeSent}
            />
            {fieldErrors.phone && <span className="error-message">{fieldErrors.phone}</span>}
          </div>
          
          <div className="form-group">
            <label htmlFor="vehicle_plate">车牌号</label>
            <input
              type="text"
              id="vehicle_plate"
              name="vehicle_plate"
              value={formData.vehicle_plate}
              onChange={handleInputChange}
              placeholder="请输入您的车牌号"
              className={fieldErrors.vehicle_plate ? 'error' : ''}
            />
            {fieldErrors.vehicle_plate && <span className="error-message">{fieldErrors.vehicle_plate}</span>}
          </div>
          
          {codeSent && (
            <div className="form-group">
              <label htmlFor="verificationCode">验证码</label>
              <div className="verification-code-container">
                <input
                  type="text"
                  id="verificationCode"
                  name="verificationCode"
                  value={formData.verificationCode}
                  onChange={handleInputChange}
                  placeholder="请输入6位验证码"
                  maxLength="6"
                />
                <button 
                  type="button" 
                  onClick={sendVerificationCode} 
                  disabled={countdown > 0 || isLoading}
                  className="resend-button"
                >
                  {countdown > 0 ? `重新发送(${countdown}s)` : '重新发送'}
                </button>
              </div>
            </div>
          )}
          
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-actions">
            <button 
              type="button" 
              onClick={handleBack} 
              className="back-button"
            >
              返回
            </button>
            
            <button 
              type="button" 
              onClick={handleQuickRegistration} 
              disabled={isLoading}
              className="primary-button"
            >
              {isLoading ? '处理中...' : (codeSent ? '验证' : '发送验证码')}
            </button>
          </div>
        </div>
      );
    }
    
    // 如果手机号已验证，显示注册确认
    return (
      <div className="auth-form">
        <h2>确认注册</h2>
        <p>您的手机号已验证，点击下方按钮完成注册</p>
        
        <div className="form-group">
          <label>手机号码</label>
          <div className="verified-field">{formData.phone} <span className="verified-badge">已验证</span></div>
        </div>
        
        <div className="form-group">
          <label htmlFor="vehicle_plate">车牌号</label>
          <input
            type="text"
            id="vehicle_plate"
            name="vehicle_plate"
            value={formData.vehicle_plate}
            onChange={handleInputChange}
            placeholder="请输入您的车牌号"
            className={fieldErrors.vehicle_plate ? 'error' : ''}
          />
          {fieldErrors.vehicle_plate && <span className="error-message">{fieldErrors.vehicle_plate}</span>}
        </div>
        
        <p className="info-text">
          注册后，您的用户名将自动生成，密码为您手机号的后6位数字。
        </p>
        
        {renderAgreement()}
        
        {error && <div className="error-message">{error}</div>}
        
        <div className="form-actions">
          <button 
            type="button" 
            onClick={handleBack} 
            className="back-button"
          >
            返回
          </button>
          
          <button 
            type="button" 
            onClick={handleQuickRegistration} 
            disabled={isLoading}
            className="primary-button"
          >
            {isLoading ? '处理中...' : '完成注册'}
          </button>
        </div>
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
          
          {renderAgreement()}
          
          <button type="submit" disabled={isLoading}>
            {isLoading ? '处理中...' : '完成注册'}
          </button>
        </form>
      </div>
    );
  };

  const renderForgotPasswordForm = () => {
    if (resetPasswordStep === 0) {
      return (
        <div className="auth-form">
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => {
              setIsForgotPassword(false);
              setResetPasswordStep(0);
              setResetToken('');
              setFormData({
                ...formData,
                phone: '',
                verificationCode: '',
                newPassword: '',
                confirmPassword: '',
              });
            }}
            className="back-button"
          />
          <h2>重置密码</h2>
          <p>请输入您的手机号码，我们将发送验证码</p>
          
          <div className="form-group">
            <label htmlFor="phone">手机号码</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="例如: (123) 456-7890"
              className={fieldErrors.phone ? 'error' : ''}
              disabled={codeSent}
            />
            {fieldErrors.phone && <span className="error-message">{fieldErrors.phone}</span>}
          </div>
          
          {codeSent && (
            <div className="form-group">
              <label htmlFor="verificationCode">验证码</label>
              <div className="verification-code-container">
                <input
                  type="text"
                  id="verificationCode"
                  name="verificationCode"
                  value={formData.verificationCode}
                  onChange={handleInputChange}
                  placeholder="请输入6位验证码"
                  maxLength="6"
                />
                <button 
                  type="button" 
                  onClick={handleForgotPassword} 
                  disabled={countdown > 0 || isLoading}
                  className="resend-button"
                >
                  {countdown > 0 ? `重新发送(${countdown}s)` : '重新发送'}
                </button>
              </div>
            </div>
          )}
          
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-actions">
            <button 
              type="button" 
              onClick={() => {
                setIsForgotPassword(false);
                setResetPasswordStep(0);
                setResetToken('');
                setFormData({
                  ...formData,
                  phone: '',
                  verificationCode: '',
                  newPassword: '',
                  confirmPassword: '',
                });
              }} 
              className="back-button"
            >
              返回
            </button>
            
            <button 
              type="button" 
              onClick={codeSent ? verifyResetCode : handleForgotPassword} 
              disabled={isLoading}
              className="primary-button"
            >
              {isLoading ? '处理中...' : (codeSent ? '验证' : '发送验证码')}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="auth-form">
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => setResetPasswordStep(0)}
          className="back-button"
        />
        <h2>设置新密码</h2>
        <p>请输入您的新密码</p>
        
        <div className="form-group">
          <label htmlFor="newPassword">新密码</label>
          <input
            type="password"
            id="newPassword"
            name="newPassword"
            value={formData.newPassword}
            onChange={handleInputChange}
            placeholder="请输入6位数字密码"
            maxLength="6"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="confirmPassword">确认密码</label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            placeholder="请再次输入密码"
            maxLength="6"
          />
        </div>
        
        {error && <div className="error-message">{error}</div>}
        
        <div className="form-actions">
          <button 
            type="button" 
            onClick={() => setResetPasswordStep(0)} 
            className="back-button"
          >
            返回
          </button>
          
          <button 
            type="button" 
            onClick={handleResetPassword} 
            disabled={isLoading}
            className="primary-button"
          >
            {isLoading ? '处理中...' : '重置密码'}
          </button>
        </div>
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
        
        <div className="forgot-password">
          <button 
            type="button" 
            className="forgot-password-button"
            onClick={() => setIsForgotPassword(true)}
          >
            忘记密码？
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
        isForgotPassword ? renderForgotPasswordForm() : (
          isLogin ? renderLoginForm() : (
            <>
              {registrationStep === 0 && renderRegistrationChoice()}
              {registrationStep > 0 && registrationType === 'quick' && renderQuickRegistration()}
              {registrationStep > 0 && registrationType === 'full' && renderRegistrationStep()}
            </>
          )
        )
      )}
    </div>
  );
}

export default Auth;
