import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Reviews from './Reviews';
import './styles/Profile.css';
import config from '../config';
import couponService from '../services/couponService';

function Profile() {
  const { user, authFetch } = useAuth();
  const [parkingRecords, setParkingRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviewingRecordId, setReviewingRecordId] = useState(null);
  const [coupons, setCoupons] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [giftBalance, setGiftBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      if (!user) {
        console.log('用户未登录，重定向到登录页面');
        navigate('/auth');
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // 并行获取所有数据
        await Promise.all([
          fetchParkingRecords(),
          fetchCoupons(),
          fetchPaymentMethod(),
          fetchGiftBalance(),
          fetchTransactions()
        ]);
      } catch (err) {
        console.error('获取数据失败:', err);
        setError(err.message || '获取数据失败');
        // 如果是认证错误，重定向到登录页面
        if (err.message.includes('认证') || err.message.includes('登录')) {
          navigate('/auth');
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [user, navigate]);

  const fetchParkingRecords = async () => {
    if (!user) return;

    try {
      const response = await authFetch(`${config.API_URL}/parking-spots/usage/my`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || '获取停车记录失败');
      }
      
      setParkingRecords(data.records || []);
    } catch (error) {
      console.error('获取停车记录失败:', error);
      throw new Error('获取停车记录失败');
    }
  };

  const fetchCoupons = async () => {
    if (!user) return;

    try {
      const response = await authFetch(`${config.API_URL}/coupons/user/${user.id}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || '获取优惠券失败');
      }
      
      setCoupons(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('获取优惠券失败:', error);
      throw new Error('获取优惠券失败');
    }
  };

  const fetchPaymentMethod = async () => {
    if (!user) return;

    try {
      const response = await authFetch(`${config.API_URL}/payment/method`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || '获取支付方式失败');
      }
      
      if (data.paymentMethod) {
        setPaymentMethod(data.paymentMethod);
      }
    } catch (error) {
      console.error('获取支付方式失败:', error);
      throw new Error('获取支付方式失败');
    }
  };

  const fetchGiftBalance = async () => {
    if (!user) return;

    try {
      const response = await authFetch(`${config.API_URL}/users/${user.id}/gift-balance`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || '获取赠送余额失败');
      }
      
      setGiftBalance(data.gift_balance);
    } catch (error) {
      console.error('获取赠送余额失败:', error);
      throw new Error('获取赠送余额失败');
    }
  };

  const fetchTransactions = async () => {
    if (!user) return;

    try {
      const response = await authFetch(`${config.API_URL}/payment/transactions`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || '获取充值记录失败');
      }
      
      setTransactions(data || []);
    } catch (error) {
      console.error('获取充值记录失败:', error);
      throw new Error('获取充值记录失败');
    }
  };

  // 格式化时间
  const formatTime = (timeString) => {
    if (!timeString) return '未结束';
    return new Date(timeString).toLocaleString('zh-CN');
  };

  // 获取状态显示文本
  const getStatusText = (status) => {
    const statusMap = {
      'active': '使用中',
      'completed': '已完成',
      'cancelled': '已取消'
    };
    return statusMap[status] || status;
  };

  // 获取支付状态显示文本
  const getPaymentStatusText = (status) => {
    const statusMap = {
      'pending': '待支付',
      'paid': '已支付',
      'refunded': '已退款'
    };
    return statusMap[status] || status;
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h1 className="profile-name">{user.fullName}</h1>
        <p className="profile-username">@{user.username}</p>
        {user.address && (
          <p className="profile-location">{user.address}</p>
        )}
      </div>
      
      <div className="profile-info">
        <div className="info-section">
          <h3>个人简介</h3>
          <p>{user.bio}</p>
        </div>

        <div className="info-section">
          <h3>联系方式</h3>
          <p>电话：{user.phone}</p>
          <p>用户ID：{user.id}</p>
        </div>

        <div className="info-section">
          <h3>支付方式</h3>
          {paymentMethod ? (
            <div className="payment-method-info">
              <div className="card-info">
                <span className="card-brand">{paymentMethod.card.brand}</span>
                <span className="card-last4">**** **** **** {paymentMethod.card.last4}</span>
                <span className="card-expiry">有效期至 {paymentMethod.card.exp_month}/{paymentMethod.card.exp_year}</span>
              </div>
              <button 
                className="update-payment-btn"
                onClick={() => navigate('/payment-setup')}
              >
                更新支付方式
              </button>
            </div>
          ) : (
            <div className="no-payment-method">
              <p>暂未绑定支付方式</p>
              <button 
                className="setup-payment-btn"
                onClick={() => navigate('/payment-setup')}
              >
                绑定支付方式
              </button>
            </div>
          )}
        </div>

        <div className="info-section">
          <h3>我的优惠</h3>
          {coupons.length === 0 ? (
            <p>暂无可用优惠</p>
          ) : (
            <div className="coupons-list">
              {coupons.map(coupon => (
                <div key={coupon.id} className="coupon-item">
                  <div className="coupon-amount">
                    {coupon.type === 'gift_balance' ? 'Gift Balance' : 'Coupon'} ${coupon.amount}
                  </div>
                  <div className="coupon-info">
                    <p className="coupon-description">{coupon.description}</p>
                    {coupon.expiry_date && (
                      <p className="coupon-expiry">
                        Valid until: {new Date(coupon.expiry_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="info-section">
          <h3>My Balance</h3>
          <div className="balance-info">
            <p>Gift Balance: <span className="gift-balance">${giftBalance}</span></p>
            <p>Account Balance: <span className="actual-balance">${user.balance || 0}</span></p>
            <p>Total Balance: <span className="total-balance">${(giftBalance + (user.balance || 0))}</span></p>
            <button 
              className="top-up-button"
              onClick={() => navigate('/top-up')}
            >
              Top Up
            </button>
          </div>
        </div>

        <button 
          className="edit-profile-btn"
          onClick={() => navigate('/edit-profile')}
        >
          编辑资料
        </button>
      </div>

      <div className="parking-records-section">
        <h3>停车记录</h3>
        {parkingRecords.length === 0 ? (
          <p className="no-records">暂无停车记录</p>
        ) : (
          <div className="parking-records-list">
            {parkingRecords.map(record => (
              <div key={record.id}>
                <div 
                  className={`parking-record-item clickable ${record.status}`}
                  onClick={(e) => {
                    // 防止评价按钮的点击事件冒泡
                    if (e.target.className === 'review-btn') return;
                    
                    if (record.status === 'active' || 
                        (record.status === 'completed' && record.payment_status === 'pending')) {
                      // 使用中或待支付的记录，跳转到使用/支付页面
                      navigate(`/parking/${record.parking_spot_id}/use?usage_id=${record.id}`);
                    } else {
                      // 其他状态的记录，跳转到详情页面
                      navigate(`/parking-record/${record.id}`);
                    }
                  }}
                >
                  <div className="record-header">
                    <h4>{record.location}</h4>
                    <span className={`status ${record.status}`}>
                      {getStatusText(record.status)}
                    </span>
                  </div>
                  <div className="record-details">
                    <p>开始时间：{formatTime(record.start_time)}</p>
                    <p>结束时间：{formatTime(record.end_time)}</p>
                    <p>费用：¥{record.total_amount || '计费中'}</p>
                    <p>支付状态：{getPaymentStatusText(record.payment_status)}</p>
                    {record.vehicle_plate && (
                      <p>车牌号：{record.vehicle_plate}</p>
                    )}
                  </div>
                  {record.status === 'completed' && record.payment_status === 'paid' && !record.rating && (
                    <button 
                      className="review-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReviewingRecordId(record.id);
                      }}
                    >
                      评价
                    </button>
                  )}
                </div>
                {reviewingRecordId === record.id && (
                  <div className="record-review-section">
                    <Reviews 
                      parkingSpotId={record.parking_spot_id}
                      onReviewSubmitted={() => {
                        setReviewingRecordId(null);
                        fetchParkingRecords();
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="transactions-section">
        <h3>充值记录</h3>
        {transactions.length === 0 ? (
          <p className="no-records">暂无充值记录</p>
        ) : (
          <div className="transactions-list">
            {transactions.map(transaction => (
              <div key={transaction.payment_intent_id} className="transaction-item">
                <div className="transaction-header">
                  <h4>充值金额: ${transaction.amount}</h4>
                  <span className={`status ${transaction.status}`}>
                    {transaction.status === 'succeeded' ? '成功' : transaction.status}
                  </span>
                </div>
                <div className="transaction-details">
                  <p>交易时间：{formatTime(transaction.created_at)}</p>
                  <p>交易ID：{transaction.payment_intent_id}</p>
                  {transaction.error_message && (
                    <p className="error-message">错误信息：{transaction.error_message}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Profile;