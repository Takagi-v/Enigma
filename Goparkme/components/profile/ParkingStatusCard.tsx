import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// This type should be defined based on your actual data structure
type Usage = {
  location: string;
  vehicle_plate: string;
};

type Props = {
  currentUsage: Usage;
  goToTimer: () => void;
};

export default function ParkingStatusCard({ currentUsage, goToTimer }: Props) {
  return (
    <View style={styles.parkingStatusCard}>
      <View style={styles.parkingStatusHeader}>
        <View style={styles.parkingStatusIndicator}>
          <View style={styles.parkingStatusDot} />
          <Text style={styles.parkingStatusTitle}>正在使用停车位</Text>
        </View>
        <TouchableOpacity onPress={goToTimer}>
          <Ionicons name="chevron-forward" size={20} color="#007AFF" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.parkingStatusInfo}>
        <View style={styles.parkingStatusItem}>
          <Ionicons name="location" size={16} color="#666" />
          <Text style={styles.parkingStatusText}>{currentUsage.location}</Text>
        </View>
        <View style={styles.parkingStatusItem}>
          <Ionicons name="car" size={16} color="#666" />
          <Text style={styles.parkingStatusText}>{currentUsage.vehicle_plate}</Text>
        </View>
      </View>
      
      <TouchableOpacity style={styles.parkingStatusButton} onPress={goToTimer}>
        <Text style={styles.parkingStatusButtonText}>查看详情</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  parkingStatusCard: {
    backgroundColor: '#e9f3ff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  parkingStatusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  parkingStatusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  parkingStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34C759', // Green dot for active
    marginRight: 8,
  },
  parkingStatusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  parkingStatusInfo: {
    marginBottom: 15,
  },
  parkingStatusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  parkingStatusText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  parkingStatusButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  parkingStatusButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 