import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
// @ts-ignore
import { StripeProvider, CardField, useStripe, CardFieldInput } from '@stripe/stripe-react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { paymentAPI } from '../services/api';

type CardDetails = CardFieldInput.Details;

function TopUpScreenContent() {
  const router = useRouter();
  const stripe = useStripe();
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [cardDetails, setCardDetails] = useState<CardDetails | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<{ brand: string; last4: string } | null>(null);
  const [isFetchingStatus, setIsFetchingStatus] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      setIsFetchingStatus(true);
      const status = await paymentAPI.getPaymentMethodStatus();
      if (status.hasPaymentMethod && status.card) {
        setPaymentMethod(status.card);
      } else {
        setPaymentMethod(null);
      }
    } catch (error) {
      console.error('获取支付方式状态失败:', error);
      Alert.alert('错误', '无法获取您的支付信息，请稍后再试。');
      setPaymentMethod(null);
    } finally {
      setIsFetchingStatus(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchStatus();
    }, [fetchStatus])
  );

  const handleSaveCard = async () => {
    if (!cardDetails?.complete) {
      Alert.alert('提示', '请完整输入卡片信息');
      return;
    }
    if (!stripe) return;

    setLoading(true);
    try {
      const { paymentMethod: newPaymentMethod, error } = await stripe.createPaymentMethod({
        paymentMethodType: 'Card',
      });

      if (error) {
        throw new Error(error.message);
      }
      
      const res = await paymentAPI.savePaymentMethod(newPaymentMethod.id);
      if (res.success) {
        Alert.alert('成功', '银行卡绑定成功');
        await fetchStatus(); // 重新获取状态以更新UI
      } else {
        throw new Error(res.error || '保存支付方式失败');
      }

    } catch (err: any) {
      console.error('保存卡片失败:', err);
      Alert.alert('错误', err.message || '保存卡片失败');
    } finally {
      setLoading(false);
    }
  };

  const handleTopUp = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('提示', '请输入有效的充值金额');
      return;
    }
    if (!paymentMethod) {
      Alert.alert('提示', '请先绑定银行卡');
      return;
    }
    if (!stripe) return;
    
    setLoading(true);
    try {
      // The backend uses the default payment method associated with the customer,
      // so we don't need to pass the payment method ID here.
      const intentRes = await paymentAPI.createTopUpIntent(amt);

      if (!intentRes.clientSecret) {
        throw new Error(intentRes.error || '创建支付失败');
      }

      const { error } = await stripe.confirmPayment(intentRes.clientSecret, {
        paymentMethodType: 'Card',
      });
      
      if (error) {
        if (error.code === 'Canceled') {
          Alert.alert('提示', '支付已取消');
        } else {
          throw new Error(error.message);
        }
      } else {
        Alert.alert('成功', '充值成功', [
          { text: '确定', onPress: () => router.back() }
        ]);
        setAmount('');
      }
    } catch (err: any) {
      console.error('充值失败:', err);
      Alert.alert('错误', err.message || '充值失败');
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (isFetchingStatus) {
      return <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 20 }}/>;
    }

    if (paymentMethod) {
      return (
        <>
          <View style={styles.boundCardContainer}>
            <Ionicons name="card" size={24} color="#007AFF" />
            <Text style={styles.boundText}>{`${paymentMethod.brand} **** ${paymentMethod.last4}`}</Text>
          </View>
        </>
      );
    }

    return (
      <View style={styles.cardFieldContainer}>
        <Text style={styles.label}>银行卡信息</Text>
        <CardField
          postalCodeEnabled={false}
          placeholders={{ number: '4242 4242 4242 4242' }}
          cardStyle={styles.cardInput}
          style={styles.cardField}
          onCardChange={(details) => setCardDetails(details)}
        />
        <TouchableOpacity
          style={[styles.actionButton, (!cardDetails?.complete || loading) && styles.disabledButton]}
          disabled={!cardDetails?.complete || loading}
          onPress={handleSaveCard}
        >
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.actionButtonText}>绑定银行卡</Text>}
        </TouchableOpacity>
      </View>
    );
  };
  
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
       <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>账户充值</Text>

        {renderContent()}

        {paymentMethod && (
           <View style={styles.amountContainer}>
            <Text style={styles.label}>充值金额 ($)</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="最低 $5.00"
              keyboardType="numeric"
            />
          </View>
        )}

        {paymentMethod && (
          <TouchableOpacity
            style={[styles.actionButton, loading && styles.disabledButton]}
            disabled={loading || !amount}
            onPress={handleTopUp}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.actionButtonText}>立即充值</Text>}
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default function TopUpScreen() {
    // Make sure to wrap your screen with `StripeProvider`
    return (
      <StripeProvider
        publishableKey={process.env.EXPO_PUBLIC_STRIPE_PK || ''}
      >
        <TopUpScreenContent />
      </StripeProvider>
    );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'flex-start',
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1c1c1e',
    marginBottom: 30,
  },
  label: {
    fontSize: 16,
    color: '#6c6c6e',
    marginBottom: 10,
  },
  cardFieldContainer: {
    marginBottom: 20,
  },
  cardInput: {
    backgroundColor: '#FFFFFF',
    // @ts-ignore
    textColor: '#000000',
    borderRadius: 8,
  },
  cardField: {
    height: 50,
    width: '100%',
    marginBottom: 20,
  },
  boundCardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 20,
    gap: 12,
  },
  boundText: {
    fontSize: 16,
    color: '#1c1c1e',
    fontWeight: '500',
  },
  amountContainer: {
    marginBottom: 20,
  },
  amountInput: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  actionButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
}); 