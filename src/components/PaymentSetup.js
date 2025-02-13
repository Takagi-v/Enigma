import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CardElement, useStripe, useElements, PaymentRequestButtonElement } from '@stripe/react-stripe-js';
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
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState('card');

  useEffect(() => {
    if (stripe) {
      const pr = stripe.paymentRequest({
        country: 'US',
        currency: 'usd',
        total: {
          label: 'Parking Service',
          amount: 0,
        },
        requestPayerName: true,
        requestPayerEmail: true,
        requestPayerPhone: true,
      });

      // 检查设备是否支持 Apple Pay 或 Google Pay
      pr.canMakePayment().then(result => {
        if (result) {
          setPaymentRequest(pr);
          
          // 设置 PaymentRequest 事件处理
          pr.on('paymentmethod', async (event) => {
            try {
              // 保存支付方式到后端
              const response = await authFetch(`${config.API_URL}/payment/save-method`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  paymentMethodId: event.paymentMethod.id,
                  paymentType: 'wallet'
                }),
              });

              const responseData = await response.json();

              if (!response.ok) {
                event.complete('fail');
                throw new Error(responseData.error || '保存支付方式失败');
              }

              event.complete('success');
              alert('支付方式绑定成功！');
              navigate(returnUrl);
            } catch (err) {
              console.error('保存数字钱包支付方式失败:', err);
              event.complete('fail');
              setError(err.message || '绑定支付方式失败，请重试');
            }
          });
        }
      });
    }
  }, [stripe, authFetch, navigate, returnUrl]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      let paymentMethod;
      let createError;

      if (selectedMethod === 'card') {
        // 处理信用卡支付方式
        const result = await stripe.createPaymentMethod({
          type: 'card',
          card: elements.getElement(CardElement),
          billing_details: {
            name: user.fullName,
            email: user.email,
            phone: user.phone
          }
        });
        createError = result.error;
        paymentMethod = result.paymentMethod;
      }

      if (createError) {
        throw new Error(createError.message);
      }

      // 保存支付方式到后端
      const response = await authFetch(`${config.API_URL}/payment/save-method`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentMethodId: paymentMethod.id,
          paymentType: selectedMethod
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || '保存支付方式失败');
      }

      if (responseData.success) {
        alert('支付方式绑定成功！');
        navigate(returnUrl);
      } else {
        throw new Error(responseData.error || '绑定支付方式失败');
      }
    } catch (err) {
      console.error('详细错误信息:', err);
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
            <div 
              className={`payment-method-item ${selectedMethod === 'card' ? 'active' : ''}`}
              onClick={() => setSelectedMethod('card')}
            >
              <div className="payment-method-header">
                <img src="/images/credit-card-icon.svg" alt="Credit Card" className="payment-icon" />
                <span>Credit/Debit Card</span>
              </div>
              <div className="card-brands">
                <img src="https://js.stripe.com/v3/fingerprinted/img/visa-729c05c240c4bdb47b03ac81d9945bfe.svg" alt="Visa" />
                <img src="https://js.stripe.com/v3/fingerprinted/img/mastercard-4d8844094130711885b5e41b28c9848f.svg" alt="Mastercard" />
                <img src="https://js.stripe.com/v3/fingerprinted/img/amex-a49b82f46c5cd6a96a6e418a6ca1717c.svg" alt="American Express" />
              </div>
            </div>

            {paymentRequest && (
              <div 
                className={`payment-method-item ${selectedMethod === 'wallet' ? 'active' : ''}`}
                onClick={() => setSelectedMethod('wallet')}
              >
                <div className="payment-method-header">
                  <img 
                    src={`https://js.stripe.com/v3/fingerprinted/img/${
                      /iPhone|iPad|Macintosh/i.test(navigator.userAgent) ? 'apple-pay' : 'google-pay'
                    }.svg`} 
                    alt="Digital Wallet" 
                    className="payment-icon"
                  />
                  <span>{/iPhone|iPad|Macintosh/i.test(navigator.userAgent) ? 'Apple Pay' : 'Google Pay'}</span>
                </div>
              </div>
            )}
          </div>

          {selectedMethod === 'card' ? (
            <div className="card-element-container">
              <CardElement options={cardElementOptions} />
            </div>
          ) : (
            paymentRequest && (
              <div className="wallet-payment-container">
                <PaymentRequestButtonElement
                  options={{
                    paymentRequest,
                    style: {
                      paymentRequestButton: {
                        theme: 'dark',
                        height: '44px',
                      },
                    },
                  }}
                />
              </div>
            )
          )}

          <div className="secure-badge">
            <span>您的支付信息将通过 Stripe 安全加密处理</span>
          </div>

          {selectedMethod === 'card' && (
            <button 
              type="submit" 
              disabled={!stripe || processing}
              className={`submit-button ${processing ? 'processing' : ''}`}
            >
              {processing ? '处理中...' : '绑定支付方式'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default PaymentSetup; 