import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Define a type for a single reservation
type Reservation = {
  location: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  total_amount: number;
};

type Props = {
  reservations: Reservation[];
  onSeeAll: () => void;
};

export default function RecentReservations({ reservations, onSeeAll }: Props) {
  if (reservations.length === 0) {
    return null;
  }

  return (
    <View style={styles.recentSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>最近预约</Text>
        <TouchableOpacity onPress={onSeeAll}>
          <Text style={styles.seeAllText}>查看全部</Text>
        </TouchableOpacity>
      </View>
      {reservations.map((reservation, index) => (
        <View key={index} style={styles.reservationItem}>
          <View style={styles.reservationIcon}>
            <Ionicons name="car" size={20} color="#007AFF" />
          </View>
          <View style={styles.reservationInfo}>
            <Text style={styles.reservationLocation}>{reservation.location}</Text>
            <Text style={styles.reservationTime}>
              {reservation.reservation_date} {reservation.start_time.substring(0, 5)} - {reservation.end_time.substring(0, 5)}
            </Text>
          </View>
          <Text style={styles.reservationAmount}>¥{reservation.total_amount}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  recentSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  seeAllText: {
    fontSize: 14,
    color: '#007AFF',
  },
  reservationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  reservationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e9f3ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  reservationInfo: {
    flex: 1,
  },
  reservationLocation: {
    fontSize: 16,
    fontWeight: '500',
  },
  reservationTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  reservationAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
}); 