import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Button, ProgressBar, List } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';

import { RootState, AppDispatch } from '../../store';
import { forceSyncNow } from '../../store/slices/syncSlice';
import { formatDateTime } from '../../../../shared/utils/helpers';

const SyncStatusScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { 
    isOnline, 
    isSyncing, 
    lastSyncTime, 
    pendingItems, 
    syncProgress,
    syncHistory 
  } = useSelector((state: RootState) => state.sync);

  const handleForcSync = () => {
    dispatch(forceSyncNow());
  };

  return (
    <View style={styles.container}>
      <ScrollView>
        {/* Status Card */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Sync Status</Text>
            
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Connection:</Text>
              <Text style={[styles.statusValue, { color: isOnline ? '#4caf50' : '#f44336' }]}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Pending Items:</Text>
              <Text style={styles.statusValue}>{pendingItems}</Text>
            </View>
            
            {lastSyncTime && (
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Last Sync:</Text>
                <Text style={styles.statusValue}>{formatDateTime(lastSyncTime)}</Text>
              </View>
            )}
            
            {isSyncing && (
              <View style={styles.progressContainer}>
                <Text style={styles.progressText}>Syncing... {syncProgress}%</Text>
                <ProgressBar progress={syncProgress / 100} style={styles.progressBar} />
              </View>
            )}
            
            <Button
              mode="contained"
              onPress={handleForcSync}
              disabled={!isOnline || isSyncing}
              loading={isSyncing}
              style={styles.syncButton}
            >
              Sync Now
            </Button>
          </Card.Content>
        </Card>

        {/* Sync History */}
        {syncHistory.length > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Recent Sync History</Text>
              
              {syncHistory.slice(0, 10).map((entry, index) => (
                <List.Item
                  key={index}
                  title={`${entry.itemCount} items`}
                  description={formatDateTime(entry.timestamp)}
                  left={(props) => (
                    <List.Icon 
                      {...props} 
                      icon={entry.success ? "check-circle" : "alert-circle"}
                      color={entry.success ? "#4caf50" : "#f44336"}
                    />
                  )}
                  style={styles.historyItem}
                />
              ))}
            </Card.Content>
          </Card>
        )}
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
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666666',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  progressContainer: {
    marginVertical: 16,
  },
  progressText: {
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  progressBar: {
    height: 8,
  },
  syncButton: {
    marginTop: 16,
  },
  historyItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
});

export default SyncStatusScreen;