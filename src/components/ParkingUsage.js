import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { startParking, endParking, payParking } from '../services/parkingService';
import config from '../config';
import './styles/ParkingUsage.css';

const ParkingUsage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [parkingSpot, setParkingSpot] = useState(null);
  const [usage, setUsage] = useState(null);
  const [timer, setTimer] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    // 获取用户信息
    const username = localStorage.getItem('username');
    const token = localStorage.getItem('token');
    
    if (!username || !token) {
      navigate('/auth');
      return;
    }

    const fetchUserInfo = async () => {
      try {
        const response = await fetch(`${config.API_URL}/users/${username}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || '获取用户信息失败');
        }
        
        const data = await response.json();
        setUserId(data.id);
      } catch (error) {
        console.error('获取用户信息失败:', error);
        if (error.message.includes('请先登录') || error.message.includes('无权访问')) {
          navigate('/auth');
        } else {
          setError(error.message || '获取用户信息失败');
        }
      }
    };

    fetchUserInfo();
  }, [navigate]);

  useEffect(() => {
    // 获取停车场信息
    const fetchParkingSpot = async () => {
      try {
        const response = await fetch(`${config.API_URL}/parking-spots/${id}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || '获取停车场信息失败');
        }
        const data = await response.json();
        setParkingSpot(data);
      } catch (error) {
        console.error('获取停车场信息失败:', error);
        setError(error.message || '获取停车场信息失败');
      } finally {
        setIsLoading(false);
      }
    };

    fetchParkingSpot();
  }, [id]);

  useEffect(() => {
    let interval;
    if (usage && !usage.end_time) {
      interval = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [usage]);

  const handleStart = async () => {
    if (!userId) {
      setError('用户信息未加载');
      return;
    }

    try {
      const result = await startParking(id, userId);
      setUsage({
        id: result.usage_id,
        start_time: new Date(),
        end_time: null
      });
    } catch (error) {
      setError('开始使用停车场失败');
    }
  };

  const handleEnd = async () => {
    if (!userId) {
      setError('用户信息未加载');
      return;
    }

    try {
      const result = await endParking(id, userId);
      setUsage(prev => ({
        ...prev,
        end_time: new Date(),
        total_amount: result.total_amount
      }));
    } catch (error) {
      setError('结束使用停车场失败');
    }
  };

  const handlePayment = async () => {
    try {
      await payParking(id, usage.id);
      navigate('/payment-success');
    } catch (error) {
      setError('支付失败');
    }
  };

  if (isLoading) {
    return <div className="parking-usage loading">加载中...</div>;
  }

  if (error) {
    return <div className="parking-usage error">{error}</div>;
  }

  if (!parkingSpot) {
    return <div className="parking-usage error">未找到停车场信息</div>;
  }

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const calculateEstimatedCost = () => {
    if (!usage || !parkingSpot.hourly_rate) return 0;
    const hours = timer / 3600;
    return Math.ceil(hours * parkingSpot.hourly_rate);
  };

  return (
    <div className="parking-usage">
      <h2>停车场使用</h2>
      
      <div className="parking-info">
        <h3>{parkingSpot.location}</h3>
        <p>每小时费率：¥{parkingSpot.hourly_rate}</p>
      </div>

      {!usage && (
        <div className="start-section">
          <p>点击下方按钮开始使用停车场</p>
          <button onClick={handleStart} className="start-button">
            开始使用
          </button>
        </div>
      )}

      {usage && !usage.end_time && (
        <div className="usage-section">
          <div className="timer">
            <h3>已使用时间</h3>
            <div className="time-display">{formatTime(timer)}</div>
          </div>
          <div className="cost-estimate">
            <h3>预估费用</h3>
            <div className="cost-display">¥{calculateEstimatedCost()}</div>
          </div>
          <button onClick={handleEnd} className="end-button">
            结束使用
          </button>
        </div>
      )}

      {usage && usage.end_time && (
        <div className="payment-section">
          <h3>费用明细</h3>
          <div className="payment-details">
            <p>使用时长：{formatTime(timer)}</p>
            <p>应付金额：¥{usage.total_amount}</p>
          </div>
          <button onClick={handlePayment} className="payment-button">
            立即支付
          </button>
        </div>
      )}
    </div>
  );
};

export default ParkingUsage; 