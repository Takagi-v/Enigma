import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { userAPI } from '../services/api';

interface Coupon {
  id: number;
  type: string;
  amount: number;
  status: 'valid' | 'used' | 'expired';
  expiry_date: string | null;
  description: string;
  created_at: string;
}

export default function CouponsScreen() {
  const router = useRouter();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      const fetchCoupons = async () => {
        try {
          setLoading(true);
          const data = await userAPI.getUserCoupons();
          setCoupons(data || []);
        } catch (error) {
          console.error('获取优惠券失败:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchCoupons();
    }, [])
  );

  const renderCoupon = (coupon: Coupon) => {
    const isExpired = coupon.expiry_date && new Date(coupon.expiry_date) < new Date();
    const status = coupon.status !== 'valid' ? coupon.status : (isExpired ? 'expired' : 'valid');
    const statusText = {
      valid: '有效',
      used: '已使用',
      expired: '已过期',
    };
    const statusColor = {
      valid: '#28a745',
      used: '#6c757d',
      expired: '#dc3545',
    };

    return (
      <View key={coupon.id} style={[styles.couponCard, status !== 'valid' && styles.usedCoupon]}>
        <View style={styles.couponLeft}>
          <Text style={styles.couponAmount}>${coupon.amount.toFixed(2)}</Text>
          <Text style={styles.couponDescription}>{coupon.description}</Text>
        </View>
        <View style={styles.couponRight}>
          <Text style={[styles.couponStatus, { color: statusColor[status] }]}>
            {statusText[status]}
          </Text>
          {coupon.expiry_date && (
            <Text style={styles.couponExpiry}>
              过期时间: {new Date(coupon.expiry_date).toLocaleDateString()}
            </Text>
          )}
        </View>
      </View>
    );
  };

  const validCoupons = coupons.filter(c => c.status === 'valid' && (!c.expiry_date || new Date(c.expiry_date) >= new Date()));
  const invalidCoupons = coupons.filter(c => c.status !== 'valid' || (c.expiry_date && new Date(c.expiry_date) < new Date()));

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: '我的优惠券' }} />
      
      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" style={{ flex: 1 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
          <Text style={styles.sectionTitle}>未使用 ({validCoupons.length})</Text>
          {validCoupons.length > 0 ? (
            validCoupons.map(renderCoupon)
          ) : (
            <Text style={styles.emptyText}>暂无可用优惠券</Text>
          )}

          <Text style={styles.sectionTitle}>已失效 ({invalidCoupons.length})</Text>
          {invalidCoupons.length > 0 ? (
            invalidCoupons.map(renderCoupon)
          ) : (
            <Text style={styles.emptyText}>没有已失效的优惠券</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  scrollContainer: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 10,
    backgroundColor: '#f5f5f7',
  },
  backButton: {
    // No specific styles needed now, just for touch area
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1c1c1e',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  couponCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeftWidth: 5,
    borderLeftColor: '#007AFF', // Blue for valid
  },
  usedCoupon: {
    borderLeftColor: '#6c757d', // Gray for used/expired
    opacity: 0.7,
  },
  couponLeft: {
    flex: 1,
  },
  couponRight: {
    alignItems: 'flex-end',
  },
  couponAmount: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1c1c1e',
  },
  couponDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  couponStatus: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  couponExpiry: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 20,
    marginBottom: 20,
  },
}); 