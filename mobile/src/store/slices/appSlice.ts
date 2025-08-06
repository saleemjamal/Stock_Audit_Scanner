import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Location, ScannerConfig } from '../../../../shared/types';

interface AppState {
  isInitialized: boolean;
  locations: Location[];
  selectedLocation: Location | null;
  scannerConfig: ScannerConfig;
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    timestamp: string;
    read: boolean;
  }>;
  deviceInfo: {
    device_id: string;
    device_name: string;
    os_version: string;
    app_version: string;
  } | null;
  userPreferences: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    sound_enabled: boolean;
    vibration_enabled: boolean;
    notifications_enabled: boolean;
  };
  appStatus: {
    scanner_connected: boolean;
    database_ready: boolean;
    network_available: boolean;
    last_activity: string | null;
  };
}

const initialState: AppState = {
  isInitialized: false,
  locations: [],
  selectedLocation: null,
  scannerConfig: {
    autoFocus: true,
    vibrationEnabled: true,
    soundEnabled: true,
    scanDelay: 100,
    batchSize: 100,
    syncInterval: 5,
  },
  notifications: [],
  deviceInfo: null,
  userPreferences: {
    theme: 'auto',
    language: 'en',
    sound_enabled: true,
    vibration_enabled: true,
    notifications_enabled: true,
  },
  appStatus: {
    scanner_connected: false,
    database_ready: false,
    network_available: true,
    last_activity: null,
  },
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setInitialized: (state, action: PayloadAction<boolean>) => {
      state.isInitialized = action.payload;
    },
    
    setLocations: (state, action: PayloadAction<Location[]>) => {
      state.locations = action.payload;
    },
    
    setSelectedLocation: (state, action: PayloadAction<Location | null>) => {
      state.selectedLocation = action.payload;
    },
    
    updateScannerConfig: (state, action: PayloadAction<Partial<ScannerConfig>>) => {
      state.scannerConfig = { ...state.scannerConfig, ...action.payload };
    },
    
    addNotification: (state, action: PayloadAction<{
      type: 'success' | 'error' | 'warning' | 'info';
      title: string;
      message: string;
    }>) => {
      const notification = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
        ...action.payload,
        timestamp: new Date().toISOString(),
        read: false,
      };
      
      state.notifications.unshift(notification);
      
      // Keep only last 100 notifications
      if (state.notifications.length > 100) {
        state.notifications = state.notifications.slice(0, 100);
      }
    },
    
    markNotificationRead: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload);
      if (notification) {
        notification.read = true;
      }
    },
    
    clearNotifications: (state) => {
      state.notifications = [];
    },
    
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(n => n.id !== action.payload);
    },
    
    setDeviceInfo: (state, action: PayloadAction<AppState['deviceInfo']>) => {
      state.deviceInfo = action.payload;
    },
    
    updateUserPreferences: (state, action: PayloadAction<Partial<AppState['userPreferences']>>) => {
      state.userPreferences = { ...state.userPreferences, ...action.payload };
    },
    
    updateAppStatus: (state, action: PayloadAction<Partial<AppState['appStatus']>>) => {
      state.appStatus = { ...state.appStatus, ...action.payload };
    },
    
    setScannerConnected: (state, action: PayloadAction<boolean>) => {
      state.appStatus.scanner_connected = action.payload;
    },
    
    setDatabaseReady: (state, action: PayloadAction<boolean>) => {
      state.appStatus.database_ready = action.payload;
    },
    
    setNetworkAvailable: (state, action: PayloadAction<boolean>) => {
      state.appStatus.network_available = action.payload;
    },
    
    updateLastActivity: (state) => {
      state.appStatus.last_activity = new Date().toISOString();
    },
    
    showSuccessMessage: (state, action: PayloadAction<string>) => {
      const notification = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
        type: 'success' as const,
        title: 'Success',
        message: action.payload,
        timestamp: new Date().toISOString(),
        read: false,
      };
      
      state.notifications.unshift(notification);
    },
    
    showErrorMessage: (state, action: PayloadAction<string>) => {
      const notification = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
        type: 'error' as const,
        title: 'Error',
        message: action.payload,
        timestamp: new Date().toISOString(),
        read: false,
      };
      
      state.notifications.unshift(notification);
    },
    
    showWarningMessage: (state, action: PayloadAction<string>) => {
      const notification = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
        type: 'warning' as const,
        title: 'Warning',
        message: action.payload,
        timestamp: new Date().toISOString(),
        read: false,
      };
      
      state.notifications.unshift(notification);
    },
    
    showInfoMessage: (state, action: PayloadAction<string>) => {
      const notification = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
        type: 'info' as const,
        title: 'Info',
        message: action.payload,
        timestamp: new Date().toISOString(),
        read: false,
      };
      
      state.notifications.unshift(notification);
    },
  },
});

export const {
  setInitialized,
  setLocations,
  setSelectedLocation,
  updateScannerConfig,
  addNotification,
  markNotificationRead,
  clearNotifications,
  removeNotification,
  setDeviceInfo,
  updateUserPreferences,
  updateAppStatus,
  setScannerConnected,
  setDatabaseReady,
  setNetworkAvailable,
  updateLastActivity,
  showSuccessMessage,
  showErrorMessage,
  showWarningMessage,
  showInfoMessage,
} = appSlice.actions;

export default appSlice.reducer;