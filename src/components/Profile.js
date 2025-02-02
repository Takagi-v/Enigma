import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './styles/Profile.css';
import defaultAvatar from '../images/default-avatar.jpg'; // 请确保有默认头像图片
import config from '../config';

function Profile() {
  const { user, authFetch } = useAuth();
  const [parkingRecords, setParkingRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    fetchParkingRecords();
  }, [user, navigate]);

  const fetchParkingRecords = async () => {
    if (!user) return;

    try {
      const response = await authFetch(`${config.API_URL}/parking-spots/usage/my`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '获取停车记录失败');
      }
      
      const data = await response.json();
      setParkingRecords(data.records || []);
    } catch (error) {
      console.error('获取停车记录失败:', error);
      alert(error.message || '获取停车记录失败，请重试');
    } finally {
      setLoading(false);
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

  if (!user) {
    return null;
  }

  return (
    <div className="profile-container">
      <div className="profile-left">
        <img
          src={user.avatar || defaultAvatar}
          alt={user.username}
          className="profile-avatar"
        />
      </div>
      <div className="profile-right">
        <h1 className="profile-name">{user.fullName}</h1>
        <p className="profile-username">@{user.username}</p>
        {user.address && (
          <p className="profile-location">{user.address}</p>
        )}
        
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
                <div key={record.id} className="parking-record-item">
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
                      onClick={() => navigate(`/review/${record.id}`)}
                    >
                      评价
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Profile;