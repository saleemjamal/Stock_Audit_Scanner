import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useSelector } from 'react-redux';

import { RootState } from '../store';
import LocationSelectionScreen from '../screens/main/LocationSelectionScreen';
import ScanningScreen from '../screens/main/ScanningScreen';
import RackSelectionScreen from '../screens/main/RackSelectionScreen';
import RackListScreen from '../screens/main/RackListScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import SyncStatusScreen from '../screens/main/SyncStatusScreen';
import { Location, Rack } from '../../../shared/types';

export type MainStackParamList = {
  LocationSelection: undefined;
  RackSelection: {
    location: Location;
  };
  Scanning: {
    rack: Rack;
    location: Location;
  };
  RackList: {
    location: Location;
  };
  Settings: undefined;
  SyncStatus: undefined;
};

const Stack = createStackNavigator<MainStackParamList>();

const MainNavigator: React.FC = () => {
  const { selectedLocation } = useSelector((state: RootState) => state.app);
  const { currentRack } = useSelector((state: RootState) => state.racks);

  const getInitialRouteName = (): keyof MainStackParamList => {
    if (!selectedLocation) {
      return 'LocationSelection';
    }
    
    if (currentRack) {
      return 'Scanning';
    }
    
    return 'RackSelection';
  };

  return (
    <Stack.Navigator
      initialRouteName={getInitialRouteName()}
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#ffffff',
          elevation: 4,
          shadowOpacity: 0.1,
        },
        headerTintColor: '#000000',
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
        },
        cardStyle: { backgroundColor: '#f5f5f5' },
      }}
    >
      <Stack.Screen 
        name="LocationSelection" 
        component={LocationSelectionScreen}
        options={{
          title: 'Select Location',
          headerLeft: () => null,
        }}
      />
      
      <Stack.Screen 
        name="RackSelection" 
        component={RackSelectionScreen}
        options={{
          title: 'Select Rack',
        }}
      />
      
      <Stack.Screen 
        name="Scanning" 
        component={ScanningScreen}
        options={({ route }) => ({
          title: `Scanning - ${route.params.rack.rack_number}`,
          headerBackTitleVisible: false,
        })}
      />
      
      <Stack.Screen 
        name="RackList" 
        component={RackListScreen}
        options={{
          title: 'My Racks',
        }}
      />
      
      <Stack.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{
          title: 'Settings',
        }}
      />
      
      <Stack.Screen 
        name="SyncStatus" 
        component={SyncStatusScreen}
        options={{
          title: 'Sync Status',
        }}
      />
    </Stack.Navigator>
  );
};

export default MainNavigator;