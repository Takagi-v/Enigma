import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { parkingAPI } from '../services/api';

interface LockStatusProps {
  spotId: number;
  refreshInterval?: number;
}

interface LockStatus {
  success: boolean;
  spot_status: string;
  current_user_id?: number;
  lock_status?: {
    car_detected: boolean;
    lock_position: string;
    device_online: boolean;
    last_heartbeat?: string;
    battery_level?: number;
    signal_strength?: number;
    error_code?: number;
    error_descriptions?: string[];
  };
}

export default function LockStatusCard({ spotId, refreshInterval = 15000 }: LockStatusProps) {
  const [lockStatus, setLockStatus] = useState<LockStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchLockStatus = async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      
      const response = await parkingAPI.getLockStatus(spotId);
      setLockStatus(response);
      setLastUpdate(new Date());
    } catch (err: any) {
      console.error('获取地锁状态失败:', err);
      setError(err.message || '获取地锁状态失败');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchLockStatus(true);
    
    // 设置定时刷新
    const interval = setInterval(() => {
      fetchLockStatus(false);
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [spotId, refreshInterval]);

  const getStatusColor = () => {
    if (!lockStatus?.success || error) return '#ff3b30'; // 红色 - 错误
    if (!lockStatus.lock_status?.device_online) return '#ff9500'; // 橙色 - 离线
    return '#34c759'; // 绿色 - 正常
  };

  const getStatusText = () => {
    if (error) return '连接失败';
    if (!lockStatus?.success) return '地锁未配置';
    if (!lockStatus.lock_status?.device_online) return '设备离线';
    return '设备在线';
  };

  const getCarDetectionText = () => {
    if (!lockStatus?.lock_status) return '未知';
    return lockStatus.lock_status.car_detected ? '检测到车辆' : '无车辆';
  };

  const getLockPositionText = () => {
    if (!lockStatus?.lock_status) return '未知';
    const position = lockStatus.lock_status.lock_position;
    if (position.includes('上升') || position.includes('升起')) return '已升起';
    if (position.includes('下降') || position.includes('降下')) return '已降下';
    return position;
  };

  const formatLastUpdate = () => {
    if (!lastUpdate) return '';
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - lastUpdate.getTime()) / 1000);
    
    if (diffSeconds < 60) return `${diffSeconds}秒前更新`;
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}分钟前更新`;
    return lastUpdate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="hardware-chip" size={20} color="#007AFF" />
          <Text style={styles.title}>地锁状态</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.loadingText}>获取状态中...</Text>
        </View>
      </View>
    );
  }

  // 如果没有地锁配置，不显示该卡片
  if (!lockStatus?.success && !error) {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="hardware-chip" size={20} color="#007AFF" />
        <Text style={styles.title}>地锁状态</Text>
        <TouchableOpacity onPress={() => fetchLockStatus(true)} style={styles.refreshButton}>
          <Ionicons name="refresh" size={16} color="#666" />
        </TouchableOpacity>
      </View>

      <View style={styles.statusRow}>
        <View style={styles.statusItem}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>
        {lastUpdate && (
          <Text style={styles.updateTime}>{formatLastUpdate()}</Text>
        )}
      </View>

      {lockStatus?.success && lockStatus.lock_status && (
        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Ionicons name="car" size={16} color="#666" />
              <Text style={styles.detailLabel}>车辆检测</Text>
              <Text style={[
                styles.detailValue,
                { color: lockStatus.lock_status.car_detected ? '#34c759' : '#666' }
              ]}>
                {getCarDetectionText()}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Ionicons 
                name={getLockPositionText().includes('升起') ? "chevron-up" : "chevron-down"} 
                size={16} 
                color="#666" 
              />
              <Text style={styles.detailLabel}>地锁位置</Text>
              <Text style={styles.detailValue}>{getLockPositionText()}</Text>
            </View>
          </View>

          {/* 电量和信号显示 */}
          {(lockStatus.lock_status.battery_level || lockStatus.lock_status.signal_strength) && (
            <View style={styles.detailRow}>
              <View style={styles.batterySignalRow}>
                {lockStatus.lock_status.battery_level && (
                  <View style={styles.batteryItem}>
                    <Ionicons 
                      name="battery-half" 
                      size={16} 
                      color={lockStatus.lock_status.battery_level > 3.5 ? '#34c759' : '#ff9500'} 
                    />
                    <Text style={styles.batteryText}>
                      {lockStatus.lock_status.battery_level}V
                    </Text>
                  </View>
                )}
                {lockStatus.lock_status.signal_strength && (
                  <View style={styles.signalItem}>
                    <Ionicons 
                      name="cellular" 
                      size={16} 
                      color={lockStatus.lock_status.signal_strength > 70 ? '#34c759' : lockStatus.lock_status.signal_strength > 40 ? '#ff9500' : '#ff3b30'} 
                    />
                    <Text style={styles.signalText}>
                      {lockStatus.lock_status.signal_strength}%
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* 错误信息 */}
          {lockStatus.lock_status.error_code > 0 && lockStatus.lock_status.error_descriptions && lockStatus.lock_status.error_descriptions.length > 0 && (
            <View style={styles.errorRow}>
              <Ionicons name="warning" size={14} color="#ff3b30" />
              <Text style={styles.errorText}>
                {lockStatus.lock_status.error_descriptions.join(', ')}
              </Text>
            </View>
          )}

          {/* 心跳显示 */}
          {lockStatus.lock_status.last_heartbeat && (
            <View style={styles.heartbeatRow}>
              <Ionicons name="heart" size={14} color="#ff3b30" />
              <Text style={styles.heartbeatText}>
                最后心跳: {new Date(lockStatus.lock_status.last_heartbeat).toLocaleTimeString('zh-CN')}
              </Text>
            </View>
          )}
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={16} color="#ff3b30" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
    color: '#333',
  },
  refreshButton: {
    padding: 4,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  loadingText: {
    marginLeft: 8,
    color: '#666',
    fontSize: 14,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  updateTime: {
    fontSize: 12,
    color: '#999',
  },
  detailsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  detailRow: {
    marginBottom: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
    width: 80,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  heartbeatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f8f8f8',
  },
  heartbeatText: {
    fontSize: 12,
    color: '#999',
    marginLeft: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3f3',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ffebee',
  },
  errorText: {
    fontSize: 12,
    color: '#ff3b30',
    marginLeft: 6,
    flex: 1,
  },
  batterySignalRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
  },
  batteryItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  batteryText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  signalItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signalText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3f3',
    padding: 6,
    borderRadius: 4,
    marginTop: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#ff3b30',
  },
});