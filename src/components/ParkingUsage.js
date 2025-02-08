import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import parkingService from '../services/parkingService';
import './styles/ParkingUsage.css';

const ParkingUsage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const usageId = searchParams.get('usage_id');
  const navigate = useNavigate();
  const [parkingSpot, setParkingSpot] = useState(null);
  const [usage, setUsage] = useState(null);
  const [timer, setTimer] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user, authFetch } = useAuth();
  const [parkingRecords, setParkingRecords] = useState([]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchParkingRecords();
  }, [user, navigate]);

  const fetchParkingRecords = async () => {
    try {
      setIsLoading(true);
      const data = await parkingService.getParkingRecords(authFetch);
      setParkingRecords(data.records || []);
    } catch (error) {
      console.error('获取停车记录失败:', error);
      setError(error.message || '获取停车记录失败，请重试');
      if (error.message.includes('401')) {
        navigate('/auth');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        // 获取停车位信息
        const spotData = await parkingService.getParkingSpotDetail(id);
        setParkingSpot(spotData);

        // 如果有 usage_id，说明是从记录页面跳转来的
        if (usageId) {
          const records = await parkingService.getParkingRecords(authFetch);
          const currentUsage = records.records.find(record => record.id === parseInt(usageId));
          if (currentUsage) {
            setUsage({
              id: currentUsage.id,
              start_time: new Date(currentUsage.start_time),
              end_time: currentUsage.end_time ? new Date(currentUsage.end_time) : null,
              total_amount: currentUsage.total_amount
            });
            
            // 如果是使用中的记录，计算已经过去的时间
            if (currentUsage.status === 'active') {
              const startTime = new Date(currentUsage.start_time);
              const elapsedSeconds = Math.floor((new Date() - startTime) / 1000);
              setTimer(elapsedSeconds);
            }
          }
        }
      } catch (error) {
        console.error('获取信息失败:', error);
        setError(error.message || '获取信息失败');
        if (error.message.includes('401')) {
          navigate('/auth');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id, usageId, user, navigate, authFetch]);

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
    try {
      // 检查用户是否已绑定支付方式
      const response = await authFetch(`${process.env.REACT_APP_API_URL}/api/payment/status`);
      const paymentStatus = await response.json();

      if (!paymentStatus.hasPaymentMethod) {
        // 保存当前页面URL，用于支付绑定后返回
        localStorage.setItem('returnUrl', window.location.pathname);
        navigate('/payment-setup');
        return;
      }

      const data = await parkingService.startParking(id, authFetch, 'TEST123');
      setUsage({
        id: data.usage_id,
        start_time: new Date(),
        end_time: null
      });
      await fetchParkingRecords();
    } catch (error) {
      console.error('开始使用停车场失败:', error);
      setError(error.message || '开始使用停车场失败');
      if (error.message.includes('401')) {
        navigate('/auth');
      }
    }
  };

  const handleEnd = async () => {
    try {
      const data = await parkingService.endParking(id, authFetch);
      setUsage(prev => ({
        ...prev,
        end_time: new Date(),
        total_amount: data.total_amount
      }));
      await fetchParkingRecords();
    } catch (error) {
      console.error('结束使用停车场失败:', error);
      setError(error.message || '结束使用停车场失败');
      if (error.message.includes('401')) {
        navigate('/auth');
      }
    }
  };

  const handlePayment = async () => {
    try {
      await parkingService.payParking(usage.id, authFetch);
      await fetchParkingRecords();
      navigate('/payment-success');
    } catch (error) {
      console.error('支付失败:', error);
      setError(error.message || '支付失败');
      if (error.message.includes('401')) {
        navigate('/auth');
      }
    }
  };

  if (isLoading) {
    return <div className="parking-usage loading">加载中...</div>;
  }

  if (error) {
    return (
      <div className="parking-usage error">
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>重试</button>
      </div>
    );
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