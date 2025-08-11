import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Scan } from '../../../../shared/types';
import { supabaseHelpers } from '../../services/supabase';
import DatabaseService from '../../services/database';
import { RootState } from '../index';

interface ScanState {
  scans: Scan[];
  currentRackScans: Scan[];
  isScanning: boolean;
  lastScan: Scan | null;
  scanCount: number;
  isLoading: boolean;
  error: string | null;
  duplicateWarning: string | null;
}

const initialState: ScanState = {
  scans: [],
  currentRackScans: [],
  isScanning: false,
  lastScan: null,
  scanCount: 0,
  isLoading: false,
  error: null,
  duplicateWarning: null,
};

// Async thunks
export const addScan = createAsyncThunk(
  'scans/addScan',
  async (
    scanData: {
      barcode: string;
      rackId: string;
      auditSessionId: string;
      deviceId?: string;
      manualEntry?: boolean;
      notes?: string;
    },
    { getState, rejectWithValue }
  ) => {
    try {
      console.log('🔍 Starting scan process:', scanData);
      
      const state = getState() as RootState;
      const userId = state.auth.user?.id!; // User must be authenticated to reach scanning

      console.log('💾 Creating scan object for:', scanData.barcode);

      const newScan = {
        barcode: scanData.barcode,
        rack_id: scanData.rackId,
        audit_session_id: scanData.auditSessionId,
        scanner_id: userId,
        device_id: scanData.deviceId,
        quantity: 1,
        manual_entry: scanData.manualEntry || false,
        notes: scanData.notes,
      };

      let localScanId = null;
      console.log('💾 Attempting to save to local database:', newScan);
      
      // Phase 1 Safe Optimistic UI: Save locally first (required for fast UI)
      try {
        localScanId = await DatabaseService.addScan(newScan);
        console.log('✅ Local scan added with ID:', localScanId);
      } catch (dbError) {
        console.error('❌ Local database save failed - cannot proceed:', dbError);
        throw new Error('Local save failed - please try again');
      }

      // Return early for UI clearing (optimistic UI)
      const localScanResult = {
        scan: { ...newScan, id: localScanId.toString() }, // Convert to string for consistency
        localId: localScanId.toString(),
        syncPending: true,
      };

      // Background server sync (don't await - let it happen in background)
      setImmediate(async () => {
        try {
          console.log('🌐 Background syncing to server...');
          const serverScan = await supabaseHelpers.addScan({
            ...newScan,
            device_id: scanData.deviceId,
          });
          console.log('✅ Background server sync successful:', serverScan.id);

          // Mark as synced in local database
          try {
            await DatabaseService.markScansAsSynced([localScanId]);
            console.log('✅ Local scan marked as synced');
          } catch (dbError) {
            console.warn('⚠️ Could not mark scan as synced in local DB');
          }
        } catch (syncError) {
          console.warn('⚠️ Background server sync failed, will retry later:', syncError);
          
          // Add to sync queue for later retry
          if (localScanId) {
            try {
              await DatabaseService.addToSyncQueue({
                device_id: scanData.deviceId || 'unknown',
                data_type: 'scan',
                payload: { scanId: localScanId, scanData: newScan },
                status: 'pending',
                retry_count: 0,
              });
            } catch (queueError) {
              console.warn('⚠️ Could not add to sync queue');
            }
          }
        }
      });

      return localScanResult;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const loadRackScans = createAsyncThunk(
  'scans/loadRackScans',
  async (rackId: string, { rejectWithValue }) => {
    try {
      // Try to load from server first
      try {
        const serverScans = await supabaseHelpers.getRackScans(rackId);
        
        // Cache in local database
        for (const scan of serverScans) {
          // Note: This would need a proper upsert method in DatabaseService
        }
        
        return serverScans;
      } catch (serverError) {
        // Fallback to local database
        const localScans = await DatabaseService.getScansForRack(rackId);
        return localScans;
      }
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteScan = createAsyncThunk(
  'scans/deleteScan',
  async (scanId: string, { rejectWithValue }) => {
    try {
      // In a real implementation, you might want to mark as deleted
      // rather than actually deleting, for audit purposes
      throw new Error('Delete functionality not implemented for audit compliance');
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const syncPendingScans = createAsyncThunk(
  'scans/syncPendingScans',
  async (_, { rejectWithValue }) => {
    try {
      const unsyncedScans = await DatabaseService.getUnsyncedScans();
      const syncResults = [];

      for (const scan of unsyncedScans) {
        try {
          const serverScan = await supabaseHelpers.addScan({
            barcode: scan.barcode,
            rack_id: scan.rack_id,
            audit_session_id: scan.audit_session_id,
            scanner_id: scan.scanner_id,
            device_id: scan.device_id,
            quantity: scan.quantity,
            is_recount: scan.is_recount,
            recount_of: scan.recount_of,
            manual_entry: scan.manual_entry,
            notes: scan.notes,
          });

          await DatabaseService.markScansAsSynced([scan.id]);
          syncResults.push({ success: true, scanId: scan.id });
        } catch (error) {
          await DatabaseService.markScanSyncError(scan.id, (error as Error).message);
          syncResults.push({ success: false, scanId: scan.id, error: (error as Error).message });
        }
      }

      return syncResults;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const scanSlice = createSlice({
  name: 'scans',
  initialState,
  reducers: {
    setScanning: (state, action: PayloadAction<boolean>) => {
      state.isScanning = action.payload;
    },
    clearCurrentRackScans: (state) => {
      state.currentRackScans = [];
      state.scanCount = 0;
    },
    clearError: (state) => {
      state.error = null;
    },
    clearDuplicateWarning: (state) => {
      state.duplicateWarning = null;
    },
    updateScanCount: (state, action: PayloadAction<number>) => {
      state.scanCount = action.payload;
    },
    setScanInputFocus: (state, action: PayloadAction<boolean>) => {
      // This could be used to manage scan input focus state
    },
  },
  extraReducers: (builder) => {
    builder
      // Add scan
      .addCase(addScan.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.duplicateWarning = null;
      })
      .addCase(addScan.fulfilled, (state, action) => {
        state.isLoading = false;
        
        if (action.payload.scan) {
          state.currentRackScans.unshift(action.payload.scan);
          state.lastScan = action.payload.scan;
          state.scanCount = state.currentRackScans.length;
        }
        
        // Show sync status in UI (optional - for user awareness)
        if (action.payload.syncPending) {
          // Could add a subtle indicator that sync is happening in background
          console.log('🔄 Scan saved locally, syncing in background...');
        }
      })
      .addCase(addScan.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Load rack scans
      .addCase(loadRackScans.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadRackScans.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentRackScans = action.payload;
        state.scanCount = action.payload.length;
      })
      .addCase(loadRackScans.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Sync pending scans
      .addCase(syncPendingScans.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(syncPendingScans.fulfilled, (state, action) => {
        state.isLoading = false;
        // Could update UI to show sync status
      })
      .addCase(syncPendingScans.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  setScanning,
  clearCurrentRackScans,
  clearError,
  clearDuplicateWarning,
  updateScanCount,
  setScanInputFocus,
} = scanSlice.actions;

export default scanSlice.reducer;