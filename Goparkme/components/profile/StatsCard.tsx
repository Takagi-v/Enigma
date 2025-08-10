import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

type Props = {
  balance: number;
  couponBalance: number;
  reservationsCount: number;
  isLoading: boolean;
};

export default function StatsCard({ balance, couponBalance, reservationsCount, isLoading }: Props) {
  const router = useRouter();

  return (
    <View style={styles.statsCard}>
      <View style={styles.statsHeader}>
        <Text style={styles.statsTitle}>我的数据</Text>
        {isLoading && <ActivityIndicator size="small" color="#007AFF" />}
      </View>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>${balance.toFixed(2)}</Text>
          <Text style={styles.statLabel}>账户余额</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{reservationsCount}</Text>
          <Text style={styles.statLabel}>最近预约</Text>
        </View>
        <TouchableOpacity style={styles.statItem} onPress={() => router.push('/coupons' as any)}>
          <Text style={styles.statValue}>${couponBalance.toFixed(2)}</Text>
          <Text style={styles.statLabel}>优惠券</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statsCard: {
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
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
}); 