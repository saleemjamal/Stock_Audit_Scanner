import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { Text, Card, List, Button, ActivityIndicator, FAB } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { MainStackParamList } from '../../navigation/MainNavigator';
import { RootState, AppDispatch } from '../../store';
import { 
  loadAuditSession, 
  loadAvailableRacks, 
  loadUserRacks, 
  assignRack,
  setCurrentRack,
} from '../../store/slices/rackSlice';
import { showErrorMessage } from '../../store/slices/appSlice';

type RackSelectionScreenRouteProp = RouteProp<MainStackParamList, 'RackSelection'>;
type RackSelectionScreenNavigationProp = StackNavigationProp<MainStackParamList, 'RackSelection'>;

interface RackSelectionScreenProps {
  route: RackSelectionScreenRouteProp;
  navigation: RackSelectionScreenNavigationProp;
}

const RackSelectionScreen: React.FC<RackSelectionScreenProps> = ({ route, navigation }) => {
  const { location } = route.params;
  
  const dispatch = useDispatch<AppDispatch>();
  const { 
    availableRacks, 
    userRacks, 
    currentAuditSession, 
    isLoading 
  } = useSelector((state: RootState) => state.racks);
  
  const [refreshing, setRefreshing] = useState(false);
  
  // Check if user has an active rack (assigned but not ready for approval)
  const activeRack = userRacks.find(rack => rack.status === 'assigned');
  const hasActiveRack = !!activeRack;

  useEffect(() => {
    loadInitialData();
  }, [location.id]);

  const loadInitialData = async () => {
    try {
      console.log('🔍 RackSelection: Starting to load initial data for location:', location.id);
      
      // Load audit session first
      console.log('🔍 RackSelection: Loading audit session...');
      const startTime = performance.now();
      const auditSession = await dispatch(loadAuditSession(location.id)).unwrap();
      console.log(`✅ RackSelection: Audit session loaded in ${(performance.now() - startTime).toFixed(2)}ms`, auditSession);
      
      // Then load racks
      console.log('🔍 RackSelection: Loading racks for session:', auditSession.id);
      const racksStartTime = performance.now();
      await Promise.all([
        dispatch(loadAvailableRacks(auditSession.id)),
        dispatch(loadUserRacks(auditSession.id)),
      ]);
      console.log(`✅ RackSelection: Racks loaded in ${(performance.now() - racksStartTime).toFixed(2)}ms`);
    } catch (error: any) {
      console.error('💥 RackSelection: Failed to load initial data:', error);
      console.error('💥 RackSelection: Error details:', error.message, error.stack);
      dispatch(showErrorMessage(error.message));
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadInitialData();
    setRefreshing(false);
  };

  const handleAssignRack = async (rackId: string) => {
    // Check if user already has an active rack
    if (hasActiveRack) {
      Alert.alert(
        'Active Rack',
        `You already have an active rack (Rack ${activeRack.rack_number}). Please complete it before starting a new one.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Go to Active Rack', 
            onPress: () => resumeRack(activeRack) 
          }
        ]
      );
      return;
    }
    
    try {
      const assignedRack = await dispatch(assignRack(rackId)).unwrap();
      if (assignedRack) {
        dispatch(setCurrentRack(assignedRack));
        navigation.navigate('Scanning', { rack: assignedRack, location });
      }
    } catch (error: any) {
      Alert.alert('Assignment Failed', error.message);
    }
  };

  const resumeRack = (rack: any) => {
    dispatch(setCurrentRack(rack));
    navigation.navigate('Scanning', { rack, location });
  };

  const goToRackList = () => {
    navigation.navigate('RackList', { location });
  };


  if (isLoading && !currentAuditSession) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading audit session...</Text>
      </View>
    );
  }

  if (!currentAuditSession) {
    return (
      <View style={styles.container}>
        <Card style={styles.errorCard}>
          <Card.Content>
            <Text style={styles.errorTitle}>No Active Audit Session</Text>
            <Text style={styles.errorText}>
              There is no active audit session for {location.name}. 
              Please contact your supervisor to start an audit session.
            </Text>
            <Button
              mode="outlined"
              onPress={handleRefresh}
              style={styles.retryButton}
            >
              Retry
            </Button>
          </Card.Content>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Location Info */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Text style={styles.locationName}>{location.name}</Text>
            <Text style={styles.auditInfo}>
              Audit Session: {currentAuditSession.total_rack_count} racks total
            </Text>
          </Card.Content>
        </Card>


        {/* Active Rack - Show prominently if user has one */}
        {hasActiveRack && (
          <Card style={[styles.sectionCard, styles.activeRackCard]}>
            <Card.Content>
              <Text style={styles.activeRackTitle}>📦 Current Active Rack</Text>
              <List.Item
                title={`Rack ${activeRack.rack_number}`}
                description={`${activeRack.total_scans || 0} scans - Continue scanning`}
                onPress={() => resumeRack(activeRack)}
                style={styles.rackItem}
                left={(props) => (
                  <List.Icon 
                    {...props} 
                    icon="barcode-scan" 
                    color="#1976d2"
                  />
                )}
                right={(props) => (
                  <Button mode="contained" compact>
                    Continue
                  </Button>
                )}
              />
              <Text style={styles.activeRackNote}>
                Complete this rack before starting a new one
              </Text>
            </Card.Content>
          </Card>
        )}

        {/* Completed/Pending Racks */}
        {userRacks.filter(rack => rack.status !== 'assigned').length > 0 && (
          <Card style={styles.sectionCard}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Your Other Racks</Text>
              {userRacks
                .filter(rack => rack.status !== 'assigned')
                .map((rack) => (
                  <List.Item
                    key={rack.id}
                    title={`Rack ${rack.rack_number}`}
                    description={getRackStatusDescription(rack)}
                    onPress={() => rack.status === 'rejected' ? resumeRack(rack) : null}
                    disabled={rack.status !== 'rejected'}
                    style={styles.rackItem}
                    left={(props) => (
                      <List.Icon 
                        {...props} 
                        icon={getRackStatusIcon(rack.status)} 
                        color={getRackStatusColor(rack.status)}
                      />
                    )}
                    right={(props) => rack.status === 'rejected' && (
                      <List.Icon {...props} icon="chevron-right" />
                    )}
                  />
                ))}
            </Card.Content>
          </Card>
        )}

        {/* Available Racks - Hide or show disabled state when user has active rack */}
        {!hasActiveRack && (
          <Card style={styles.sectionCard}>
            <Card.Content>
              <Text style={styles.sectionTitle}>
                Available Racks ({availableRacks.length})
              </Text>
              
              {availableRacks.length === 0 ? (
                <Text style={styles.emptyText}>
                  No racks available. All racks may be assigned or completed.
                </Text>
              ) : (
                availableRacks.slice(0, 20).map((rack) => (
                  <List.Item
                    key={rack.id}
                    title={`Rack ${rack.rack_number}`}
                    description="Available for assignment"
                    onPress={() => handleAssignRack(rack.id)}
                    style={styles.rackItem}
                    left={(props) => (
                      <List.Icon {...props} icon="package-variant" color="#4caf50" />
                    )}
                    right={(props) => (
                      <List.Icon {...props} icon="plus" />
                    )}
                  />
                ))
              )}
            </Card.Content>
          </Card>
        )}
        
        {/* Show info when available racks are hidden */}
        {hasActiveRack && availableRacks.length > 0 && (
          <Card style={styles.infoCard}>
            <Card.Content>
              <Text style={styles.infoText}>
                ℹ️ {availableRacks.length} racks are available. Complete your current rack to select a new one.
              </Text>
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      {/* FAB for Rack List */}
      <FAB
        icon="format-list-bulleted"
        style={styles.fab}
        onPress={goToRackList}
        label="My Racks"
      />

    </View>
  );
};

const getRackStatusDescription = (rack: any): string => {
  switch (rack.status) {
    case 'assigned':
      return `${rack.total_scans} scans - Continue scanning`;
    case 'ready_for_approval':
      return `${rack.total_scans} scans - Awaiting approval`;
    case 'approved':
      return `${rack.total_scans} scans - Approved`;
    case 'rejected':
      return `${rack.total_scans} scans - Rejected, needs recount`;
    default:
      return rack.status;
  }
};

const getRackStatusIcon = (status: string): string => {
  switch (status) {
    case 'assigned': return 'barcode-scan';
    case 'ready_for_approval': return 'clock-outline';
    case 'approved': return 'check-circle';
    case 'rejected': return 'alert-circle';
    default: return 'package-variant';
  }
};

const getRackStatusColor = (status: string): string => {
  switch (status) {
    case 'assigned': return '#1976d2';
    case 'ready_for_approval': return '#f57c00';
    case 'approved': return '#4caf50';
    case 'rejected': return '#f44336';
    default: return '#666666';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#666666',
  },
  infoCard: {
    margin: 16,
    marginBottom: 8,
  },
  locationName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  auditInfo: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  sectionCard: {
    margin: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
    lineHeight: 20,
  },
  rackItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999999',
    fontStyle: 'italic',
    marginVertical: 20,
  },
  errorCard: {
    margin: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f44336',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 16,
  },
  retryButton: {
    alignSelf: 'flex-start',
  },
  fab: {
    position: 'absolute',
    bottom: 16,
    right: 16,
  },
  activeRackCard: {
    borderWidth: 2,
    borderColor: '#1976d2',
  },
  activeRackTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 12,
  },
  activeRackNote: {
    fontSize: 14,
    color: '#666666',
    fontStyle: 'italic',
    marginTop: 12,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
});

export default RackSelectionScreen;