import React, { useEffect, useState } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  RefreshControl,
  Alert,
} from 'react-native';
import { 
  Text, 
  Card, 
  Button, 
  FAB,
  Chip,
  List,
  IconButton,
} from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { MainStackParamList } from '../../navigation/MainNavigator';
import { RootState, AppDispatch } from '../../store';
import { loadRackScans, clearCurrentRackScans } from '../../store/slices/scanSlice';
import { markRackReady } from '../../store/slices/rackSlice';
import { showSuccessMessage, showErrorMessage } from '../../store/slices/appSlice';
import ScannerInput from '../../components/ScannerInput';
import { useScanQueue } from '../../components/ScanQueueProvider';
import { formatDateTime } from '../../../../shared/utils/helpers';

type ScanningScreenRouteProp = RouteProp<MainStackParamList, 'Scanning'>;
type ScanningScreenNavigationProp = StackNavigationProp<MainStackParamList, 'Scanning'>;

interface ScanningScreenProps {
  route: ScanningScreenRouteProp;
  navigation: ScanningScreenNavigationProp;
}

const ScanningScreen: React.FC<ScanningScreenProps> = ({ route, navigation }) => {
  const { rack, location } = route.params;
  
  const dispatch = useDispatch<AppDispatch>();
  const { currentRackScans, scanCount, isLoading } = useSelector((state: RootState) => state.scans);
  const { isLoading: rackLoading } = useSelector((state: RootState) => state.racks);
  const { isOnline, pendingItems } = useSelector((state: RootState) => state.sync);
  const { forceFlush } = useScanQueue();
  
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Load existing scans for this rack
    dispatch(loadRackScans(rack.id));

    // Cleanup on unmount
    return () => {
      dispatch(clearCurrentRackScans());
    };
  }, [dispatch, rack.id]);

  useEffect(() => {
    // Update navigation title with scan count
    navigation.setOptions({
      title: `${rack.rack_number} (${scanCount} scans)`,
    });
  }, [navigation, rack.rack_number, scanCount]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await dispatch(loadRackScans(rack.id)).unwrap();
    } catch (error) {
      // Error handled by slice
    } finally {
      setRefreshing(false);
    }
  };

  const handleScanAdded = (barcode: string) => {
    // Scan was added successfully, UI will update via Redux
    console.log('Scan added:', barcode);
  };

  const handleMarkReady = async () => {
    if (scanCount === 0) {
      Alert.alert(
        'No Scans',
        'You need to scan at least one item before reviewing this rack.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Force flush queue to database before reviewing
    try {
      console.log('🔄 Flushing queue before review...');
      await forceFlush();
      console.log('✅ Queue flushed, navigating to review');
    } catch (error) {
      console.warn('⚠️ Queue flush failed, continuing to review anyway:', error);
    }

    // Navigate to review screen
    navigation.navigate('ReviewScans', { rack, location });
  };

  const goToRackList = () => {
    navigation.navigate('RackList', { location });
  };

  const goToSyncStatus = () => {
    navigation.navigate('SyncStatus');
  };

  const isRackReadyForApproval = rack.status === 'ready_for_approval';
  const canMarkReady = rack.status === 'assigned' && scanCount > 0;

  return (
    <View style={styles.container}>
      {/* Status Bar */}
      <Card style={styles.statusCard}>
        <Card.Content style={styles.statusContent}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Location:</Text>
            <Text style={styles.statusValue}>{location.name}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Rack:</Text>
            <Text style={styles.statusValue}>{rack.rack_number}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Status:</Text>
            <Chip 
              mode="outlined"
              style={[styles.statusChip, getStatusChipStyle(rack.status)]}
              textStyle={getStatusTextStyle(rack.status)}
            >
              {getStatusDisplayText(rack.status)}
            </Chip>
          </View>
        </Card.Content>
      </Card>

      {/* Scanner Input */}
      {!isRackReadyForApproval && (
        <ScannerInput
          rackId={rack.id}
          auditSessionId={rack.audit_session_id}
          onScanAdded={handleScanAdded}
        />
      )}

      {/* Scan Count */}
      <Card style={styles.countCard}>
        <Card.Content style={styles.countContent}>
          <Text style={styles.countNumber}>{scanCount}</Text>
          <Text style={styles.countLabel}>Total Scans</Text>
          {!isOnline && pendingItems > 0 && (
            <Text style={styles.offlineText}>
              {pendingItems} items pending sync
            </Text>
          )}
        </Card.Content>
      </Card>

      {/* Scan History */}
      <Card style={styles.historyCard}>
        <Card.Content>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Recent Scans</Text>
            <IconButton
              icon="refresh"
              size={20}
              onPress={handleRefresh}
              disabled={refreshing}
            />
          </View>
          
          <ScrollView 
            style={styles.scanList}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
              />
            }
          >
            {currentRackScans.length === 0 ? (
              <Text style={styles.emptyText}>No scans yet</Text>
            ) : (
              currentRackScans.slice(0, 10).map((scan, index) => (
                <List.Item
                  key={scan.id}
                  title={scan.barcode}
                  description={formatDateTime(scan.created_at)}
                  left={(props) => (
                    <List.Icon 
                      {...props} 
                      icon={scan.manual_entry ? "keyboard" : "barcode-scan"}
                      color={scan.is_recount ? "#f57c00" : "#4caf50"}
                    />
                  )}
                  right={() => scan.is_recount && (
                    <Chip mode="outlined" compact>
                      Recount
                    </Chip>
                  )}
                  style={[
                    styles.scanItem,
                    index === 0 && styles.latestScan
                  ]}
                />
              ))
            )}
          </ScrollView>
        </Card.Content>
      </Card>

      {/* Actions */}
      <View style={styles.actions}>
        {isRackReadyForApproval ? (
          <Text style={styles.readyText}>
            ✅ Ready for approval - Waiting for supervisor
          </Text>
        ) : (
          <Button
            mode="contained"
            onPress={handleMarkReady}
            disabled={!canMarkReady || rackLoading}
            loading={rackLoading}
            style={styles.readyButton}
            contentStyle={styles.buttonContent}
          >
            Review & Submit
          </Button>
        )}
      </View>

      {/* FABs */}
      <FAB
        icon="format-list-bulleted"
        style={[styles.fab, styles.fabLeft]}
        onPress={goToRackList}
        label="My Racks"
      />
      
      {!isOnline && (
        <FAB
          icon="sync"
          style={[styles.fab, styles.fabRight]}
          onPress={goToSyncStatus}
          label="Sync"
          color="#f57c00"
        />
      )}
    </View>
  );
};

