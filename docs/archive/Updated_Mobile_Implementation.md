# Updated Mobile App Implementation
## With Rack Management & Approval Features

### 1. Updated Navigation Structure
```javascript
// navigation/AppNavigator.js
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Scanner Tab Navigator
function ScannerTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen 
        name="Scan" 
        component={ScanScreen}
        options={{
          tabBarIcon: ({ color }) => <Icon name="barcode-scan" size={24} color={color} />
        }}
      />
      <Tab.Screen 
        name="Racks" 
        component={RackListScreen}
        options={{
          tabBarIcon: ({ color }) => <Icon name="view-list" size={24} color={color} />
        }}
      />
      <Tab.Screen 
        name="Progress" 
        component={ProgressScreen}
        options={{
          tabBarIcon: ({ color }) => <Icon name="chart-bar" size={24} color={color} />
        }}
      />
    </Tab.Navigator>
  );
}

// Main App Navigator
export default function AppNavigator() {
  const { user } = useAuth();
  
  return (
    <Stack.Navigator>
      {!user ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          <Stack.Screen 
            name="Main" 
            component={ScannerTabs} 
            options={{ headerShown: false }}
          />
          <Stack.Screen name="RackEntry" component={RackEntryScreen} />
          <Stack.Screen name="RackDetail" component={RackDetailScreen} />
          {['supervisor', 'admin'].includes(user.role) && (
            <Stack.Screen name="Approvals" component={ApprovalsScreen} />
          )}
        </>
      )}
    </Stack.Navigator>
  );
}
```

### 2. Rack Selection Screen
```javascript
// screens/RackSelectionScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert
} from 'react-native';
import {
  Card,
  Title,
  Button,
  Text
} from 'react-native-paper';
import { Picker } from '@react-native-picker/picker';
import { useSelector } from 'react-redux';
import { api } from '../services/api';
const RackSelectionScreen = ({ navigation, route }) => {
  const [availableRacks, setAvailableRacks] = useState([]);
  const [selectedRack, setSelectedRack] = useState(null);
  const [shelfNumber, setShelfNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const activeSession = useSelector(state => state.audit.activeSession);

  useEffect(() => {
    loadAvailableRacks();
  }, []);

  const loadAvailableRacks = async () => {
    try {
      const response = await api.get(`/racks/available/${activeSession.id}`);
      setAvailableRacks(response);
    } catch (error) {
      Alert.alert('Error', 'Failed to load racks');
    }
  };

  const handleClaimRack = async () => {
    if (!selectedRack) {
      Alert.alert('Error', 'Please select a rack');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/racks/claim', {
        rackId: selectedRack,
        shelfNumber: shelfNumber.trim() || null
      });

      if (response.error) {
        Alert.alert('Error', 'Rack already claimed');
        loadAvailableRacks();
        return;
      }

      // Navigate to scan screen with rack info
      navigation.navigate('Scan', { 
        rack: response,
        displayRack: `Rack ${response.rack_number}`
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to claim rack');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Title>Select Rack to Scan</Title>
          
          <Picker
            selectedValue={selectedRack}
            onValueChange={setSelectedRack}
            style={styles.picker}>
            <Picker.Item label="Choose a rack..." value={null} />
            {availableRacks.map(rack => (
              <Picker.Item 
                key={rack.id}
                label={`Rack ${rack.rack_number}`} 
                value={rack.id} 
              />
            ))}
          </Picker>
          
          <Text style={styles.availableText}>
            {availableRacks.length} racks available
          </Text>

          <TextInput
            label="Shelf Number (Optional)"
            value={shelfNumber}
            onChangeText={setShelfNumber}
            mode="outlined"
            style={styles.input}
          />

          <Button
            mode="contained"
            onPress={handleClaimRack}
            loading={isLoading}
            disabled={!selectedRack}
            style={styles.button}
          >
            Start Scanning
          </Button>
        </Card.Content>
      </Card>
    </View>
  );
};
### 3. Updated Scan Screen with Rack Info
```javascript
// screens/ScanScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Vibration,
} from 'react-native';
import { 
  Card, 
  Button, 
  Portal, 
  Dialog,
  FAB,
  Chip,
  Banner
} from 'react-native-paper';
import { useSocket } from '../hooks/useSocket';

