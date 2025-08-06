import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, List, Switch } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';

import { RootState, AppDispatch } from '../../store';
import { updateUserPreferences, updateScannerConfig } from '../../store/slices/appSlice';

const SettingsScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { userPreferences, scannerConfig } = useSelector((state: RootState) => state.app);

  const toggleVibration = () => {
    dispatch(updateUserPreferences({ vibration_enabled: !userPreferences.vibration_enabled }));
    dispatch(updateScannerConfig({ vibrationEnabled: !userPreferences.vibration_enabled }));
  };

  const toggleSound = () => {
    dispatch(updateUserPreferences({ sound_enabled: !userPreferences.sound_enabled }));
    dispatch(updateScannerConfig({ soundEnabled: !userPreferences.sound_enabled }));
  };

  return (
    <View style={styles.container}>
      <ScrollView>
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Scanner Settings</Text>
            
            <List.Item
              title="Vibration Feedback"
              description="Vibrate when scanning barcodes"
              right={() => (
                <Switch
                  value={userPreferences.vibration_enabled}
                  onValueChange={toggleVibration}
                />
              )}
            />
            
            <List.Item
              title="Sound Feedback"
              description="Play sound when scanning barcodes"
              right={() => (
                <Switch
                  value={userPreferences.sound_enabled}
                  onValueChange={toggleSound}
                />
              )}
            />
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>App Information</Text>
            <Text style={styles.infoText}>Version: 1.0.0</Text>
            <Text style={styles.infoText}>Build: Development</Text>
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  card: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
});

export default SettingsScreen;