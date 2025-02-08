import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import config from '../config';
import './styles/PaymentSetup.css';

const PaymentSetup = () => {
  const stripe = useStripe();
  const elements = useElements();
  const { user, authFetch } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [returnUrl] = useState(localStorage.getItem('returnUrl') || '/profile');

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // 1. 获取卡片信息
      const cardElement = elements.getElement(CardElement);
      const {error: cardError, paymentMethod} = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: {
          name: user.fullName,
          email: user.email,
          phone: user.phone
        }
      });

      if (cardError) {
        throw new Error(cardError.message);
      }

      // 2. 保存支付方式信息到数据库
      const saveResponse = await authFetch(`${config.API_URL}/payment/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payment_method_id: paymentMethod.id
        })
      });

      if (!saveResponse.ok) {
        throw new Error('支付方式保存失败');
      }

      alert('支付方式绑定成功！');
      navigate(returnUrl);
    } catch (err) {
      console.error('绑定支付方式失败:', err);
      setError(err.message || '绑定支付方式失败，请重试');
    } finally {
      setProcessing(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#dc2626',
        iconColor: '#dc2626',
      },
    },
    hidePostalCode: true
  };

  return (
    <div className="payment-setup-container">
      <div className="payment-setup-form">
        <h2>绑定支付方式</h2>
        <p className="setup-description">
          为了确保您能够顺利使用停车场服务，请绑定您的支付方式。
        </p>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="payment-methods">
            <div className="payment-method-item active">
              <div className="payment-method-header">
                <img src="/images/credit-card-icon.svg" alt="信用卡" className="payment-icon" />
                <span>信用卡/借记卡</span>
              </div>
              <div className="card-brands">
                <img src="/images/visa-logo.svg" alt="Visa" />
                <img src="/images/mastercard-logo.svg" alt="Mastercard" />
              </div>
            </div>
          </div>

          <div className="card-element-container">
            <CardElement options={cardElementOptions} />
          </div>

          <div className="secure-badge">
            <span>您的支付信息将通过 Stripe 安全加密处理</span>
          </div>

          <button
            type="submit"
            disabled={!stripe || processing}
            className={`submit-button ${processing ? 'processing' : ''}`}
          >
            {processing ? '处理中...' : '绑定支付方式'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PaymentSetup; 