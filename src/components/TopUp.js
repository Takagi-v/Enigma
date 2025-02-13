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

    fetchPaymentMethod();
  }, [authFetch]);

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
    
    if (!amount || parseFloat(amount) <= 0) {
      setError('请输入有效的充值金额');
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
          amount: parseFloat(amount),
          paymentMethodId: paymentMethod.id
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
        }
      );

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      // 3. 支付成功
      alert('充值已提交，请等待到账');
      navigate('/profile');
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