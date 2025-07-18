import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, Button, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { parkingAPI } from '../../services/api'; // 确保路径正确
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons'; // 使用Expo的图标库
import { useLocation, getDistanceFromLatLonInKm } from '../../contexts/LocationContext';
import { useAuth } from '../../contexts/AuthContext';
import ReservationModal from '../../components/ReservationModal';
import ParkingTimeline from '../../components/ParkingTimeline';
import AuthModal from '../../components/AuthModal';

// 定义停车位数据类型
interface ParkingSpot {
  id: number;
  location: string;
  coordinates: string;
  price: number;
  hourly_rate: number;
  description: string;
  status: 'available' | 'occupied' | 'reserved'; // 增加 'reserved' 状态
  contact: string;
  opening_hours: string;
  // ... 其他你需要的字段
}

// 预约数据接口
interface Reservation {
  id: number;
  start_time: string;
  end_time: string;
  status: 'active' | 'confirmed' | 'cancelled';
  username?: string;
}


export default function ParkingDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [spot, setSpot] = useState<ParkingSpot | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { location } = useLocation();

  useEffect(() => {
    if (!id || typeof id !== 'string') {
      setError('无效的停车位ID');
      setLoading(false);
      return;
    }

    const fetchSpotDetails = async () => {
      try {
        setLoading(true);
        const [spotData, reservationsData] = await Promise.all([
          parkingAPI.getParkingSpotById(id),
          parkingAPI.getReservations(id)
        ]);

        setSpot(spotData);
        setReservations(reservationsData || []);
      } catch (err) {
        console.error(err);
        setError('获取停车位详情失败');
        Alert.alert('错误', '无法加载停车位详情');
      } finally {
        setLoading(false);
      }
    };

    fetchSpotDetails();
  }, [id]);

  // 处理预约功能
  const handleReserve = () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    setShowReservationModal(true);
  };

  // 处理立即使用功能
  const handleUse = () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    
    if (spot?.status !== 'available') {
      Alert.alert('提示', '该停车位当前不可用');
      return;
    }
    
    router.push(`/parking-use?spotId=${id}` as any);
  };

  const handleReservationCreated = () => {
    // 重新获取预约数据
    if (id && typeof id === 'string') {
      parkingAPI.getReservations(id)
        .then(data => setReservations(data || []))
        .catch(err => console.error('获取预约数据失败:', err));
    }
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" /></View>;
  }

  if (error || !spot) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error || '未找到停车位信息'}</Text>
        <Button title="返回地图" onPress={() => router.back()} />
      </View>
    );
  }

  const [lat, lng] = spot.coordinates ? spot.coordinates.split(',').map(Number) : [0, 0];

  let distance = null;
  if (location && spot.coordinates) {
    const [spotLat, spotLng] = spot.coordinates.split(',').map(Number);
    if (!isNaN(spotLat) && !isNaN(spotLng)) {
      distance = getDistanceFromLatLonInKm(
        location.coords.latitude,
        location.coords.longitude,
        spotLat,
        spotLng
      );
    }
  }

  return (
    <ScrollView style={styles.container}>
      {/* 头部价格和地址 */}
      <View style={styles.header}>
        <Text style={styles.locationTitle}>{spot.location}</Text>
        <View style={styles.headerDetails}>
            <Text style={styles.price}>¥{spot.hourly_rate}/小时</Text>
            {distance !== null && (
                <Text style={styles.distance}>
                    距离 {distance.toFixed(2)} km
                </Text>
            )}
        </View>
      </View>

      {/* 状态和操作按钮 */}
      <View style={styles.statusSection}>
        <Text style={[styles.status, styles[`status_${spot.status}`]]}>
          {spot.status === 'available' ? '空闲' : spot.status === 'occupied' ? '使用中' : '已预定'}
        </Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.button, spot.status !== 'available' && styles.buttonDisabled]} 
            onPress={handleUse}
            disabled={spot.status !== 'available'}
          >
            <Text style={styles.buttonText}>立即使用</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.reserveButton]} onPress={handleReserve}>
            <Text style={styles.buttonText}>预定</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* 详细信息 */}
      <View style={styles.infoSection}>
        <InfoRow icon="time-outline" label="开放时段" value={spot.opening_hours} />
        <InfoRow icon="call-outline" label="联系方式" value={spot.contact} />
        <InfoRow icon="information-circle-outline" label="描述" value={spot.description} />
      </View>

      {/* 时间轴 */}
      <ParkingTimeline 
        openingHours={spot.opening_hours} 
        reservations={reservations} 
        onTimeSlotPress={(timeSlot) => {
          if (timeSlot.status === 'available') {
            handleReserve();
          }
        }}
      />

      {/* 地图 */}
      <View style={styles.mapContainer}>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={{
            latitude: lat,
            longitude: lng,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }}
          scrollEnabled={false}
          zoomEnabled={false}
        >
          <Marker coordinate={{ latitude: lat, longitude: lng }} />
        </MapView>
      </View>

      {/* 预约弹窗 */}
      <ReservationModal
        visible={showReservationModal}
        onClose={() => setShowReservationModal(false)}
        parkingSpot={spot ? {
          id: spot.id,
          location: spot.location,
          hourly_rate: spot.hourly_rate,
          opening_hours: spot.opening_hours,
        } : null}
        onReservationCreated={handleReservationCreated}
      />

      {/* 登录弹窗 */}
      <AuthModal
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => setShowAuthModal(false)}
      />
    </ScrollView>
  );
}

// 辅助组件：信息行
const InfoRow = ({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap, label: string, value: string }) => (
  <View style={styles.infoRow}>
    <Ionicons name={icon} size={24} color="#555" />
    <View style={styles.infoTextContainer}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f8' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  header: { padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#eee' },
  locationTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  headerDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  price: { fontSize: 20, color: '#007AFF', fontWeight: '500' },
  distance: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  statusSection: { padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#eee', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  status: { fontSize: 18, fontWeight: 'bold', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 15, overflow: 'hidden' },
  status_available: { backgroundColor: '#d4edda', color: '#155724' },
  status_occupied: { backgroundColor: '#f8d7da', color: '#721c24' },
  status_reserved: { backgroundColor: '#fff3cd', color: '#856404' },
  actionButtons: { flexDirection: 'row' },
  button: { backgroundColor: '#007AFF', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8, marginLeft: 10 },
  buttonDisabled: { backgroundColor: '#ccc' },
  reserveButton: { backgroundColor: '#5bc0de' },
  buttonText: { color: 'white', fontWeight: 'bold' },
  infoSection: { marginTop: 10, backgroundColor: 'white', padding: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 15 },
  infoTextContainer: { marginLeft: 15, flex: 1 },
  infoLabel: { fontSize: 14, color: '#888' },
  infoValue: { fontSize: 16, color: '#333', marginTop: 2 },
  mapContainer: { height: 200, marginTop: 10 },
  map: { ...StyleSheet.absoluteFillObject },
  errorText: { color: 'red', fontSize: 16, textAlign: 'center' }
}); 