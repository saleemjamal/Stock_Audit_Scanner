import React, { useEffect, useState } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  RefreshControl,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { 
  Text, 
  Card, 
  Button,
  List,
  IconButton,
  Divider,
  Searchbar,
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
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Load existing scans for this rack
    console.log('🗑️ ReviewScreen: Loading scans for rack:', rack.id);
    dispatch(loadRackScans(rack.id));
  }, [dispatch, rack.id]);

  useEffect(() => {
    // Log scan data when it changes
    console.log('🗑️ ReviewScreen: Current scans data:', {
      count: currentRackScans.length,
      scans: currentRackScans.map(scan => ({
        id: scan.id,
        barcode: scan.barcode,
        scanner_id: scan.scanner_id,
        created_at: scan.created_at
      }))
    });
  }, [currentRackScans]);

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
    console.log('🗑️ ReviewScreen: Delete requested for:', { scanId, barcode, type: typeof scanId });
    
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
    console.log('🗑️ ReviewScreen: Confirming delete for scanId:', scanId);
    setDeletingScans(prev => new Set(prev).add(scanId));
    
    try {
      // Optimistic UI: remove from state immediately
      dispatch(removeScanFromState(scanId));
      
      // Delete from database
      console.log('🗑️ ReviewScreen: Dispatching deleteScan action...');
      await dispatch(deleteScan(scanId)).unwrap();
      
      console.log('🗑️ ReviewScreen: Delete successful!');
      dispatch(showSuccessMessage('Scan deleted'));
    } catch (error: any) {
      console.error('🗑️ ReviewScreen: Delete failed:', error);
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
    console.log('✅ ReviewScreen: Starting confirmMarkReady process...');
    console.log('✅ ReviewScreen: Rack data:', {
      rackId: rack.id,
      rackNumber: rack.rack_number,
      currentStatus: rack.status,
      scanCount: scanCount
    });
    
    try {
      console.log('✅ ReviewScreen: Dispatching markRackReady action...');
      const result = await dispatch(markRackReady(rack.id)).unwrap();
      console.log('✅ ReviewScreen: markRackReady successful:', result);
      
      dispatch(showSuccessMessage('Rack marked as ready for approval'));
      
      // Navigate back to rack selection
      console.log('✅ ReviewScreen: Navigating back to RackSelection...');
      navigation.navigate('RackSelection', { location });
    } catch (error: any) {
      console.error('❌ ReviewScreen: markRackReady failed:', {
        error: error,
        message: error.message,
        stack: error.stack,
        rackId: rack.id
      });
      dispatch(showErrorMessage(`Failed to mark rack ready: ${error.message}`));
    }
  };

  const canConfirm = scanCount > 0 && !rackLoading;

  // Filter scans based on search query
  const filteredScans = searchQuery.trim() === ''
    ? currentRackScans
    : currentRackScans.filter(scan => 
        scan.barcode.toLowerCase().includes(searchQuery.toLowerCase())
      );

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
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Total Items:</Text>
            <Text style={styles.countNumber}>{currentRackScans.reduce((sum, scan) => sum + scan.quantity, 0)}</Text>
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
          
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Searchbar
              placeholder="Search by barcode..."
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={styles.searchBar}
              iconColor="#4caf50"
              clearIcon={searchQuery ? "close" : undefined}
              mode="bar"
            />
          </View>
          
          {/* Search Results Count */}
          {searchQuery && (
            <Text style={styles.searchResultsText}>
              Showing {filteredScans.length} of {currentRackScans.length} scans
            </Text>
          )}
          
          <ScrollView 
            style={styles.scansList}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
              />
            }
          >
            {filteredScans.length === 0 ? (
              <Text style={styles.emptyText}>
                {searchQuery ? `No scans matching "${searchQuery}"` : 'No scans yet'}
              </Text>
            ) : (
              filteredScans.map((scan, index) => (
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
                    <TouchableOpacity
                      disabled={deletingScans.has(scan.id)}
                      onPress={() => handleDeleteScan(scan.id, scan.barcode)}
                      style={[
                        styles.deleteButton,
                        deletingScans.has(scan.id) && styles.disabledDeleteButton
                      ]}
                    >
                      <Text style={styles.deleteEmoji}>🗑️</Text>
                    </TouchableOpacity>
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
  searchContainer: {
    marginBottom: 12,
  },
  searchBar: {
    backgroundColor: '#f8f9fa',
    elevation: 1,
    height: 48,
  },
  searchResultsText: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 8,
    paddingHorizontal: 8,
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
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#ffebee',
    borderWidth: 1,
    borderColor: '#ffcdd2',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
    minHeight: 40,
  },
  disabledDeleteButton: {
    opacity: 0.5,
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
  },
  deleteEmoji: {
    fontSize: 20,
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