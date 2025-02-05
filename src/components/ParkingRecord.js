import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import parkingService from '../services/parkingService';
import Reviews from './Reviews';
import './styles/ParkingRecord.css';

const ParkingRecord = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showReview, setShowReview] = useState(false);
  const { user, authFetch } = useAuth();

  const fetchRecord = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await parkingService.getParkingRecords(authFetch);
      const currentRecord = data.records.find(r => r.id === parseInt(id));
      
      if (!currentRecord) {
        throw new Error('未找到停车记录');
      }
      
      setRecord(currentRecord);
    } catch (error) {
      console.error('获取停车记录失败:', error);
      setError(error.message || '获取停车记录失败');
    } finally {
      setIsLoading(false);
    }
  }, [id, authFetch]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    fetchRecord();
  }, [user, navigate, fetchRecord]);

  const formatTime = (timeString) => {
    if (!timeString) return '未结束';
    return new Date(timeString).toLocaleString('zh-CN');
  };

  const getStatusText = (status) => {
    const statusMap = {
      'active': '使用中',
      'completed': '已完成',
      'cancelled': '已取消'
    };
    return statusMap[status] || status;
  };

  const getPaymentStatusText = (status) => {
    const statusMap = {
      'pending': '待支付',
      'paid': '已支付',
      'refunded': '已退款'
    };
    return statusMap[status] || status;
  };

  const calculateDuration = () => {
    if (!record || !record.start_time || !record.end_time) return '计算中';
    const start = new Date(record.start_time);
    const end = new Date(record.end_time);
    const duration = Math.floor((end - start) / 1000); // 秒
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    return `${hours}小时${minutes}分钟`;
  };

  if (isLoading) {
    return <div className="parking-record loading">加载中...</div>;
  }

  if (error) {
    return (
      <div className="parking-record error">
        <p>{error}</p>
        <button onClick={() => navigate('/profile')}>返回个人中心</button>
      </div>
    );
  }

  if (!record) {
    return <div className="parking-record error">未找到停车记录</div>;
  }

  return (
    <div className="parking-record">
      <div className="record-header">
        <button className="back-btn" onClick={() => navigate('/profile')}>
          返回个人中心
        </button>
        <h2>停车记录详情</h2>
      </div>

      <div className="record-content">
        <div className="location-section">
          <h3>停车位置</h3>
          <p>{record.location}</p>
        </div>

        <div className="status-section">
          <div className="status-item">
            <span>使用状态</span>
            <span className={`status ${record.status}`}>
              {getStatusText(record.status)}
            </span>
          </div>
          <div className="status-item">
            <span>支付状态</span>
            <span className={`payment-status ${record.payment_status}`}>
              {getPaymentStatusText(record.payment_status)}
            </span>
          </div>
        </div>

        <div className="time-section">
          <div className="time-item">
            <span>开始时间</span>
            <span>{formatTime(record.start_time)}</span>
          </div>
          <div className="time-item">
            <span>结束时间</span>
            <span>{formatTime(record.end_time)}</span>
          </div>
          <div className="time-item">
            <span>停车时长</span>
            <span>{calculateDuration()}</span>
          </div>
        </div>

        <div className="payment-section">
          <div className="payment-item">
            <span>费用</span>
            <span className="amount">¥{record.total_amount || '计费中'}</span>
          </div>
          {record.status === 'completed' && record.payment_status === 'pending' && (
            <button 
              className="payment-btn"
              onClick={() => navigate(`/parking/${record.parking_spot_id}/use?usage_id=${record.id}`)}
            >
              立即支付
            </button>
          )}
        </div>

        {record.vehicle_plate && (
          <div className="vehicle-section">
            <span>车牌号</span>
            <span>{record.vehicle_plate}</span>
          </div>
        )}

        {record.status === 'completed' && record.payment_status === 'paid' && !record.rating && (
          <div className="review-section">
            {!showReview ? (
              <button 
                className="review-btn"
                onClick={() => setShowReview(true)}
              >
                评价
              </button>
            ) : (
              <Reviews 
                parkingSpotId={record.parking_spot_id} 
                onReviewSubmitted={() => {
                  setShowReview(false);
                  // 重新加载记录以更新评价状态
                  fetchRecord();
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ParkingRecord; 