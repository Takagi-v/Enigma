import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { useProtectedRoute } from '../../hooks/useProtectedRoute';
import { useAuth } from '../../contexts/AuthContext';

export default function ProfileScreen() {
  useProtectedRoute();
  
  const { user, onLogout } = useAuth();

  if (!user) {
    return (
      <View style={styles.container}>
        <Text>正在加载个人信息...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>个人中心</Text>
      <Text style={styles.text}>欢迎, {user.username || '用户'}!</Text>
      <Text style={styles.text}>Email: {user.email}</Text>
      
      <View style={styles.buttonContainer}>
        <Button title="登出" onPress={onLogout} color="#ff3b30" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f7',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  text: {
    fontSize: 18,
    marginBottom: 10,
  },
  buttonContainer: {
    marginTop: 30,
    width: '80%',
  }
}); 