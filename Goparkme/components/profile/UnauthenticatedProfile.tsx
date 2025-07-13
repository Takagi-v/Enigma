import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  onLogin: () => void;
  onRegister: () => void;
};

export default function UnauthenticatedProfile({ onLogin, onRegister }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.unauthenticatedContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoSection}>
          <View style={styles.logo}>
            <Ionicons name="car" size={60} color="#007AFF" />
          </View>
          <Text style={styles.appName}>停车易</Text>
          <Text style={styles.welcomeText}>
            欢迎使用停车易！登录后享受更多功能
          </Text>
        </View>

        <View style={styles.featuresSection}>
          <Text style={styles.featuresTitle}>功能特色</Text>
          <View style={styles.featureItem}>
            <Ionicons name="location" size={20} color="#007AFF" />
            <Text style={styles.featureText}>智能找车位</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="time" size={20} color="#007AFF" />
            <Text style={styles.featureText}>在线预约</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="card" size={20} color="#007AFF" />
            <Text style={styles.featureText}>便捷支付</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="shield-checkmark" size={20} color="#007AFF" />
            <Text style={styles.featureText}>安全保障</Text>
          </View>
        </View>

        <View style={styles.authButtons}>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={onLogin}
          >
            <Text style={styles.loginButtonText}>登录</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.registerButton}
            onPress={onRegister}
          >
            <Text style={styles.registerButtonText}>注册</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.guestModeText}>
          或者继续以游客身份浏览停车位
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  unauthenticatedContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e9f3ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
  },
  welcomeText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  featuresSection: {
    width: '100%',
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 30,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  featureText: {
    fontSize: 16,
    marginLeft: 10,
  },
  authButtons: {
    width: '100%',
    marginBottom: 20,
  },
  loginButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  registerButton: {
    backgroundColor: '#fff',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  registerButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  guestModeText: {
    fontSize: 14,
    color: '#666',
  },
}); 