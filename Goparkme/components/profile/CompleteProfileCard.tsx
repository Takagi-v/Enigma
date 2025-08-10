import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  onPress: () => void;
};

export default function CompleteProfileCard({ onPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <Ionicons name="rocket-outline" size={32} color="#fff" style={styles.icon} />
      <View style={styles.textContainer}>
        <Text style={styles.title}>开启您的智能停车之旅！</Text>
        <Text style={styles.subtitle}>完善您的座驾信息，体验更流畅的预定和停车服务。</Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#fff" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  icon: {
    marginRight: 15,
  },
  textContainer: {
    flex: 1,
    marginRight: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#e0e0e0',
    lineHeight: 18,
  },
}); 