import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import NetInfo from '@react-native-community/netinfo';
import DatabaseService from '../../services/database';
import { supabaseHelpers } from '../../services/supabase';
import { SyncQueueItem } from '../../../../shared/types';

interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
  pendingItems: number;
  failedItems: number;
  syncProgress: number;
  error: string | null;
  syncHistory: Array<{
    timestamp: string;
    success: boolean;
    itemCount: number;
    error?: string;
  }>;
}

const initialState: SyncState = {
  isOnline: true,
  isSyncing: false,
  lastSyncTime: null,
  pendingItems: 0,
  failedItems: 0,
  syncProgress: 0,
  error: null,
  syncHistory: [],
};

// Store the unsubscribe function globally to avoid Redux serialization issues
let networkUnsubscribe: (() => void) | null = null;

// Async thunks
export const initializeNetworkListener = createAsyncThunk(
  'sync/initializeNetworkListener',
  async (_, { dispatch }) => {
    // Clean up any existing listener
    if (networkUnsubscribe) {
      networkUnsubscribe();
    }

    networkUnsubscribe = NetInfo.addEventListener(state => {
      dispatch(setOnlineStatus(state.isConnected || false));
      
      // Auto-sync when coming back online
      if (state.isConnected) {
        dispatch(syncAllPendingData());
      }
    });

    // Get initial network state
    const initialNetworkState = await NetInfo.fetch();
    dispatch(setOnlineStatus(initialNetworkState.isConnected || false));

    // Return serializable data instead of the function
    return {
      success: true,
      isConnected: initialNetworkState.isConnected || false,
      timestamp: new Date().toISOString(),
    };
  }
);

