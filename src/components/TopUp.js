import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useStripe } from '@stripe/react-stripe-js';
import config from '../config';
import './styles/TopUp.css';

const TopUp = () => {
  const { user, authFetch } = useAuth();
  const stripe = useStripe();
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasReceivedGift, setHasReceivedGift] = useState(false);
  const [transactions, setTransactions] = useState([]);

  // 预设的充值金额选项（美元）
  const presetAmounts = [10, 20, 50, 100];

  useEffect(() => {
    // 获取用户已绑定的支付方式
    const fetchPaymentMethod = async () => {
      try {
        const response = await authFetch(`${config.API_URL}/payment/method`);
        const data = await response.json();
        
        if (!data.paymentMethod) {
          setError('请先绑定支付方式');
          return;
        }
        
        setPaymentMethod(data.paymentMethod);
      } catch (err) {
        setError('获取支付方式失败');
        console.error(err);
      }
    };

    // 检查用户是否已经获得过赠送余额
    const checkGiftStatus = async () => {
      try {
        const response = await authFetch(`${config.API_URL}/payment/gift-status`);
        const data = await response.json();
        setHasReceivedGift(data.hasReceivedGift);
        setTransactions(data.transactions || []);
      } catch (err) {
        console.error('获取赠送余额状态失败:', err);
      }
    };

    fetchPaymentMethod();
    if (user) {
      checkGiftStatus();
    }
  }, [authFetch, user]);

  const handleAmountClick = (value) => {
    setAmount(value.toString());
  };

  const handleAmountChange = (e) => {
    const value = e.target.value;
    // 只允许输入数字和小数点
    if (/^\d*\.?\d{0,2}$/.test(value) || value === '') {
      setAmount(value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const amountValue = parseFloat(amount);
    
    if (!amount || amountValue <= 0) {
      setError('请输入有效的充值金额');
      return;
    }

    // 检查最低充值金额
    if (!hasReceivedGift && amountValue < 10) {
      setError('首次充值金额不能低于$10');
      return;
    } else if (hasReceivedGift && amountValue < 20) {
      setError('充值金额不能低于$20');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. 创建支付意向
      const response = await authFetch(`${config.API_URL}/payment/top-up`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountValue,
          paymentMethodId: paymentMethod.id,
          isFirstTopUp: !hasReceivedGift
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '充值失败');
      }

      // 2. 确认支付意向
      const { error: stripeError } = await stripe.confirmCardPayment(
        data.clientSecret,
        {
          payment_method: paymentMethod.id,
          setup_future_usage: 'off_session'
        },
        {
          handleActions: true // 这会显示3D Secure等验证界面
        }
      );

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      // 3. 等待支付状态更新
      const checkPaymentStatus = async () => {
        try {
          console.log('检查支付状态:', data.paymentIntentId);
          const statusResponse = await authFetch(`${config.API_URL}/payment/status/${data.paymentIntentId}`);
          const statusData = await statusResponse.json();
          
          console.log('当前支付状态:', statusData);
          
          if (statusData.status === 'succeeded') {
            // 确认交易记录是否存在
            const transactionResponse = await authFetch(`${config.API_URL}/payment/transactions`);
            const transactionData = await transactionResponse.json();
            const transaction = transactionData.find(t => t.payment_intent_id === data.paymentIntentId);
            
            if (transaction) {
              console.log('交易记录已确认:', transaction);
              alert('充值成功！');
              navigate('/profile');
            } else {
              console.log('等待交易记录生成...');
              setTimeout(checkPaymentStatus, 1000);
            }
          } else if (statusData.status === 'failed' || statusData.status === 'canceled') {
            throw new Error(statusData.error || '充值失败');
          } else {
            console.log('支付处理中，继续等待...');
            setTimeout(checkPaymentStatus, 1000);
          }
        } catch (err) {
          console.error('检查支付状态失败:', err);
          setError(err.message || '获取支付状态失败');
        }
      };

      // 开始检查支付状态
      await checkPaymentStatus();

    } catch (err) {
      setError(err.message || '充值失败，请重试');
      console.error('充值错误:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!paymentMethod) {
    return (
      <div className="top-up-container">
        <div className="top-up-card">
          <h2>账户充值</h2>
          <div className="error-message">
            {error}
          </div>
          <button 
            className="bind-payment-button"
            onClick={() => navigate('/payment-setup')}
          >
            绑定支付方式
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="top-up-container">
      <div className="top-up-card">
        <h2>账户充值</h2>
        
        {/* 添加商家信息部分 */}
        <div className="merchant-info">
          <div className="merchant-header">
            <img src="/images/logo.png" alt="GoParkMe" className="merchant-logo" />
            <h3>GoParkMe停车服务</h3>
          </div>
          <p className="merchant-description">
            您正在为GoParkMe停车服务账户充值。充值后的余额可用于支付停车费用和相关服务。
          </p>
          <div className="merchant-trust-badges">
            <span className="secure-badge">
              <i className="fas fa-lock"></i> 安全支付
            </span>
            <span className="support-badge">
              <i className="fas fa-headset"></i> 7x24小时客服支持
            </span>
          </div>
        </div>
        
        {!hasReceivedGift && (
          <div className="gift-promotion">
            <div className="gift-banner">
              <span className="gift-icon">🎁</span>
              <span className="gift-text">首次充值$10即可获得$20赠送余额！</span>
            </div>
            <p className="gift-note">注意：这是您唯一一次获得赠送余额的机会</p>
          </div>
        )}

        {hasReceivedGift && (
          <div className="minimum-amount-notice">
            <p>最低充值金额: $20</p>
          </div>
        )}
        
        <div className="payment-method-info">
          <div className="card-info">
            <img 
              src={`/images/${paymentMethod.card.brand}-logo.svg`} 
              alt={paymentMethod.card.brand} 
              className="card-brand-icon"
            />
            <span>**** **** **** {paymentMethod.card.last4}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="amount-input-container">
            <label>Amount</label>
            <div className="amount-input-wrapper">
              <span className="currency-symbol">$</span>
              <input
                type="text"
                value={amount}
                onChange={handleAmountChange}
                placeholder="Enter amount"
                className="amount-input"
              />
            </div>
          </div>

          <div className="preset-amounts">
            {presetAmounts.map((value) => (
              <button
                key={value}
                type="button"
                className={`preset-amount-button ${amount === value.toString() ? 'active' : ''}`}
                onClick={() => handleAmountClick(value)}
                disabled={hasReceivedGift && value < 20}
              >
                ${value}
              </button>
            ))}
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className={`submit-button ${loading ? 'loading' : ''}`}
            disabled={loading || !amount}
          >
            {loading ? 'Processing...' : 'Confirm Top-Up'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TopUp; 