const getStatusDisplayText = (status: string): string => {
  switch (status) {
    case 'assigned': return 'Scanning';
    case 'ready_for_approval': return 'Ready';
    case 'approved': return 'Approved';
    case 'rejected': return 'Rejected';
    default: return status;
  }
};

const getStatusChipStyle = (status: string) => {
  switch (status) {
    case 'assigned': return { backgroundColor: '#e3f2fd' };
    case 'ready_for_approval': return { backgroundColor: '#fff3e0' };
    case 'approved': return { backgroundColor: '#e8f5e8' };
    case 'rejected': return { backgroundColor: '#ffebee' };
    default: return {};
  }
};

const getStatusTextStyle = (status: string) => {
  switch (status) {
    case 'assigned': return { color: '#1976d2' };
    case 'ready_for_approval': return { color: '#f57c00' };
    case 'approved': return { color: '#388e3c' };
    case 'rejected': return { color: '#d32f2f' };
    default: return {};
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  statusCard: {
    margin: 16,
    marginBottom: 8,
  },
  statusContent: {
    paddingBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  statusChip: {
    height: 24,
  },
  countCard: {
    margin: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  countContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  countNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  countLabel: {
    fontSize: 16,
    color: '#666666',
    marginTop: 4,
  },
  offlineText: {
    fontSize: 12,
    color: '#f57c00',
    marginTop: 4,
  },
  historyCard: {
    flex: 1,
    margin: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  scanList: {
    maxHeight: 300,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999999',
    fontStyle: 'italic',
    marginTop: 20,
  },
  scanItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  latestScan: {
    backgroundColor: '#f8f9fa',
  },
  actions: {
    padding: 16,
  },
  readyButton: {
    height: 48,
  },
  buttonContent: {
    height: 48,
  },
  readyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#4caf50',
    fontWeight: 'bold',
    padding: 16,
  },
  fab: {
    position: 'absolute',
    bottom: 16,
  },
  fabLeft: {
    left: 16,
  },
  fabRight: {
    right: 16,
  },
});

export default ScanningScreen;