const ScanScreen = ({ navigation, route }) => {
  const [currentRack, setCurrentRack] = useState(route.params?.rack || null);
  const [scanCount, setScanCount] = useState(0);
  const [lastScan, setLastScan] = useState(null);
  const [showReadyDialog, setShowReadyDialog] = useState(false);
  const socket = useSocket();

  useEffect(() => {
    if (!currentRack) {
      navigation.navigate('RackEntry');
    }
  }, [currentRack]);

  useEffect(() => {
    // Listen for approval/rejection
    socket?.on('rack:approved', (data) => {
      if (data.rackId === currentRack?.id) {
        Alert.alert('Success', 'Rack approved! You can start a new rack.');
        navigation.navigate('RackEntry');
      }
    });

    socket?.on('rack:rejected', (data) => {
      if (data.rackId === currentRack?.id) {
        Alert.alert(
          'Recount Required', 
          `Reason: ${data.reason}\nPlease recount this rack.`,
          [{ text: 'OK', onPress: () => setScanCount(0) }]
        );
      }
    });

    return () => {
      socket?.off('rack:approved');
      socket?.off('rack:rejected');
    };
  }, [socket, currentRack]);

  const handleScan = async (barcode) => {
    try {
      await api.post('/scans/create', {
        barcode,
        rackId: currentRack.id,
        shelfNumber: currentRack.shelfNumber
      });

      setScanCount(prev => prev + 1);
      setLastScan({ barcode, timestamp: new Date() });
      
      if (Platform.OS === 'android') {
        Vibration.vibrate(100);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save scan');
    }
  };

  const handleReadyForApproval = async () => {
    if (scanCount === 0) {
      Alert.alert('Error', 'No items scanned in this rack');
      return;
    }

    try {
      await api.post(`/racks/${currentRack.id}/ready-for-approval`);
      Alert.alert(
        'Success', 
        'Rack marked as ready for approval. You can continue with another rack or wait for approval.'
      );
      setShowReadyDialog(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to mark rack as ready');
    }
  };
  return (
    <View style={styles.container}>
      {/* Rack Info Banner */}
      <Banner
        visible={true}
        actions={[
          {
            label: 'Change Rack',
            onPress: () => navigation.navigate('RackEntry'),
          },
        ]}
        icon="package-variant"
      >
        Scanning: {route.params?.displayRack} 
        {currentRack?.shelfNumber && ` - Shelf ${currentRack.shelfNumber}`}
      </Banner>

      {/* Scan Count Card */}
      <Card style={styles.countCard}>
        <Card.Content>
          <Text style={styles.countText}>{scanCount}</Text>
          <Text style={styles.countLabel}>Items Scanned</Text>
        </Card.Content>
      </Card>

      {/* Scanner Input (Hidden) */}
      <ScannerInput onScan={handleScan} />

      {/* Last Scan Info */}
      {lastScan && (
        <Card style={styles.lastScanCard}>
          <Card.Content>
            <Text>Last: {lastScan.barcode}</Text>
            <Text style={styles.timestamp}>
              {lastScan.timestamp.toLocaleTimeString()}
            </Text>
          </Card.Content>
        </Card>
      )}

      {/* Ready for Approval FAB */}
      <FAB
        style={styles.fab}
        icon="check-circle"
        label="Ready for Approval"
        onPress={() => setShowReadyDialog(true)}
        disabled={scanCount === 0}
      />

      {/* Confirmation Dialog */}
      <Portal>
        <Dialog visible={showReadyDialog} onDismiss={() => setShowReadyDialog(false)}>
          <Dialog.Title>Mark Rack as Ready?</Dialog.Title>
          <Dialog.Content>
            <Text>
              You have scanned {scanCount} items in rack {route.params?.displayRack}.
              Once marked ready, a supervisor must approve before you can edit.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowReadyDialog(false)}>Cancel</Button>
            <Button onPress={handleReadyForApproval}>Confirm</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};
```

### 4. Supervisor Approval Screen
```javascript
// screens/ApprovalsScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Chip,
  Divider,
  Portal,
  Dialog,
  TextInput
} from 'react-native-paper';
import { api } from '../services/api';
const ApprovalsScreen = () => {
  const [pendingRacks, setPendingRacks] = useState([]);
  const [selectedRack, setSelectedRack] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchPendingRacks();
  }, []);

  const fetchPendingRacks = async () => {
    try {
      const data = await api.get('/racks/pending');
      setPendingRacks(data);
    } catch (error) {
      console.error('Failed to fetch pending racks');
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchPendingRacks();
    setIsRefreshing(false);
  };

  const handleApprove = async (rack) => {
    try {
      await api.post(`/racks/${rack.id}/approve`);
      Alert.alert('Success', 'Rack approved successfully');
      fetchPendingRacks();
    } catch (error) {
      Alert.alert('Error', 'Failed to approve rack');
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for rejection');
      return;
    }

    try {
      await api.post(`/racks/${selectedRack.id}/reject`, {
        reason: rejectReason
      });
      Alert.alert('Success', 'Recount requested');
      setShowRejectDialog(false);
      setRejectReason('');
      fetchPendingRacks();
    } catch (error) {
      Alert.alert('Error', 'Failed to reject rack');
    }
  };

  const renderRack = ({ item }) => (
    <Card style={styles.rackCard}>
      <Card.Content>
        <View style={styles.rackHeader}>
          <Title>{item.location}-{item.rackNumber}</Title>
          <Chip mode="outlined" compact>
            {item.itemCount} items
          </Chip>
        </View>
        
        <Paragraph>Scanner: {item.scannerName}</Paragraph>
        <Paragraph>Ready since: {new Date(item.readyAt).toLocaleString()}</Paragraph>
        
        {item.shelfNumber && (
          <Paragraph>Shelf: {item.shelfNumber}</Paragraph>
        )}
      </Card.Content>
      
      <Card.Actions>
        <Button 
          mode="outlined" 
          onPress={() => {
            setSelectedRack(item);
            setShowRejectDialog(true);
          }}
        >
          Reject
        </Button>
        <Button 
          mode="contained" 
          onPress={() => handleApprove(item)}
        >
          Approve
        </Button>
      </Card.Actions>
    </Card>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={pendingRacks}
        renderItem={renderRack}
        keyExtractor={item => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <Card>
            <Card.Content>
              <Paragraph>No racks pending approval</Paragraph>
            </Card.Content>
          </Card>
        }
      />

      {/* Reject Dialog */}
      <Portal>
        <Dialog visible={showRejectDialog} onDismiss={() => setShowRejectDialog(false)}>
          <Dialog.Title>Request Recount</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Reason for recount"
              value={rejectReason}
              onChangeText={setRejectReason}
              mode="outlined"
              multiline
              numberOfLines={3}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button onPress={handleReject}>Request Recount</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};
```