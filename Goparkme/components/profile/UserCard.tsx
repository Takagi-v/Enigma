import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { User } from '../../contexts/AuthContext';

type Props = {
  user: User;
};

export default function UserCard({ user }: Props) {
  return (
    <View style={styles.userCard}>
      <View style={styles.avatar}>
        <Ionicons name="person" size={40} color="#007AFF" />
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.username}>{user.fullName || user.username || '用户'}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>
        {user.phone && (
          <Text style={styles.userPhone}>{user.phone}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e9f3ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  userPhone: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
}); 