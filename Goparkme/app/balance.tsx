import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { userAPI, paymentAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useProtectedRoute } from '../hooks/useProtectedRoute';
import AuthModal from '../components/AuthModal';

export default function BalanceScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isLoading: authLoading, showAuthModal, setShowAuthModal } = useProtectedRoute();
  const [balance, setBalance] = useState(0);
  const [giftBalance, setGiftBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  type Transaction = {
    id: number;
    type: 'top_up' | 'parking_payment' | 'parking_income' | string;
    amount: number; // 正为入账，负为支出
    status: 'succeeded' | 'failed' | 'pending' | string;
    payment_intent_id?: string | null;
    error_message?: string | null;
    created_at?: string;
  };
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchBalanceData();
    }
  }, [user, authLoading]);

  // 页面聚焦时重新获取数据
  useFocusEffect(
    React.useCallback(() => {
      if (!authLoading && user) {
        fetchBalanceData();
      }
    }, [user, authLoading])
  );

  const fetchBalanceData = async () => {
    if (!user) return;

    try {
      const [balanceData, giftBalanceData, txList] = await Promise.all([
        userAPI.getUserBalance(),
        userAPI.getUserGiftBalance(),
        paymentAPI.getTransactions(),
      ]);
      
      setBalance(balanceData.balance || 0);
      setGiftBalance(giftBalanceData.gift_balance || 0);
      setTransactions(Array.isArray(txList) ? txList : []);
    } catch (error) {
      console.error('获取余额信息失败:', error);
      Alert.alert('错误', '获取余额信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchBalanceData();
    setRefreshing(false);
  };

  const handleTopUp = () => {
    router.push('/top-up' as any);
  };

  const handleWithdraw = () => {
    Alert.alert('提现功能', '提现功能正在开发中...');
  };

  if (authLoading || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  const totalBalance = balance + giftBalance;

  return (
    <View style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <Text style={styles.title}>账户余额</Text>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* 余额卡片 */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Ionicons name="wallet" size={32} color="#007AFF" />
            <Text style={styles.balanceTitle}>总余额</Text>
          </View>
          <Text style={styles.totalAmount}>¥{totalBalance.toFixed(2)}</Text>
          
          <View style={styles.balanceDetails}>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceLabel}>账户余额</Text>
              <Text style={styles.balanceValue}>¥{balance.toFixed(2)}</Text>
            </View>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceLabel}>赠送余额</Text>
              <Text style={styles.balanceValue}>¥{giftBalance.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* 操作按钮 */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={handleTopUp}>
            <Ionicons name="add-circle" size={24} color="#007AFF" />
            <Text style={styles.actionButtonText}>充值</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleWithdraw}>
            <Ionicons name="remove-circle" size={24} color="#ff3b30" />
            <Text style={styles.actionButtonText}>提现</Text>
          </TouchableOpacity>
        </View>

        {/* 交易记录 */}
        <View style={styles.transactionSection}>
          <Text style={styles.sectionTitle}>交易记录</Text>
          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>暂无交易记录</Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {transactions.map((tx) => {
                const isIncome = (tx.amount || 0) > 0;
                const amountColor = isIncome ? '#28a745' : '#ff3b30';
                const amountPrefix = isIncome ? '+' : '';
                const statusIcon = tx.status === 'succeeded' ? 'checkmark-circle' : (tx.status === 'pending' ? 'time' : 'alert-circle');
                const statusColor = tx.status === 'succeeded' ? '#28a745' : (tx.status === 'pending' ? '#ff9500' : '#ff3b30');

                let title = '交易';
                let subtitle: string[] = [];
                switch (tx.type) {
                  case 'top_up':
                    title = '余额充值';
                    if (tx.payment_intent_id) subtitle.push(`Intent: ${tx.payment_intent_id}`);
                    break;
                  case 'parking_payment':
                    title = '停车扣费';
                    break;
                  case 'parking_income':
                    title = '停车收入';
                    break;
                  default:
                    title = '其他';
                }
                subtitle.push(`状态: ${tx.status === 'succeeded' ? '成功' : (tx.status === 'pending' ? '处理中' : '失败')}`);
                if (tx.error_message && tx.status !== 'succeeded') {
                  subtitle.push(`原因: ${tx.error_message}`);
                }

                return (
                  <View key={tx.id} style={styles.txItem}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                      <Ionicons name={statusIcon as any} size={20} color={statusColor} />
                      <Text style={styles.txTitle}>{title}</Text>
                      <View style={styles.txBadge}>
                        <Text style={styles.txBadgeText}>{isIncome ? '入账' : '支出'}</Text>
                      </View>
                    </View>

                    <Text style={[styles.txAmount, { color: amountColor }]}>
                      {amountPrefix}¥{Number(tx.amount || 0).toFixed(2)}
                    </Text>

                    <View style={styles.txMetaRow}>
                      <Ionicons name="calendar-outline" size={14} color="#999" />
                      <Text style={styles.txTime}>{tx.created_at ? new Date(tx.created_at + 'Z').toLocaleString() : ''}</Text>
                    </View>

                    {subtitle.length > 0 && (
                      <View style={{ marginTop: 6 }}>
                        {subtitle.map((line, idx) => (
                          <Text key={idx} style={styles.txSubtitle}>{line}</Text>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* 登录弹窗 */}
      <AuthModal
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          fetchBalanceData();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  balanceCard: {
    backgroundColor: 'white',
    margin: 16,
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
  },
  totalAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#007AFF',
    textAlign: 'center',
    marginBottom: 24,
  },
  balanceDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  balanceItem: {
    flex: 1,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  actionButtons: {
    flexDirection: 'row',
    margin: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
  },
  transactionSection: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  txItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  txTitle: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  txBadge: {
    marginLeft: 8,
    backgroundColor: '#f0f4ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  txBadgeText: {
    fontSize: 10,
    color: '#3355ff',
  },
  txAmount: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  txMetaRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  txTime: {
    marginTop: 2,
    fontSize: 12,
    color: '#888',
  },
  txSubtitle: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  emptyState: {
    backgroundColor: 'white',
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
}); 