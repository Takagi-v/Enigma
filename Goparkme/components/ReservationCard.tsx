import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { parkingAPI } from '../services/api';

// Match the type from reservations.tsx, now with lat/lon
export interface Reservation {
  id: number;
  parking_spot_id: number;
  reservation_date: string;
  start_time: string;
  end_time: string;
  total_amount: number;
  status: 'active' | 'confirmed' | 'cancelled';
  location: string;
  latitude?: number;
  longitude?: number;
}

type Props = {
  reservation: Reservation;
  onCancel: (reservation: Reservation) => void;
};

export default function ReservationCard({ reservation, onCancel }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleNavigate = () => {
    if (!reservation.latitude || !reservation.longitude) {
      Alert.alert('导航失败', '该停车位没有可用的位置信息。');
      return;
    }
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${reservation.latitude},${reservation.longitude}`;
    const label = reservation.location;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
    });

    if (url) {
      Linking.openURL(url);
    }
  };

  const handleStartParking = async () => {
    Alert.alert(
      '开始停车',
      '您确定要开始使用此车位吗？计时将立即开始。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: async () => {
            setIsLoading(true);
            try {
              // Assuming vehicle plate is stored in user profile or needs to be asked
              // For now, let's hardcode it or pass it down if available
              await parkingAPI.startParking(reservation.parking_spot_id, 'DEFAULT-PLATE'); 
              Alert.alert('成功', '停车开始！');
              router.replace('/parking-timer' as any); // Navigate to timer screen
            } catch (error: any) {
              Alert.alert('操作失败', error.message || '开始停车失败，请重试。');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };
  
  const isUpcoming = () => {
    const reservationDateTime = new Date(`${reservation.reservation_date} ${reservation.start_time}`);
    return reservationDateTime > new Date();
  };
  
  const canStart = () => {
    if (reservation.status !== 'confirmed') return false;
    const now = new Date();
    const startTime = new Date(`${reservation.reservation_date} ${reservation.start_time}`);
    const thirtyMinutes = 30 * 60 * 1000;
    // Can start if it's 30 mins before the start time and not past the start time yet
    return (startTime.getTime() - now.getTime()) < thirtyMinutes && now < startTime;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#007AFF';
      case 'confirmed': return '#28a745';
      case 'cancelled': return '#6c757d';
      default: return '#6c757d';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return '进行中';
      case 'confirmed': return '已确认';
      case 'cancelled': return '已取消';
      default: return '未知';
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.location}>{reservation.location}</Text>
        <Text style={[styles.status, { color: getStatusColor(reservation.status) }]}>
          {getStatusText(reservation.status)}
        </Text>
      </View>

      <View style={styles.content}>
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={16} color="#666" />
          <Text style={styles.infoText}>{new Date(reservation.reservation_date).toLocaleDateString()}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={16} color="#666" />
          <Text style={styles.infoText}>{reservation.start_time.substring(0,5)} - {reservation.end_time.substring(0,5)}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.button} onPress={handleNavigate}>
          <Ionicons name="navigate-outline" size={18} color="#007AFF" />
          <Text style={styles.buttonText}>导航</Text>
        </TouchableOpacity>

        {isUpcoming() && reservation.status === 'confirmed' && (
          <TouchableOpacity style={styles.button} onPress={() => onCancel(reservation)}>
            <Ionicons name="close-circle-outline" size={18} color="#F44336" />
            <Text style={[styles.buttonText, { color: '#F44336' }]}>取消</Text>
          </TouchableOpacity>
        )}

        {canStart() && (
          <TouchableOpacity style={[styles.button, styles.startButton]} onPress={handleStartParking} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="play-circle-outline" size={18} color="#fff" />
                <Text style={[styles.buttonText, styles.startButtonText]}>开始停车</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 10,
    marginBottom: 10,
  },
  location: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  status: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  infoText: {
    marginLeft: 8,
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 10,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 10,
  },
  buttonText: {
    marginLeft: 5,
    fontSize: 14,
    fontWeight: '500',
    color: '#007AFF',
  },
  startButton: {
    backgroundColor: '#007AFF',
  },
  startButtonText: {
    color: '#fff',
  },
}); 