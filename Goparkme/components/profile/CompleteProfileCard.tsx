import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  onPress: () => void;
};

export default function CompleteProfileCard({ onPress }: Props) {
  return (
    <View style={styles.card}>
      <Ionicons name="information-circle-outline" size={32} color="#007AFF" style={styles.icon} />
      <View style={styles.textContainer}>
        <Text style={styles.title}>完善您的个人资料</Text>
        <Text style={styles.subtitle}>添加车辆信息等，以便获得更好的停车体验。</Text>
      </View>
      <TouchableOpacity onPress={onPress}>
        <Ionicons name="chevron-forward" size={24} color="#007AFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#e9f3ff',
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  icon: {
    marginRight: 15,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 13,
    color: '#555',
    marginTop: 2,
  },
}); 