export const syncAllPendingData = createAsyncThunk(
  'sync/syncAllPendingData',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as any;
      
      if (!state.sync.isOnline) {
        throw new Error('No internet connection');
      }

      // Get pending sync items
      const pendingItems = await DatabaseService.getPendingSyncItems();
      
      if (pendingItems.length === 0) {
        return {
          success: true,
          itemCount: 0,
          timestamp: new Date().toISOString(),
        };
      }

      let successCount = 0;
      let failureCount = 0;
      const errors: string[] = [];

      // Process each sync item
      for (let i = 0; i < pendingItems.length; i++) {
        const item = pendingItems[i];
        
        try {
          await processSyncItem(item);
          await DatabaseService.updateSyncItemStatus(item.id, 'completed');
          successCount++;
        } catch (error) {
          const errorMessage = (error as Error).message;
          await DatabaseService.updateSyncItemStatus(item.id, 'failed', errorMessage);
          await DatabaseService.incrementSyncRetry(item.id);
          failureCount++;
          errors.push(`${item.data_type}: ${errorMessage}`);
        }
      }

      const result = {
        success: failureCount === 0,
        itemCount: pendingItems.length,
        successCount,
        failureCount,
        timestamp: new Date().toISOString(),
        errors: errors.length > 0 ? errors : undefined,
      };

      return result;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const forceSyncNow = createAsyncThunk(
  'sync/forceSyncNow',
  async (_, { dispatch }) => {
    return dispatch(syncAllPendingData());
  }
);

export const cleanupOldSyncData = createAsyncThunk(
  'sync/cleanupOldSyncData',
  async (daysOld: number = 7, { rejectWithValue }) => {
    try {
      await DatabaseService.clearOldData(daysOld);
      return { success: true, daysOld };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const cleanupNetworkListener = () => {
  if (networkUnsubscribe) {
    networkUnsubscribe();
    networkUnsubscribe = null;
  }
};

// Helper function to process individual sync items
async function processSyncItem(item: SyncQueueItem): Promise<void> {
  switch (item.data_type) {
    case 'scan':
      await processScanSync(item);
      break;
    case 'rack_update':
      await processRackUpdateSync(item);
      break;
    case 'user_action':
      await processUserActionSync(item);
      break;
    default:
      throw new Error(`Unknown sync data type: ${item.data_type}`);
  }
}

async function processScanSync(item: SyncQueueItem): Promise<void> {
  const { scanData } = item.payload;
  
  // Add scan to server
  await supabaseHelpers.addScan(scanData);
  
  // Mark local scan as synced
  if (item.payload.scanId) {
    await DatabaseService.markScansAsSynced([item.payload.scanId]);
  }
}

async function processRackUpdateSync(item: SyncQueueItem): Promise<void> {
  const { rackId, action, userId, scanCount } = item.payload;
  
  switch (action) {
    case 'assign':
      await supabaseHelpers.assignRack(rackId, userId);
      break;
    case 'mark_ready':
      await supabaseHelpers.markRackReady(rackId);
      break;
    default:
      throw new Error(`Unknown rack action: ${action}`);
  }
}

async function processUserActionSync(item: SyncQueueItem): Promise<void> {
  // Handle other user actions like profile updates, preferences, etc.
  // Implementation depends on specific user actions
  console.log('Processing user action sync:', item.payload);
}

const syncSlice = createSlice({
  name: 'sync',
  initialState,
  reducers: {
    setOnlineStatus: (state, action: PayloadAction<boolean>) => {
      state.isOnline = action.payload;
    },
    setSyncProgress: (state, action: PayloadAction<number>) => {
      state.syncProgress = action.payload;
    },
    incrementPendingItems: (state) => {
      state.pendingItems += 1;
    },
    decrementPendingItems: (state) => {
      if (state.pendingItems > 0) {
        state.pendingItems -= 1;
      }
    },
    setPendingItemsCount: (state, action: PayloadAction<number>) => {
      state.pendingItems = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    addSyncHistoryEntry: (state, action: PayloadAction<{
      timestamp: string;
      success: boolean;
      itemCount: number;
      error?: string;
    }>) => {
      state.syncHistory.unshift(action.payload);
      // Keep only last 50 entries
      if (state.syncHistory.length > 50) {
        state.syncHistory = state.syncHistory.slice(0, 50);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Initialize network listener
      .addCase(initializeNetworkListener.fulfilled, (state, action) => {
        // Network listener initialized successfully
        state.isOnline = action.payload.isConnected;
      })
      .addCase(initializeNetworkListener.rejected, (state, action) => {
        state.error = 'Failed to initialize network listener';
      })
      
      // Sync all pending data
      .addCase(syncAllPendingData.pending, (state) => {
        state.isSyncing = true;
        state.syncProgress = 0;
        state.error = null;
      })
      .addCase(syncAllPendingData.fulfilled, (state, action) => {
        state.isSyncing = false;
        state.syncProgress = 100;
        state.lastSyncTime = action.payload.timestamp;
        
        // Update pending/failed counts
        if (action.payload.successCount !== undefined) {
          state.pendingItems = Math.max(0, state.pendingItems - action.payload.successCount);
          state.failedItems = action.payload.failureCount || 0;
        }
        
        // Add to sync history
        state.syncHistory.unshift({
          timestamp: action.payload.timestamp,
          success: action.payload.success,
          itemCount: action.payload.itemCount,
          error: action.payload.errors?.join('; '),
        });
        
        // Keep only last 50 entries
        if (state.syncHistory.length > 50) {
          state.syncHistory = state.syncHistory.slice(0, 50);
        }
      })
      .addCase(syncAllPendingData.rejected, (state, action) => {
        state.isSyncing = false;
        state.syncProgress = 0;
        state.error = action.payload as string;
        
        // Add failed sync to history
        state.syncHistory.unshift({
          timestamp: new Date().toISOString(),
          success: false,
          itemCount: 0,
          error: action.payload as string,
        });
      })
      
      // Force sync now
      .addCase(forceSyncNow.fulfilled, (state, action) => {
        // This will be handled by syncAllPendingData
      })
      
      // Cleanup old sync data
      .addCase(cleanupOldSyncData.fulfilled, (state) => {
        // Could add a success message or update UI
      })
      .addCase(cleanupOldSyncData.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const {
  setOnlineStatus,
  setSyncProgress,
  incrementPendingItems,
  decrementPendingItems,
  setPendingItemsCount,
  clearError,
  addSyncHistoryEntry,
} = syncSlice.actions;

export { cleanupNetworkListener };

export default syncSlice.reducer;