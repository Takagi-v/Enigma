import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Reservation {
  id: number;
  start_time: string;
  end_time: string;
  status: 'active' | 'confirmed' | 'cancelled';
  username?: string;
}

interface TimeSlot {
  time: string;
  status: 'available' | 'reserved' | 'current';
  reservationId?: number;
  username?: string;
}

interface ParkingTimelineProps {
  openingHours: string;
  reservations: Reservation[];
  onTimeSlotPress?: (timeSlot: TimeSlot) => void;
}

export default function ParkingTimeline({ 
  openingHours, 
  reservations, 
  onTimeSlotPress 
}: ParkingTimelineProps) {
  
  // 解析营业时间
  const parseOpeningHours = (hours: string) => {
    // 假设格式类似 "08:00-22:00" 或 "24小时"
    if (hours.includes('24小时') || hours.includes('24小时')) {
      return { start: 0, end: 24 };
    }
    
    const match = hours.match(/(\d{1,2}):?(\d{2})?[-–](\d{1,2}):?(\d{2})?/);
    if (match) {
      const startHour = parseInt(match[1]);
      const startMinute = parseInt(match[2] || '0');
      const endHour = parseInt(match[3]);
      const endMinute = parseInt(match[4] || '0');
      
      return {
        start: startHour + startMinute / 60,
        end: endHour + endMinute / 60,
      };
    }
    
    // 默认值
    return { start: 8, end: 22 };
  };

  // 生成时间段
  const generateTimeSlots = (): TimeSlot[] => {
    const { start, end } = parseOpeningHours(openingHours);
    const slots: TimeSlot[] = [];
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour + currentMinute / 60;

    // 生成每小时的时间段
    for (let hour = Math.floor(start); hour < Math.ceil(end); hour++) {
      const timeString = `${hour.toString().padStart(2, '0')}:00`;
      
      // 检查是否有预约
      const reservation = reservations.find(res => {
        if (res.status === 'cancelled') return false;
        
        const resStartTime = parseTimeString(res.start_time);
        const resEndTime = parseTimeString(res.end_time);
        return hour >= resStartTime && hour < resEndTime;
      });

      let status: 'available' | 'reserved' | 'current' = 'available';
      
      if (reservation) {
        status = 'reserved';
      } else if (hour === Math.floor(currentTime) && hour >= start && hour < end) {
        status = 'current';
      }

      slots.push({
        time: timeString,
        status,
        reservationId: reservation?.id,
        username: reservation?.username,
      });
    }

    return slots;
  };

  // 解析时间字符串 "HH:MM:SS" 返回小时数
  const parseTimeString = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours + (minutes || 0) / 60;
  };

  const timeSlots = generateTimeSlots();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return '#d4edda'; // 绿色
      case 'reserved':
        return '#f8d7da'; // 红色
      case 'current':
        return '#fff3cd'; // 黄色
      default:
        return '#e9ecef'; // 灰色
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'available':
        return '#155724';
      case 'reserved':
        return '#721c24';
      case 'current':
        return '#856404';
      default:
        return '#6c757d';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available':
        return '空闲';
      case 'reserved':
        return '已预约';
      case 'current':
        return '当前时段';
      default:
        return '未知';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>今日时间安排</Text>
        <Text style={styles.hours}>营业时间: {openingHours}</Text>
      </View>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={styles.timelineContainer}
      >
        {timeSlots.map((slot, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.timeSlot,
              { backgroundColor: getStatusColor(slot.status) }
            ]}
            onPress={() => onTimeSlotPress?.(slot)}
            disabled={slot.status === 'reserved'}
          >
            <Text style={[
              styles.timeText,
              { color: getStatusTextColor(slot.status) }
            ]}>
              {slot.time}
            </Text>
            <Text style={[
              styles.statusText,
              { color: getStatusTextColor(slot.status) }
            ]}>
              {getStatusText(slot.status)}
            </Text>
            {slot.username && (
              <Text style={[
                styles.usernameText,
                { color: getStatusTextColor(slot.status) }
              ]}>
                {slot.username}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 图例 */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: getStatusColor('available') }]} />
          <Text style={styles.legendText}>空闲</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: getStatusColor('reserved') }]} />
          <Text style={styles.legendText}>已预约</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: getStatusColor('current') }]} />
          <Text style={styles.legendText}>当前时段</Text>
        </View>
      </View>

      {/* 预约详情 */}
      {reservations.length > 0 && (
        <View style={styles.reservationsSection}>
          <Text style={styles.reservationsTitle}>预约详情</Text>
          {reservations
            .filter(res => res.status !== 'cancelled')
            .map(reservation => (
              <View key={reservation.id} style={styles.reservationItem}>
                <View style={styles.reservationTime}>
                  <Ionicons name="time-outline" size={16} color="#666" />
                  <Text style={styles.reservationTimeText}>
                    {reservation.start_time.substring(0, 5)} - {reservation.end_time.substring(0, 5)}
                  </Text>
                </View>
                {reservation.username && (
                  <Text style={styles.reservationUser}>预约人: {reservation.username}</Text>
                )}
                <Text style={[
                  styles.reservationStatus,
                  reservation.status === 'active' ? styles.activeStatus : styles.confirmedStatus
                ]}>
                  {reservation.status === 'active' ? '进行中' : '已确认'}
                </Text>
              </View>
            ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    margin: 10,
    borderRadius: 12,
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333',
  },
  hours: {
    fontSize: 14,
    color: '#666',
  },
  scrollView: {
    marginBottom: 16,
  },
  timelineContainer: {
    flexDirection: 'row',
    paddingHorizontal: 4,
  },
  timeSlot: {
    width: 80,
    height: 60,
    marginHorizontal: 4,
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '500',
  },
  usernameText: {
    fontSize: 8,
    marginTop: 2,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  reservationsSection: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 16,
  },
  reservationsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  reservationItem: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  reservationTime: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  reservationTimeText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  reservationUser: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  reservationStatus: {
    fontSize: 12,
    fontWeight: '500',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  activeStatus: {
    backgroundColor: '#d1ecf1',
    color: '#0c5460',
  },
  confirmedStatus: {
    backgroundColor: '#d4edda',
    color: '#155724',
  },
});