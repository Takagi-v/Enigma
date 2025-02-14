import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Modal, Form, DatePicker, TimePicker, Input, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import moment from 'moment';
import './styles/ParkingDetail.css';
import Map from './Map';
import config from '../config';
import { useAuth } from '../contexts/AuthContext';
import ParkingTimeline from './ParkingTimeline';

// 添加时间验证函数
const checkParkingTime = (openingHours) => {
  if (!openingHours) return { isNearClosing: false, minsUntilClose: 0 };
  
  const [start, end] = openingHours.split('-');
  const [startHour, startMin] = start.split(':').map(Number);
  const [endHour, endMin] = end.split(':').map(Number);
  
  // 获取纽约时间
  const nyTime = new Date().toLocaleString("en-US", {timeZone: "America/New_York"});
  const nyDate = new Date(nyTime);
  const currentHour = nyDate.getHours();
  const currentMin = nyDate.getMinutes();
  
  // 计算当前时间到结束时间的分钟差
  const currentTotalMins = currentHour * 60 + currentMin;
  const endTotalMins = endHour * 60 + endMin;
  const minsUntilClose = endTotalMins - currentTotalMins;
  
  // 如果结束时间是第二天（比如 00:00），加上24小时
  const adjustedMinsUntilClose = minsUntilClose < 0 ? minsUntilClose + 24 * 60 : minsUntilClose;
  
  return {
    isNearClosing: adjustedMinsUntilClose <= 60, // 离关闭时间不到1小时
    minsUntilClose: adjustedMinsUntilClose
  };
};

function ParkingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, authFetch } = useAuth();
  const [parkingSpot, setParkingSpot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reservationModalVisible, setReservationModalVisible] = useState(false);
  const [reservations, setReservations] = useState([]);
  const [form] = Form.useForm();

  // 将 today 移到 useEffect 内部
  useEffect(() => {
    const fetchParkingDetail = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`${config.API_URL}/parking-spots/${id}`);
        if (!response.ok) throw new Error('获取停车位详情失败');
        const data = await response.json();
        
        // 处理坐标数据
        if (data.coordinates) {
          const [lat, lng] = data.coordinates.split(',').map(Number);
          data.lat = lat;
          data.lng = lng;
        }
        
        setParkingSpot(data);
        
        // 获取预定列表
        const reservationsResponse = await fetch(`${config.API_URL}/parking-spots/${id}/reservations`);
        if (reservationsResponse.ok) {
          const reservationsData = await reservationsResponse.json();
          // 只保留今天的预定
          const today = moment().startOf('day');
          const todayReservations = reservationsData.filter(r => 
            moment(r.reservation_date).isSame(today, 'day')
          );
          setReservations(todayReservations);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
        setLoading(false);
      }
    };

    fetchParkingDetail();

    // 设置定时刷新
    const intervalId = setInterval(fetchParkingDetail, 60000); // 每分钟刷新一次

    // 清理函数
    return () => clearInterval(intervalId);
  }, [id]); // 只依赖 id

  const handleUseParking = () => {
    if (!user) {
      message.error('请先登录');
      navigate('/auth');
      return;
    }

    const timeCheck = checkParkingTime(parkingSpot.opening_hours);
    if (timeCheck.isNearClosing) {
      Modal.confirm({
        title: '停车场即将关闭',
        content: `该停车场将在${Math.floor(timeCheck.minsUntilClose)}分钟后关闭，请确保您能在关闭前离开。是否继续？`,
        okText: '继续',
        cancelText: '取消',
        onOk: () => navigate(`/parking/${id}/use`)
      });
    } else {
      navigate(`/parking/${id}/use`);
    }
  };

  const handleReserve = () => {
    if (!user) {
      message.error('请先登录');
      navigate('/auth');
      return;
    }
    setReservationModalVisible(true);
  };

  const handleReservationSubmit = async (values) => {
    try {
      const { startTime, endTime, notes } = values;
      
      if (!user) {
        message.error('请先登录');
        navigate('/auth');
        return;
      }
      
      const reservationData = {
        userId: user.id,
        reservationDate: moment().format('YYYY-MM-DD'), // 直接使用当前日期
        startTime: startTime.format('HH:mm:ss'),
        endTime: endTime.format('HH:mm:ss'),
        notes
      };

      const response = await authFetch(`${config.API_URL}/parking-spots/${id}/reserve`, {
        method: 'POST',
        body: JSON.stringify(reservationData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '预定失败');
      }

      const result = await response.json();
      message.success('预定成功！');
      setReservationModalVisible(false);
      form.resetFields();

      // 刷新预定列表
      const reservationsResponse = await authFetch(`${config.API_URL}/parking-spots/${id}/reservations`);
      if (reservationsResponse.ok) {
        const reservationsData = await reservationsResponse.json();
        // 只保留今天的预定
        const today = moment().startOf('day');
        const todayReservations = reservationsData.filter(r => 
          moment(r.reservation_date).isSame(today, 'day')
        );
        setReservations(todayReservations);
      }
    } catch (error) {
      message.error(error.message);
    }
  };

  const handleTimeSelect = (time) => {
    form.setFieldsValue({
      startTime: moment(time, 'HH:mm')
    });
    setReservationModalVisible(true);
  };

  if (isLoading) return <div className="loading">加载中...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!parkingSpot) return <div className="error">信息不存在</div>;

  // 确保有有效的坐标数据
  if (!parkingSpot.lat || !parkingSpot.lng) {
    return <div className="error">无效的位置信息</div>;
  }

  return (
    <div className="parking-detail-container">
      <div className="detail-content">
        <div className="info-section">
          <div className="header-section">
            <Button 
              type="text" 
              icon={<ArrowLeftOutlined />} 
              onClick={() => navigate('/')}
              className="back-button"
            />
          </div>
          
          <div className="price-section">
            <div className="price-info">
              <h1 className="location-title">{parkingSpot.location}</h1>
              <h2 className="price">¥{parkingSpot.price}/小时</h2>
            </div>
            <div className="status-section">
              <span className={`status ${parkingSpot.status}`}>
                {parkingSpot.status === 'available' ? '空闲' : '使用中'}
              </span>
              {parkingSpot.status === 'available' && (
                <div className="action-buttons">
                  <Button
                    type="primary"
                    size="large"
                    className="use-button"
                    onClick={handleUseParking}
                  >
                    立即使用
                  </Button>
                  <Button
                    type="default"
                    size="large"
                    className="reserve-button"
                    onClick={handleReserve}
                  >
                    预定
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          <div className="info-items">
            <div className="info-item">
              <label>联系人：</label>
              <span>{parkingSpot.contact}</span>
            </div>
            <div className="info-item">
              <label>发布者：</label>
              <span>{parkingSpot.owner_username}</span>
            </div>
            <div className="info-item">
              <label>开放时段：</label>
              <span>{parkingSpot.opening_hours}</span>
              {checkParkingTime(parkingSpot.opening_hours).isNearClosing && (
                <span className="closing-warning">
                  距离关闭还有{Math.floor(checkParkingTime(parkingSpot.opening_hours).minsUntilClose)}分钟
                </span>
              )}
            </div>
            <div className="info-item">
              <label>发布时间：</label>
              <span>{new Date(parkingSpot.created_at).toLocaleString()}</span>
            </div>
          </div>

          <div className="timeline-container">
            <ParkingTimeline 
              openingHours={parkingSpot.opening_hours}
              reservations={reservations}
              onTimeSelect={handleTimeSelect}
            />
          </div>

          <div className="reservations-section">
            <h3>今日预定情况</h3>
            {reservations.length > 0 ? (
              <ul className="reservations-list">
                {reservations.map(reservation => (
                  <li key={reservation.id} className="reservation-item">
                    <span className="time">{reservation.start_time} - {reservation.end_time}</span>
                    <span className={`status ${reservation.status}`}>
                      {reservation.status === 'pending' ? '待确认' : 
                       reservation.status === 'confirmed' ? '已确认' : 
                       reservation.status === 'cancelled' ? '已取消' : 
                       '已完成'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>今日暂无预定</p>
            )}
          </div>

          <div className="description-section">
            <h3>详细描述</h3>
            <p>{parkingSpot.description || '暂无描述'}</p>
          </div>

          <div className="map-section">
            <h3>位置信息</h3>
            <div className="parking-detail-map-wrapper">
              <Map 
                mode="detail"
                initialSpot={{
                  ...parkingSpot,
                  lat: parkingSpot.lat,
                  lng: parkingSpot.lng
                }}
                hideSearch={true}
              />
            </div>
          </div>
        </div>
      </div>

      <Modal
        title="预定停车位"
        visible={reservationModalVisible}
        onCancel={() => setReservationModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          onFinish={handleReservationSubmit}
          layout="vertical"
        >
          <Form.Item
            name="startTime"
            label="开始时间"
            rules={[
              { required: true, message: '请选择开始时间' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value) return Promise.resolve();
                  const now = moment();
                  if (value.isBefore(now)) {
                    return Promise.reject(new Error('不能选择过去的时间'));
                  }
                  return Promise.resolve();
                },
              }),
            ]}
          >
            <TimePicker 
              format="HH:mm" 
              style={{ width: '100%' }}
              minuteStep={30}
              disabledHours={() => {
                const now = moment();
                return Array.from({ length: now.hour() }, (_, i) => i);
              }}
              disabledMinutes={(hour) => {
                const now = moment();
                if (hour === now.hour()) {
                  return Array.from({ length: now.minute() }, (_, i) => i);
                }
                return [];
              }}
            />
          </Form.Item>

          <Form.Item
            name="endTime"
            label="结束时间"
            rules={[
              { required: true, message: '请选择结束时间' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || !getFieldValue('startTime')) {
                    return Promise.resolve();
                  }
                  if (value.isBefore(getFieldValue('startTime'))) {
                    return Promise.reject(new Error('结束时间必须晚于开始时间'));
                  }
                  return Promise.resolve();
                },
              }),
            ]}
          >
            <TimePicker 
              format="HH:mm" 
              style={{ width: '100%' }}
              minuteStep={30}
            />
          </Form.Item>

          <Form.Item
            name="notes"
            label="备注"
          >
            <Input.TextArea rows={4} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: '100%' }}>
              确认预定
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default ParkingDetail; 