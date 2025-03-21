import React from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

// 从环境变量中获取 Stripe 公钥
console.log('前端加载的 Stripe 公钥:', {
  REACT_APP_STRIPE_PUBLIC_KEY: process.env.REACT_APP_STRIPE_PUBLIC_KEY,
  STRIPE_PUBLIC_KEY: process.env.STRIPE_PUBLIC_KEY
});

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

const StripeProvider = ({ children }) => {
  const options = {
    mode: 'setup',
    currency: 'usd',
    payment_method_types: ['card'],
    appearance: {
      theme: 'stripe',
      labels: 'floating',
      variables: {
        colorPrimary: '#4299e1',
        colorBackground: '#ffffff',
        colorText: '#2d3748',
        colorDanger: '#dc2626',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        spacingUnit: '4px',
        borderRadius: '8px'
      }
    }
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      {children}
    </Elements>
  );
};

export default StripeProvider; 