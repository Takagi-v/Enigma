import React, { useState, useEffect, useMemo, forwardRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, useWindowDimensions } from 'react-native';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { parkingAPI } from '../services/api'; // 确保路径正确
import { ParkingSpot } from '../types'; // 引入共享的类型
import { useLocation, getDistanceFromLatLonInKm } from '../contexts/LocationContext';
import { Ionicons } from '@expo/vector-icons';


interface ParkingListDrawerProps {
  onSpotSelect: (spot: ParkingSpot) => void;
}

const ParkingListDrawer = forwardRef<BottomSheet, ParkingListDrawerProps>(({ onSpotSelect }, ref) => {
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [loading, setLoading] = useState(false);
  const { height: windowHeight } = useWindowDimensions();
  const { location } = useLocation();

  const snapPoints = useMemo(() => [windowHeight * 0.4, windowHeight * 0.75], [windowHeight]);

  const topInset = useMemo(() => windowHeight * 0.25, [windowHeight]);

  const fetchSpots = async () => {
    setLoading(true);
    try {
      const response = await parkingAPI.getAllParkingSpots();
      if (response && response.spots) {
        setSpots(response.spots);
      }
    } catch (error) {
      console.error("Failed to fetch parking spots:", error);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchSpots();
  }, []);

  const sortedSpots = useMemo(() => {
    if (!location) return spots;

    return [...spots].sort((a, b) => {
      const coordsA = a.coordinates.split(',').map(Number);
      const coordsB = b.coordinates.split(',').map(Number);
      
      if (coordsA.length !== 2 || isNaN(coordsA[0]) || isNaN(coordsA[1])) return 1;
      if (coordsB.length !== 2 || isNaN(coordsB[0]) || isNaN(coordsB[1])) return -1;

      const distA = getDistanceFromLatLonInKm(location.coords.latitude, location.coords.longitude, coordsA[0], coordsA[1]);
      const distB = getDistanceFromLatLonInKm(location.coords.latitude, location.coords.longitude, coordsB[0], coordsB[1]);
      return distA - distB;
    });
  }, [spots, location]);

  const renderItem = ({ item }: { item: ParkingSpot }) => {
    let distance = null;
    if (location && item.coordinates) {
      const coords = item.coordinates.split(',').map(Number);
      if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
        distance = getDistanceFromLatLonInKm(
          location.coords.latitude,
          location.coords.longitude,
          coords[0],
          coords[1]
        );
      }
    }

    const statusText = item.status === 'available' ? '空闲' : '已占用';
    const statusColor = item.status === 'available' ? '#28a745' : '#dc3545';

    return (
      <TouchableOpacity style={styles.card} onPress={() => onSpotSelect(item)}>
        <View style={styles.cardHeader}>
          <Text style={styles.locationText}>{item.location}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Ionicons name="cash-outline" size={16} color="#666" style={styles.icon} />
            <Text style={styles.infoText}>¥{item.hourly_rate}/小时</Text>
          </View>
          {distance !== null && (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={16} color="#666" style={styles.icon} />
              <Text style={styles.infoText}>距离 {distance.toFixed(2)} km</Text>
            </View>
          )}
          <View style={styles.infoRow}>
             <Ionicons name="time-outline" size={16} color="#666" style={styles.icon} />
             <Text style={styles.infoText}>{item.opening_hours}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <BottomSheet
      ref={ref}
      index={-1} // -1 means the sheet is closed by default
      snapPoints={snapPoints}
      topInset={topInset}
      enablePanDownToClose={true}
      backgroundStyle={styles.drawerContainer}
      handleIndicatorStyle={styles.handleIndicator}
    >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>附近停车场</Text>
        </View>
        {loading ? (
          <ActivityIndicator size="large" style={{ marginTop: 20 }} />
        ) : (
          <BottomSheetFlatList
            data={sortedSpots}
            renderItem={renderItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
          />
        )}
    </BottomSheet>
  );
});

ParkingListDrawer.displayName = 'ParkingListDrawer';

const styles = StyleSheet.create({
  drawerContainer: {
    backgroundColor: '#f7f7f7',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -3,
    },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10,
  },
  handleIndicator: {
    backgroundColor: '#ccc',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationText: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1, 
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardBody: {
    // No specific styles needed here for now
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  icon: {
    marginRight: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#333',
  },
});

export default ParkingListDrawer; 