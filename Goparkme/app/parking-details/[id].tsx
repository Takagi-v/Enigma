import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { parkingAPI } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';

interface ParkingUsageDetails {
  id: number;
  location: string;
  hourly_rate: number;
  start_time: string;
  end_time: string | null;
  total_amount: number | null;
  status: 'active' | 'completed';
  payment_status: 'paid' | 'unpaid';
  vehicle_plate: string;
  notes: string | null;
  parking_spot: {
    coordinates: string;
  };
}

export default function ParkingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [usage, setUsage] = useState<ParkingUsageDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchUsageDetails = async () => {
      try {
        setLoading(true);
        const data = await parkingAPI.getParkingUsageById(id);
        setUsage(data);
      } catch (err) {
        console.error('获取停车详情失败:', err);
        Alert.alert('错误', '无法加载停车详情', [
          { text: '返回', onPress: () => router.back() }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchUsageDetails();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!usage) {
    return (
      <View style={styles.centered}>
        <Text>未找到停车记录。</Text>
      </View>
    );
  }

  const getStatusInfo = (status: string, paymentStatus: string) => {
    if (status === 'completed') {
      if (paymentStatus === 'paid') return { text: '已完成', color: '#28a745' };
      return { text: '待支付', color: '#ff9500' };
    }
    return { text: '进行中', color: '#007AFF' };
  };

  const statusInfo = getStatusInfo(usage.status, usage.payment_status);
  const coordinates = usage.parking_spot?.coordinates 
    ? {
        latitude: parseFloat(usage.parking_spot.coordinates.split(',')[0]),
        longitude: parseFloat(usage.parking_spot.coordinates.split(',')[1]),
      }
    : null;

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ title: '停车详情' }} />

      <View style={styles.card}>
        <Text style={styles.location}>{usage.location}</Text>
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
          <Text style={[styles.status, { color: statusInfo.color }]}>{statusInfo.text}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>时间和费用</Text>
        <InfoRow icon="calendar-outline" label="开始时间" value={new Date(usage.start_time).toLocaleString()} />
        <InfoRow icon="calendar-outline" label="结束时间" value={usage.end_time ? new Date(usage.end_time).toLocaleString() : '进行中'} />
        <InfoRow icon="hourglass-outline" label="总时长" value={usage.end_time ? calculateDuration(usage.start_time, usage.end_time) : '进行中'} />
        <InfoRow icon="cash-outline" label="费率" value={`$${usage.hourly_rate.toFixed(2)}/小时`} />
        <InfoRow icon="receipt-outline" label="总费用" value={usage.total_amount != null ? `$${usage.total_amount.toFixed(2)}` : '计算中'} isTotal />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>车辆信息</Text>
        <InfoRow icon="car-sport-outline" label="车牌号" value={usage.vehicle_plate} />
      </View>
      
      {coordinates && (
        <View style={[styles.card, styles.mapCard]}>
          <MapView
            style={styles.map}
            initialRegion={{
              ...coordinates,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
          >
            <Marker coordinate={coordinates} title={usage.location} />
          </MapView>
        </View>
      )}

      {usage.status === 'completed' && usage.payment_status === 'unpaid' && (
        <TouchableOpacity style={styles.payButton}>
          <Text style={styles.payButtonText}>立即支付</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const InfoRow = ({ icon, label, value, isTotal = false }: { icon: any, label: string, value: string, isTotal?: boolean }) => (
  <View style={styles.infoRow}>
    <Ionicons name={icon} size={20} color="#666" style={styles.icon} />
    <Text style={styles.label}>{label}</Text>
    <Text style={[styles.value, isTotal && styles.totalValue]}>{value}</Text>
  </View>
);

const calculateDuration = (startTime: string, endTime: string) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end.getTime() - start.getTime();

    if (diffMs < 0) return '时间错误';

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.round((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    let duration = '';
    if (diffDays > 0) duration += `${diffDays}天 `;
    if (diffHours > 0) duration += `${diffHours}小时 `;
    if (diffMinutes > 0 || (diffDays === 0 && diffHours === 0)) duration += `${diffMinutes}分钟`;
    
    return duration.trim();
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  location: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  status: {
    fontSize: 14,
    fontWeight: '600',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  icon: {
    marginRight: 12,
  },
  label: {
    fontSize: 16,
    color: '#333',
  },
  value: {
    fontSize: 16,
    color: '#666',
    marginLeft: 'auto',
  },
  totalValue: {
    fontWeight: 'bold',
    color: '#007AFF',
    fontSize: 18,
  },
  mapCard: {
    height: 200,
    padding: 0,
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  payButton: {
    backgroundColor: '#ff9500',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    alignItems: 'center',
  },
  payButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
}); 