import React, { useState, useEffect, useMemo, forwardRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, useWindowDimensions } from 'react-native';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { parkingAPI } from '../services/api'; // 确保路径正确
import { ParkingSpot } from '../types'; // 引入共享的类型
import { useLocation, getDistanceFromLatLonInKm } from '../contexts/LocationContext';

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

    return (
      <TouchableOpacity style={styles.itemContainer} onPress={() => onSpotSelect(item)}>
        <View style={styles.itemTextContainer}>
          <Text style={styles.itemLocation}>{item.location}</Text>
          <Text style={styles.itemPrice}>¥{item.hourly_rate}/小时</Text>
          {distance !== null && (
            <Text style={styles.itemDistance}>
              距离: {distance.toFixed(2)} km
            </Text>
          )}
        </View>
        <View style={[styles.statusIndicator, { backgroundColor: item.status === 'available' ? '#28a745' : '#dc3545' }]} />
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
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemTextContainer: {
    flex: 1,
  },
  itemLocation: {
    fontSize: 16,
    fontWeight: '500',
  },
  itemPrice: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  itemDistance: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: 15,
  },
});

export default ParkingListDrawer; 