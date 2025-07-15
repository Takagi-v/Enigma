import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker, Callout, Region } from 'react-native-maps';
import BottomSheet from '@gorhom/bottom-sheet';
import { parkingAPI } from '../../services/api';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ParkingListDrawer from '../../components/ParkingListDrawer';
import { ParkingSpot } from '../../types';
import { useLocation } from '../../contexts/LocationContext';
import { useParkingStatus } from '../../hooks/useParkingStatus';

// 定义停车位数据类型 - 已被移除
// interface ParkingSpot {
// ...
// }

export default function MapScreen() {
  const [parkingSpots, setParkingSpots] = useState<ParkingSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const { location } = useLocation();
  const { hasActiveUsage, showUsageAlert } = useParkingStatus();

  // 获取停车位数据
  const fetchParkingSpots = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await parkingAPI.getAllParkingSpots();
      
      if (response && response.spots) {
        const validSpots = response.spots.filter((spot: ParkingSpot) => {
          if (!spot.coordinates) return false;
          const coords = spot.coordinates.split(',');
          return coords.length === 2 && 
                 !isNaN(parseFloat(coords[0])) && 
                 !isNaN(parseFloat(coords[1]));
        });
        
        setParkingSpots(validSpots);
      } else {
        setParkingSpots([]);
      }
    } catch (err: any) {
      console.error('获取停车位数据失败:', err);
      setError('获取停车位数据失败');
      Alert.alert('错误', '无法获取停车位数据，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时获取数据
  useEffect(() => {
    fetchParkingSpots();
  }, []);

  // 处理Callout点击事件
  const handleCalloutPress = (spot: ParkingSpot) => {
    router.push(`/parking/${spot.id}`);
  };

  // 计算地图的初始区域
  const getInitialRegion = () => {
    if (parkingSpots.length === 0) {
      // 默认显示上海
      return {
        latitude: 31.2304,
        longitude: 121.4737,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };
    }

    const latitudes = parkingSpots.map(spot => parseFloat(spot.coordinates.split(',')[0]));
    const longitudes = parkingSpots.map(spot => parseFloat(spot.coordinates.split(',')[1]));
    
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);
    
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: (maxLat - minLat) * 1.2, // 添加一些边距
      longitudeDelta: (maxLng - minLng) * 1.2,
    };
  };

  // 定位到用户当前位置
  const goToMyLocation = () => {
    if (location && mapRef.current) {
      const region = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      mapRef.current.animateToRegion(region, 1000);
    } else {
      Alert.alert("无法定位", "无法获取您当前的位置信息。");
    }
  };

  // 处理从抽屉中选择停车位的事件
  const handleSpotSelectFromDrawer = (spot: ParkingSpot) => {
    bottomSheetRef.current?.close(); 
    const [latitude, longitude] = spot.coordinates.split(',').map(Number);
    if (mapRef.current) {
      const region: Region = {
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      mapRef.current.animateToRegion(region, 1000); 
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>正在加载停车位数据...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.retryText} onPress={fetchParkingSpots}>
          点击重试
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={getInitialRegion()}
        showsUserLocation={true}
        showsMyLocationButton={false}
      >
        {parkingSpots.map((spot: ParkingSpot) => {
          const coords = spot.coordinates.split(',');
          const latitude = parseFloat(coords[0]);
          const longitude = parseFloat(coords[1]);
          
          return (
            <Marker
              key={spot.id}
              coordinate={{ latitude, longitude }}
              title={spot.location}
              description={`¥${spot.hourly_rate}/小时`}
              pinColor={spot.status === 'available' ? 'green' : 'red'}
            >
              <Callout onPress={() => handleCalloutPress(spot)}>
                <View style={styles.calloutContainer}>
                  <Text style={styles.calloutTitle}>{spot.location}</Text>
                  <Text style={styles.calloutPrice}>¥{spot.hourly_rate}/小时</Text>
                  <Text style={styles.calloutStatus}>
                    状态: {spot.status === 'available' ? '可用' : '已占用'}
                  </Text>
                  <Text style={{color: '#007AFF', marginTop: 8}}>点击查看详情</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      {/* 自定义悬浮按钮容器 */}
      <View style={styles.floatingButtonsContainer}>
        {/* 停车状态按钮 */}
        {hasActiveUsage && (
          <TouchableOpacity style={[styles.iconButton, styles.parkingActiveButton]} onPress={showUsageAlert}>
            <Ionicons name="car" size={32} color="white" />
          </TouchableOpacity>
        )}
        
        {/* 打开抽屉的按钮 */}
        <TouchableOpacity style={styles.iconButton} onPress={() => bottomSheetRef.current?.snapToIndex(0)}>
          <Ionicons name="menu" size={32} color="black" />
        </TouchableOpacity>

        {/* 定位按钮 */}
        <TouchableOpacity style={styles.iconButton} onPress={goToMyLocation}>
          <Ionicons name="locate-outline" size={32} color="black" />
        </TouchableOpacity>
      </View>

      {/* 抽屉组件 */}
      <ParkingListDrawer
        ref={bottomSheetRef}
        onSpotSelect={handleSpotSelectFromDrawer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  errorText: {
    fontSize: 16,
    color: '#ff3b30',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryText: {
    fontSize: 16,
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  calloutContainer: {
    width: 200,
    padding: 10,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  calloutPrice: {
    fontSize: 12,
    color: '#007AFF',
    marginBottom: 3,
  },
  calloutStatus: {
    fontSize: 12,
    color: '#666',
  },
  floatingButtonsContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    flexDirection: 'column',
    alignItems: 'center',
  },
  iconButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 8,
    borderRadius: 25,
    marginBottom: 15, // 按钮之间的间距
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  parkingActiveButton: {
    backgroundColor: '#007AFF',
  },
});
