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
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [isFetchingStatus, setIsFetchingStatus] = useState(true);
  const [isFirstTopUp, setIsFirstTopUp] = useState(false);
  const [hasReceivedGift, setHasReceivedGift] = useState(false);


  const fetchStatus = useCallback(async () => {
    try {
      setIsFetchingStatus(true);
      
      // 并行获取支付方式和奖励状态
      const [paymentMethodRes, giftStatusRes] = await Promise.all([
        paymentAPI.getPaymentMethod(),
        paymentAPI.getGiftStatus(),
      ]);

      if (paymentMethodRes.paymentMethod) {
        setPaymentMethod({
          brand: paymentMethodRes.paymentMethod.card.brand,
          last4: paymentMethodRes.paymentMethod.card.last4,
        });
        setPaymentMethodId(paymentMethodRes.paymentMethod.id);
      } else {
        setPaymentMethod(null);
        setPaymentMethodId(null);
      }
      
      // 根据后端返回的数据更新状态
      // `hasReceivedGift` 表示用户是否已通过任何方式（包括旧的逻辑）获得过赠金
      // `transactions` 是一个数组，如果为空，说明用户从未充值过
      setHasReceivedGift(giftStatusRes.hasReceivedGift);
      // 只有在用户从未有过充值记录，并且也从未领取过赠金的情况下，才认为是首次充值
      setIsFirstTopUp(giftStatusRes.transactions.length === 0 && !giftStatusRes.hasReceivedGift);

    } catch (error) {
      console.error('获取支付或奖励状态失败:', error);
      Alert.alert('错误', '无法获取您的账户信息，请稍后再试。');
      setPaymentMethod(null);
      setPaymentMethodId(null);
      setIsFirstTopUp(false);
      setHasReceivedGift(true); // 出错时保守处理，避免误发奖励
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
    console.log('--- 开始充值流程 ---');
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('提示', '请输入有效的充值金额');
      return;
    }
    
    // 根据是否首次充值，检查最低金额
    const minAmount = isFirstTopUp ? 10 : 20;
    if (amt < minAmount) {
      Alert.alert('提示', `充值金额不能低于 $${minAmount.toFixed(2)}`);
      return;
    }

    // 关键检查：确保 paymentMethodId 已加载
    if (!paymentMethodId) {
      Alert.alert('提示', '支付信息尚未加载完成，请稍后再试或重新进入页面。');
      console.log('错误：尝试充值时 paymentMethodId 为空。');
      return;
    }
    
    // 关键检查：确保 stripe 实例已加载
    if (!stripe) {
      Alert.alert('错误', '支付服务初始化失败，请重新进入页面。');
      console.log('错误：Stripe 实例未准备好。');
      return;
    }
    
    setLoading(true);
    try {
      console.log(`1. 准备创建支付意图，金额: ${amt}, 支付方式ID: ${paymentMethodId}, 是否首次充值: ${isFirstTopUp}`);
      // The backend uses the default payment method associated with the customer,
      // so we don't need to pass the payment method ID here.
      const intentRes = await paymentAPI.createTopUpIntent(amt, paymentMethodId, isFirstTopUp);

      if (!intentRes.clientSecret) {
        throw new Error(intentRes.error || '创建支付意图失败，无法获取 client_secret');
      }
      
      console.log('2. 成功获取 client_secret，准备调用 confirmPayment');

      // 关键：当PaymentIntent在后端已附加支付方式时，前端确认时理论上无需再提供
      // 我们只提供 client_secret，让Stripe处理后续流程（如3DS验证）
      // 传递一个最小化的参数以满足类型检查
      const { error } = await stripe.confirmPayment(intentRes.clientSecret);
      
      if (error) {
        console.error('3. confirmPayment 返回错误:', JSON.stringify(error, null, 2));
        if (error.code === 'Canceled') {
          Alert.alert('提示', '支付已取消');
        } else {
          // 提供更详细的错误信息
          Alert.alert('支付失败', `错误码: ${error.code}\n信息: ${error.message}`);
          throw new Error(`[${error.code}] ${error.message}`);
        }
      } else {
        console.log('3. confirmPayment 成功！');
        Alert.alert('成功', '充值成功', [
          { text: '确定', onPress: () => router.back() }
        ]);
        setAmount('');
      }
    } catch (err: any) {
      console.error('4. 充值流程捕获到未知错误:', err);
      // 避免重复弹窗
      if (!String(err.message).includes('支付失败')) {
        Alert.alert('错误', err.message || '充值过程中发生未知错误');
      }
    } finally {
      setLoading(false);
      console.log('--- 充值流程结束 ---');
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
              placeholder={isFirstTopUp ? '首次充值最低 $10.00，即可获赠 $5 奖励!' : '最低 $20.00'}
              keyboardType="numeric"
            />
          </View>
        )}

        {paymentMethod && (
          <TouchableOpacity
            style={[styles.actionButton, (loading || !paymentMethodId) && styles.disabledButton]}
            disabled={loading || !paymentMethodId}
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