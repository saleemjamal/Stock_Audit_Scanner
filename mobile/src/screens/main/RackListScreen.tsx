import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, List } from 'react-native-paper';
import { RouteProp } from '@react-navigation/native';

import { MainStackParamList } from '../../navigation/MainNavigator';

type RackListScreenRouteProp = RouteProp<MainStackParamList, 'RackList'>;

interface RackListScreenProps {
  route: RackListScreenRouteProp;
}

const RackListScreen: React.FC<RackListScreenProps> = ({ route }) => {
  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.title}>My Racks</Text>
          <Text style={styles.subtitle}>Implementation in progress...</Text>
        </Card.Content>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  card: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
  },
});

export default RackListScreen;