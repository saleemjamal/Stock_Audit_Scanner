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
  List,
  IconButton,
  Divider,
} from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { MainStackParamList } from '../../navigation/MainNavigator';
import { RootState, AppDispatch } from '../../store';
import { loadRackScans, deleteScan, removeScanFromState } from '../../store/slices/scanSlice';
import { markRackReady } from '../../store/slices/rackSlice';
import { showSuccessMessage, showErrorMessage } from '../../store/slices/appSlice';
import { formatDateTime } from '../../../../shared/utils/helpers';

type ReviewScansScreenRouteProp = RouteProp<MainStackParamList, 'ReviewScans'>;
type ReviewScansScreenNavigationProp = StackNavigationProp<MainStackParamList, 'ReviewScans'>;

interface ReviewScansScreenProps {
  route: ReviewScansScreenRouteProp;
  navigation: ReviewScansScreenNavigationProp;
}

const ReviewScansScreen: React.FC<ReviewScansScreenProps> = ({ route, navigation }) => {
  const { rack, location } = route.params;
  
  const dispatch = useDispatch<AppDispatch>();
  const { currentRackScans, scanCount, isLoading } = useSelector((state: RootState) => state.scans);
  const { isLoading: rackLoading } = useSelector((state: RootState) => state.racks);
  
  const [refreshing, setRefreshing] = useState(false);
  const [deletingScans, setDeletingScans] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Load existing scans for this rack
    dispatch(loadRackScans(rack.id));
  }, [dispatch, rack.id]);

  useEffect(() => {
    // Update navigation title with scan count
    navigation.setOptions({
      title: `Review: ${rack.rack_number} (${scanCount} scans)`,
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

  const handleDeleteScan = (scanId: string, barcode: string) => {
    Alert.alert(
      'Delete Scan',
      `Remove scan: ${barcode}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => confirmDeleteScan(scanId),
        },
      ]
    );
  };

  const confirmDeleteScan = async (scanId: string) => {
    setDeletingScans(prev => new Set(prev).add(scanId));
    
    try {
      // Optimistic UI: remove from state immediately
      dispatch(removeScanFromState(scanId));
      
      // Delete from database
      await dispatch(deleteScan(scanId)).unwrap();
      
      dispatch(showSuccessMessage('Scan deleted'));
    } catch (error: any) {
      // Restore scan to state on error
      dispatch(loadRackScans(rack.id));
      dispatch(showErrorMessage(`Failed to delete scan: ${error.message}`));
    } finally {
      setDeletingScans(prev => {
        const next = new Set(prev);
        next.delete(scanId);
        return next;
      });
    }
  };

  const handleConfirmReady = () => {
    if (scanCount === 0) {
      Alert.alert(
        'No Scans',
        'You need to scan at least one item before marking this rack as ready for approval.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Confirm Ready for Approval',
      `Send rack ${rack.rack_number} with ${scanCount} scans to supervisor for approval?\n\nOnce submitted, you cannot make further changes.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm', 
          style: 'default',
          onPress: confirmMarkReady,
        },
      ]
    );
  };

  const confirmMarkReady = async () => {
    try {
      await dispatch(markRackReady(rack.id)).unwrap();
      dispatch(showSuccessMessage('Rack marked as ready for approval'));
      
      // Navigate back to rack selection
      navigation.navigate('RackSelection', { location });
    } catch (error: any) {
      dispatch(showErrorMessage(`Failed to mark rack ready: ${error.message}`));
    }
  };

  const canConfirm = scanCount > 0 && !rackLoading;

  return (
    <View style={styles.container}>
      {/* Header Info */}
      <Card style={styles.headerCard}>
        <Card.Content>
          <Text style={styles.headerTitle}>Review Your Scans</Text>
          <Text style={styles.headerSubtitle}>
            Last chance to make changes before sending to supervisor
          </Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Location:</Text>
            <Text style={styles.infoValue}>{location.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Rack:</Text>
            <Text style={styles.infoValue}>{rack.rack_number}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Total Scans:</Text>
            <Text style={styles.countNumber}>{scanCount}</Text>
          </View>
        </Card.Content>
      </Card>

      {/* Scans List */}
      <Card style={styles.scansCard}>
        <Card.Content>
          <View style={styles.scansHeader}>
            <Text style={styles.scansTitle}>Scanned Items</Text>
            <IconButton
              icon="refresh"
              size={20}
              onPress={handleRefresh}
              disabled={refreshing}
            />
          </View>
          
          <ScrollView 
            style={styles.scansList}
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
              currentRackScans.map((scan, index) => (
                <View key={scan.id}>
                  <View style={styles.scanItemContainer}>
                    <View style={styles.scanInfo}>
                      <List.Icon 
                        icon={scan.manual_entry ? "keyboard" : "barcode-scan"}
                        color="#4caf50"
                      />
                      <View style={styles.scanDetails}>
                        <Text style={styles.scanBarcode}>{scan.barcode}</Text>
                        <Text style={styles.scanTime}>{formatDateTime(scan.created_at)}</Text>
                      </View>
                    </View>
                    <IconButton
                      icon="delete"
                      size={24}
                      iconColor="#d32f2f"
                      disabled={deletingScans.has(scan.id)}
                      onPress={() => handleDeleteScan(scan.id, scan.barcode)}
                      style={styles.deleteButton}
                    />
                  </View>
                  {index < currentRackScans.length - 1 && <Divider />}
                </View>
              ))
            )}
          </ScrollView>
        </Card.Content>
      </Card>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          style={styles.cancelButton}
          contentStyle={styles.buttonContent}
        >
          Back to Scanning
        </Button>
        
        <Button
          mode="contained"
          onPress={handleConfirmReady}
          disabled={!canConfirm}
          loading={rackLoading}
          style={[styles.confirmButton, !canConfirm && styles.disabledButton]}
          contentStyle={styles.buttonContent}
        >
          Confirm Ready for Approval
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerCard: {
    margin: 16,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  countNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  scansCard: {
    flex: 1,
    margin: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  scansHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scansTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  scansList: {
    maxHeight: 400,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999999',
    fontStyle: 'italic',
    marginTop: 20,
    fontSize: 16,
  },
  scanItem: {
    paddingVertical: 8,
  },
  latestScan: {
    backgroundColor: '#f8f9fa',
  },
  scanItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  scanInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanDetails: {
    flex: 1,
    marginLeft: 8,
  },
  scanBarcode: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  scanTime: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  deleteButton: {
    margin: 0,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  cancelButton: {
    flex: 1,
    height: 48,
  },
  confirmButton: {
    flex: 2,
    height: 48,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonContent: {
    height: 48,
  },
});

export default ReviewScansScreen;