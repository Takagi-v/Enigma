import React from 'react';
import { Tooltip } from 'antd';
import moment from 'moment';
import './styles/ParkingTimeline.css';

const ParkingTimeline = ({ openingHours, reservations }) => {
  // 解析开放时间
  const [startTime, endTime] = openingHours.split('-');
  const startHour = parseInt(startTime.split(':')[0]);
  const endHour = parseInt(endTime.split(':')[0]);
  const now = moment();
  const currentHour = now.hours();

  // 生成时间刻度
  const generateTimeMarks = () => {
    const marks = [];
    for (let hour = startHour; hour <= endHour; hour++) {
      marks.push(hour);
    }
    return marks;
  };

  // 检查时间段是否被预定
  const isTimeReserved = (hour) => {
    return reservations.some(reservation => {
      const start = moment(reservation.start_time, 'HH:mm:ss').hours();
      const end = moment(reservation.end_time, 'HH:mm:ss').hours();
      return hour >= start && hour < end;
    });
  };

  // 检查时间是否已过
  const isTimePassed = (hour) => {
    return hour < currentHour;
  };

  // 检查时间是否在非开放时段
  const isTimeUnavailable = (hour) => {
    return hour < startHour || hour > endHour;
  };

  // 获取时间块的状态
  const getTimeBlockStatus = (hour) => {
    if (isTimePassed(hour)) return 'passed';
    if (isTimeReserved(hour)) return 'reserved';
    if (isTimeUnavailable(hour)) return 'unavailable';
    return 'available';
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
          预约时间段
        </span>
        <span className="legend-item">
          <span className="legend-color passed"></span>
          已过时间
        </span>
        <span className="legend-item">
          <span className="legend-color unavailable"></span>
          非开放预约时段
        </span>
      </div>
      
      <div className="timeline-content">
        <div className="timeline-hours">
          {timeMarks.map(hour => (
            <div key={hour} className="hour-mark">
              <div className={`hour-block ${getTimeBlockStatus(hour)}`} />
              <span className="hour-label">{hour.toString().padStart(2, '0')}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="timeline-info">
        <div>当日开放 {startTime}--{endTime}</div>
        <div>每次预约 1时-16时</div>
      </div>
    </div>
  );
};

export default ParkingTimeline; 