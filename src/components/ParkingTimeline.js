import React from 'react';
import { Tooltip } from 'antd';
import moment from 'moment';
import './styles/ParkingTimeline.css';

const ParkingTimeline = ({ openingHours, reservations, onTimeSelect }) => {
  // 解析开放时间
  const [startTime, endTime] = openingHours ? openingHours.split('-') : ['09:00', '18:00'];
  const startHour = parseInt(startTime.split(':')[0]);
  const endHour = parseInt(endTime.split(':')[0]);
  const now = moment();
  const currentHour = now.hours();
  const currentMinute = now.minutes();

  // 生成时间刻度（半小时为单位）
  const generateTimeMarks = () => {
    const marks = [];
    for (let hour = startHour; hour <= endHour; hour++) {
      // 添加整点
      marks.push({
        hour,
        minute: 0,
        label: `${hour.toString().padStart(2, '0')}:00`
      });
      
      // 添加半点
      marks.push({
        hour,
        minute: 30,
        label: `${hour.toString().padStart(2, '0')}:30`
      });
    }
    return marks;
  };

  // 检查时间段是否被预定
  const isTimeReserved = (hour, minute) => {
    if (!reservations || reservations.length === 0) return false;
    
    // 创建当前时间点的moment对象
    const checkTime = moment().startOf('day').hour(hour).minute(minute);
    
    return reservations.some(reservation => {
      if (reservation.status === 'cancelled') return false;
      
      const start = moment(`${reservation.reservation_date} ${reservation.start_time}`, 'YYYY-MM-DD HH:mm:ss');
      const end = moment(`${reservation.reservation_date} ${reservation.end_time}`, 'YYYY-MM-DD HH:mm:ss');
      
      return checkTime.isBetween(start, end, null, '[)');
    });
  };

  // 检查时间是否已过
  const isTimePassed = (hour, minute) => {
    if (hour < currentHour) return true;
    if (hour === currentHour && minute <= currentMinute) return true;
    return false;
  };

  // 检查时间是否在非开放时段
  const isTimeUnavailable = (hour) => {
    return hour < startHour || hour > endHour;
  };

  // 获取时间块的状态
  const getTimeBlockStatus = (hour, minute) => {
    if (isTimePassed(hour, minute)) return 'passed';
    if (isTimeReserved(hour, minute)) return 'reserved';
    if (isTimeUnavailable(hour)) return 'unavailable';
    return 'available';
  };

  // 处理时间块点击
  const handleTimeBlockClick = (hour, minute) => {
    // 只有可用时间才能点击
    const status = getTimeBlockStatus(hour, minute);
    if (status === 'available' && onTimeSelect) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      onTimeSelect(timeString);
    }
  };

  const timeMarks = generateTimeMarks();

  return (
    <div className="timeline-container">
      <div className="timeline-legend">
        <span className="legend-item">
          <span className="legend-color reserved"></span>
          已预约
        </span>
        <span className="legend-item">
          <span className="legend-color available"></span>
          可预约时间
        </span>
        <span className="legend-item">
          <span className="legend-color passed"></span>
          已过时间
        </span>
        <span className="legend-item">
          <span className="legend-color unavailable"></span>
          非开放时段
        </span>
      </div>
      
      <div className="timeline-content">
        <div className="timeline-hours">
          {timeMarks.map((mark, index) => (
            <div key={index} className="time-mark">
              <Tooltip title={`${mark.label} - ${getTimeBlockStatus(mark.hour, mark.minute) === 'available' ? '可预约' : 
                                           getTimeBlockStatus(mark.hour, mark.minute) === 'reserved' ? '已预约' : 
                                           getTimeBlockStatus(mark.hour, mark.minute) === 'passed' ? '已过期' : '非开放时段'}`}>
                <div 
                  className={`time-block ${getTimeBlockStatus(mark.hour, mark.minute)}`} 
                  onClick={() => handleTimeBlockClick(mark.hour, mark.minute)}
                />
              </Tooltip>
              {mark.minute === 0 && (
                <span className="hour-label">{mark.hour}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="timeline-info">
        <div>当日开放 {startTime}--{endTime}</div>
        <div>预约时间最少30分钟</div>
      </div>
    </div>
  );
};

export default ParkingTimeline; 