import React, { useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, List, Button, ActivityIndicator } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { MainStackParamList } from '../../navigation/MainNavigator';
import { RootState, AppDispatch } from '../../store';
import { setSelectedLocation, showErrorMessage } from '../../store/slices/appSlice';
import { supabaseHelpers } from '../../services/supabase';
import { signOut } from '../../store/slices/authSlice';
import { Location } from '../../../../shared/types';

type LocationSelectionNavigationProp = StackNavigationProp<MainStackParamList, 'LocationSelection'>;

const LocationSelectionScreen: React.FC = () => {
  const navigation = useNavigation<LocationSelectionNavigationProp>();
  const dispatch = useDispatch<AppDispatch>();
  
  const { user } = useSelector((state: RootState) => state.auth);
  const { locations } = useSelector((state: RootState) => state.app);
  
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [userLocations, setUserLocations] = React.useState<Location[]>([]);

  useEffect(() => {
    loadUserLocations();
  }, [user]);

  const loadUserLocations = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const locations = await supabaseHelpers.getUserLocations(user.id);
      setUserLocations(locations);
    } catch (error: any) {
      dispatch(showErrorMessage(`Failed to load locations: ${error.message}`));
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadUserLocations();
    setRefreshing(false);
  };

  const selectLocation = (location: Location) => {
    dispatch(setSelectedLocation(location));
    navigation.navigate('RackSelection', { location });
  };

  const handleSignOut = () => {
    dispatch(signOut());
  };

  const goToSettings = () => {
    navigation.navigate('Settings');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading locations...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* User Info */}
        <Card style={styles.userCard}>
          <Card.Content>
            <Text style={styles.welcomeText}>Welcome back!</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <Text style={styles.userRole}>Role: {user?.role}</Text>
          </Card.Content>
        </Card>

        {/* Instructions */}
        <Card style={styles.instructionsCard}>
          <Card.Content>
            <Text style={styles.instructionsTitle}>Select Your Location</Text>
            <Text style={styles.instructionsText}>
              Choose the store location where you'll be conducting the inventory audit.
            </Text>
          </Card.Content>
        </Card>

        {/* Locations List */}
        <Card style={styles.locationsCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Available Locations</Text>
            
            {userLocations.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  No locations assigned to your account.
                </Text>
                <Text style={styles.emptySubtext}>
                  Please contact your administrator to assign locations.
                </Text>
              </View>
            ) : (
              userLocations.map((location) => (
                <List.Item
                  key={location.id}
                  title={location.name}
                  description={`${location.city}, ${location.state}`}
                  onPress={() => selectLocation(location)}
                  style={styles.locationItem}
                  titleStyle={styles.locationTitle}
                  descriptionStyle={styles.locationDescription}
                  left={(props) => (
                    <List.Icon {...props} icon="store" color="#1976d2" />
                  )}
                  right={(props) => (
                    <List.Icon {...props} icon="chevron-right" />
                  )}
                />
              ))
            )}
          </Card.Content>
        </Card>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Button
            mode="outlined"
            onPress={goToSettings}
            style={styles.actionButton}
            icon="cog"
          >
            Settings
          </Button>
          
          <Button
            mode="outlined"
            onPress={handleSignOut}
            style={styles.actionButton}
            icon="exit-to-app"
          >
            Sign Out
          </Button>
        </View>
      </ScrollView>

    </View>
  );
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
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  scrollView: {
    flex: 1,
  },
  userCard: {
    margin: 16,
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#333333',
    marginBottom: 4,
  },
  userRole: {
    fontSize: 14,
    color: '#666666',
    textTransform: 'capitalize',
  },
  instructionsCard: {
    margin: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  locationsCard: {
    margin: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  locationItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingVertical: 8,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  locationDescription: {
    fontSize: 14,
    color: '#666666',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
  },
  actions: {
    padding: 16,
    gap: 12,
  },
  actionButton: {
    marginBottom: 8,
  },
  debugButton: {
    marginTop: 12,
  },
  debugCloseButton: {
    position: 'absolute',
    top: 60,
    right: 16,
    zIndex: 10000,
  },
});

export default LocationSelectionScreen;