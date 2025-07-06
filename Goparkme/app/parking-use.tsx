import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, SafeAreaView, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { parkingAPI } from '../services/api';
import AuthModal from '../components/AuthModal';

interface ParkingSpot {
  id: number;
  location: string;
  hourly_rate: number;
  description: string;
  status: string;
  contact: string;
  opening_hours: string;
}

export default function ParkingUseScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { spotId } = useLocalSearchParams<{ spotId: string }>();
  
  const [spot, setSpot] = useState<ParkingSpot | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    const fetchSpotDetails = async () => {
      if (!spotId) return;
      
      try {
        setLoading(true);
        const spotData = await parkingAPI.getParkingSpotById(spotId);
        setSpot(spotData);
        
        // 设置用户的默认车牌号
        if (user.vehiclePlate) {
          setVehiclePlate(user.vehiclePlate);
        }
      } catch (err) {
        console.error('获取停车位详情失败:', err);
        Alert.alert('错误', '无法加载停车位详情', [
          { text: '返回', onPress: () => router.back() }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchSpotDetails();
  }, [spotId, user]);

  const handleStartParking = async () => {
    if (!spot || !vehiclePlate.trim()) {
      Alert.alert('提示', '请输入车牌号');
      return;
    }

    if (spot.status !== 'available') {
      Alert.alert('提示', '该停车位当前不可用');
      return;
    }

    try {
      setStarting(true);
      await parkingAPI.startParking(spot.id.toString(), vehiclePlate.trim());
      
      Alert.alert('成功', '开始使用停车位', [
        { 
          text: '确定', 
          onPress: () => {
            // 跳转到计时页面
            router.replace('/parking-timer' as any);
          }
        }
      ]);
    } catch (error: any) {
      console.error('开始使用停车位失败:', error);
      let errorMessage = '开始使用失败，请重试';
      
      if (error.message.includes('停车位不可用')) {
        errorMessage = '该停车位当前不可用';
      } else if (error.message.includes('已有正在使用的停车位')) {
        errorMessage = '您已有正在使用的停车位';
      }
      
      Alert.alert('错误', errorMessage);
    } finally {
      setStarting(false);
    }
  };

  if (!user && showAuthModal) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.authContainer}>
          <Ionicons name="car" size={60} color="#007AFF" />
          <Text style={styles.authTitle}>请先登录</Text>
          <Text style={styles.authSubtitle}>登录后即可使用停车位</Text>
          
          <AuthModal
            visible={showAuthModal}
            onClose={() => {
              setShowAuthModal(false);
              router.back();
            }}
            onSuccess={() => {
              setShowAuthModal(false);
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!spot) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={60} color="#ff3b30" />
          <Text style={styles.errorTitle}>未找到停车位</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>返回</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>立即使用</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        {/* 停车位信息 */}
        <View style={styles.spotCard}>
          <View style={styles.spotHeader}>
            <Ionicons name="location" size={24} color="#007AFF" />
            <Text style={styles.spotLocation}>{spot.location}</Text>
          </View>
          
          <View style={styles.spotDetails}>
            <View style={styles.detailItem}>
              <Ionicons name="time" size={20} color="#666" />
              <Text style={styles.detailText}>¥{spot.hourly_rate}/小时</Text>
            </View>
            
            <View style={styles.detailItem}>
              <Ionicons name="time-outline" size={20} color="#666" />
              <Text style={styles.detailText}>{spot.opening_hours}</Text>
            </View>
            
            <View style={styles.detailItem}>
              <Ionicons name="call" size={20} color="#666" />
              <Text style={styles.detailText}>{spot.contact}</Text>
            </View>
          </View>

          {spot.description && (
            <View style={styles.description}>
              <Text style={styles.descriptionText}>{spot.description}</Text>
            </View>
          )}
        </View>

        {/* 车牌号输入 */}
        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>车牌号</Text>
          <TextInput
            style={styles.input}
            value={vehiclePlate}
            onChangeText={setVehiclePlate}
            placeholder="请输入车牌号"
            placeholderTextColor="#999"
            autoCapitalize="characters"
            maxLength={10}
          />
          <Text style={styles.inputHint}>请确保车牌号输入正确</Text>
        </View>

        {/* 费用说明 */}
        <View style={styles.feeCard}>
          <View style={styles.feeHeader}>
            <Ionicons name="card" size={20} color="#007AFF" />
            <Text style={styles.feeTitle}>费用说明</Text>
          </View>
          <Text style={styles.feeText}>• 按小时计费，不足一小时按一小时计算</Text>
          <Text style={styles.feeText}>• 费用将在结束使用时从账户余额中扣除</Text>
          <Text style={styles.feeText}>• 请确保账户余额充足</Text>
        </View>

        {/* 开始使用按钮 */}
        <TouchableOpacity
          style={[styles.startButton, starting && styles.startButtonDisabled]}
          onPress={handleStartParking}
          disabled={starting || spot.status !== 'available'}
        >
          {starting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Ionicons name="play" size={20} color="white" />
              <Text style={styles.startButtonText}>开始使用</Text>
            </>
          )}
        </TouchableOpacity>

        {/* 状态提示 */}
        {spot.status !== 'available' && (
          <View style={styles.statusWarning}>
            <Ionicons name="warning" size={20} color="#ff9500" />
            <Text style={styles.statusWarningText}>
              该停车位当前{spot.status === 'occupied' ? '使用中' : '已预定'}，暂时不可用
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerBackButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  spotCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  spotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  spotLocation: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  spotDetails: {
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
  },
  description: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  descriptionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  inputCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: 'white',
  },
  inputHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  feeCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  feeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  feeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  feeText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    lineHeight: 20,
  },
  startButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  startButtonDisabled: {
    backgroundColor: '#ccc',
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  statusWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  statusWarningText: {
    fontSize: 14,
    color: '#856404',
    marginLeft: 8,
    flex: 1,
  },
}); 