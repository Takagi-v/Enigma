import React from 'react';
import { Tooltip } from 'antd';
import moment from 'moment';
import './styles/ParkingTimeline.css';

const ParkingTimeline = ({ openingHours, reservations, onTimeSelect }) => {
  // 解析开放时间
  const [startTime, endTime] = openingHours.split('-');
  const startHour = parseInt(startTime.split(':')[0]);
  const endHour = parseInt(endTime.split(':')[0]);
  const now = moment();

  // 生成时间段（每半小时一个时间段）
  const generateTimeSlots = () => {
    const slots = [];
    let currentHour = startHour;
    
    while (currentHour !== endHour || slots.length === 0) {
      // 添加整点
      slots.push({
        time: `${currentHour.toString().padStart(2, '0')}:00`,
        type: 'hour'
      });
      
      // 添加半点
      slots.push({
        time: `${currentHour.toString().padStart(2, '0')}:30`,
        type: 'half'
      });
      
      currentHour = (currentHour + 1) % 24;
    }
    
    return slots;
  };

  // 检查时间段是否被预定
  const isTimeSlotReserved = (timeSlot) => {
    const [hours, minutes] = timeSlot.split(':').map(Number);
    const slotTime = moment().set({ hours, minutes, seconds: 0 });
    
    return reservations.some(reservation => {
      const startTime = moment(reservation.start_time, 'HH:mm:ss');
      const endTime = moment(reservation.end_time, 'HH:mm:ss');
      
      const reservationStart = moment().set({
        hours: startTime.hours(),
        minutes: startTime.minutes(),
        seconds: 0
      });
      const reservationEnd = moment().set({
        hours: endTime.hours(),
        minutes: endTime.minutes(),
        seconds: 0
      });
      
      return slotTime.isBetween(reservationStart, reservationEnd, null, '[)');
    });
  };

  // 检查时间段是否已过期
  const isTimeSlotPassed = (timeSlot) => {
    const [hours, minutes] = timeSlot.split(':').map(Number);
    const slotTime = moment().set({ hours, minutes, seconds: 0 });
    return slotTime.isBefore(now);
  };

  // 获取时间段的状态信息
  const getTimeSlotInfo = (timeSlot) => {
    if (isTimeSlotPassed(timeSlot)) {
      return {
        status: 'passed',
        tooltip: '已过期'
      };
    }

    const isReserved = isTimeSlotReserved(timeSlot);
    const reservation = reservations.find(r => {
      const startTime = moment(r.start_time, 'HH:mm:ss').format('HH:mm');
      const endTime = moment(r.end_time, 'HH:mm:ss').format('HH:mm');
      return startTime <= timeSlot && timeSlot < endTime;
    });

    return {
      status: isReserved ? 'reserved' : 'available',
      tooltip: isReserved 
        ? `已被预定 (${reservation.start_time} - ${reservation.end_time})`
        : '可预定'
    };
  };

  const timeSlots = generateTimeSlots();

  return (
    <div className="parking-timeline">
      <div className="timeline-header">
        <span>今日开放时间</span>
        <div className="timeline-legend">
          <span className="legend-item">
            <span className="legend-color passed"></span>
            已过期
          </span>
          <span className="legend-item">
            <span className="legend-color available"></span>
            可预定
          </span>
          <span className="legend-item">
            <span className="legend-color reserved"></span>
            已预定
          </span>
        </div>
      </div>
      <div className="timeline-container">
        {timeSlots.map((slot, index) => {
          const { status, tooltip } = getTimeSlotInfo(slot.time);
          return (
            <Tooltip key={index} title={`${slot.time} - ${tooltip}`}>
              <div
                className={`timeline-slot ${slot.type} ${status}`}
                onClick={() => !isTimeSlotPassed(slot.time) && onTimeSelect && onTimeSelect(slot.time)}
                style={{ cursor: status === 'passed' ? 'not-allowed' : 'pointer' }}
              >
                {slot.type === 'hour' && (
                  <span className="time-label">{slot.time}</span>
                )}
              </div>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
};

export default ParkingTimeline; 