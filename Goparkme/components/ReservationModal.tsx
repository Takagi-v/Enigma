import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { parkingAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface ReservationModalProps {
  visible: boolean;
  onClose: () => void;
  parkingSpot: {
    id: number;
    location: string;
    hourly_rate: number;
    opening_hours: string;
  } | null;
  onReservationCreated: () => void;
}

export default function ReservationModal({
  visible,
  onClose,
  parkingSpot,
  onReservationCreated,
}: ReservationModalProps) {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [notes, setNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [totalAmount, setTotalAmount] = useState(0);

  // 重置表单
  const resetForm = () => {
    const now = new Date();
    setSelectedDate(now);
    setStartTime(now);
    const defaultEndTime = new Date(now.getTime() + 60 * 60 * 1000); // 默认1小时后
    setEndTime(defaultEndTime);
    setNotes('');
    setTotalAmount(0);
  };

  useEffect(() => {
    if (visible) {
      resetForm();
    }
  }, [visible]);

  // 计算总费用
  useEffect(() => {
    if (parkingSpot && startTime && endTime && endTime > startTime) {
      const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
      const amount = Math.ceil(hours * parkingSpot.hourly_rate);
      setTotalAmount(amount);
    } else {
      setTotalAmount(0);
    }
  }, [startTime, endTime, parkingSpot]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTimeForAPI = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}:00`;
  };

  const formatDateForAPI = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleSubmit = async () => {
    if (!user || !parkingSpot) {
      Alert.alert('错误', '请先登录');
      return;
    }

    if (endTime <= startTime) {
      Alert.alert('错误', '结束时间必须晚于开始时间');
      return;
    }

    const now = new Date();
    const reservationDateTime = new Date(selectedDate);
    reservationDateTime.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);

    if (reservationDateTime < now) {
      Alert.alert('错误', '不能预定过去的时间');
      return;
    }

    try {
      setLoading(true);

      const reservationData = {
        userId: user.id,
        reservationDate: formatDateForAPI(selectedDate),
        startTime: formatTimeForAPI(startTime),
        endTime: formatTimeForAPI(endTime),
        notes: notes.trim(),
      };

      await parkingAPI.createReservation(parkingSpot.id, reservationData);

      Alert.alert('成功', '预约创建成功！', [
        {
          text: '确定',
          onPress: () => {
            onReservationCreated();
            onClose();
          },
        },
      ]);
    } catch (error) {
      console.error('创建预约失败:', error);
      Alert.alert('失败', (error as Error).message || '创建预约失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  if (!parkingSpot) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        {/* 头部 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>预约停车位</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content}>
          {/* 停车位信息 */}
          <View style={styles.spotInfo}>
            <Text style={styles.spotLocation}>{parkingSpot.location}</Text>
            <Text style={styles.spotRate}>¥{parkingSpot.hourly_rate}/小时</Text>
            <Text style={styles.spotHours}>营业时间: {parkingSpot.opening_hours}</Text>
          </View>

          {/* 日期选择 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>选择日期</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#666" />
              <Text style={styles.selectorText}>{formatDate(selectedDate)}</Text>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* 时间选择 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>选择时间</Text>
            
            <View style={styles.timeRow}>
              <Text style={styles.timeLabel}>开始时间:</Text>
              <TouchableOpacity
                style={styles.timeSelector}
                onPress={() => setShowStartTimePicker(true)}
              >
                <Ionicons name="time-outline" size={20} color="#666" />
                <Text style={styles.selectorText}>{formatTime(startTime)}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.timeRow}>
              <Text style={styles.timeLabel}>结束时间:</Text>
              <TouchableOpacity
                style={styles.timeSelector}
                onPress={() => setShowEndTimePicker(true)}
              >
                <Ionicons name="time-outline" size={20} color="#666" />
                <Text style={styles.selectorText}>{formatTime(endTime)}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 费用显示 */}
          {totalAmount > 0 && (
            <View style={styles.amountSection}>
              <Text style={styles.amountLabel}>预计费用</Text>
              <Text style={styles.amountValue}>¥{totalAmount}</Text>
            </View>
          )}

          {/* 备注 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>备注 (可选)</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="请输入备注信息..."
              multiline
              numberOfLines={3}
            />
          </View>

          {/* 提交按钮 */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading || totalAmount <= 0}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.submitButtonText}>确认预约</Text>
            )}
          </TouchableOpacity>
        </ScrollView>

        {/* 日期选择器 */}
        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onChange={(event: any, date?: Date) => {
              setShowDatePicker(false);
              if (date) setSelectedDate(date);
            }}
          />
        )}

        {/* 开始时间选择器 */}
        {showStartTimePicker && (
          <DateTimePicker
            value={startTime}
            mode="time"
            display="spinner"
            onChange={(event: any, time?: Date) => {
              setShowStartTimePicker(false);
              if (time) {
                setStartTime(time);
                // 自动调整结束时间（至少比开始时间晚1小时）
                if (endTime <= time) {
                  setEndTime(new Date(time.getTime() + 60 * 60 * 1000));
                }
              }
            }}
          />
        )}

        {/* 结束时间选择器 */}
        {showEndTimePicker && (
          <DateTimePicker
            value={endTime}
            mode="time"
            display="spinner"
            minimumDate={startTime}
            onChange={(event: any, time?: Date) => {
              setShowEndTimePicker(false);
              if (time && time > startTime) {
                setEndTime(time);
              }
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  closeButton: {
    padding: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 34,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  spotInfo: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  spotLocation: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  spotRate: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
    marginBottom: 4,
  },
  spotHours: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  selectorText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeLabel: {
    width: 80,
    fontSize: 16,
    color: '#333',
  },
  timeSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  amountSection: {
    backgroundColor: '#e3f2fd',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
  },
  amountValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
}); 