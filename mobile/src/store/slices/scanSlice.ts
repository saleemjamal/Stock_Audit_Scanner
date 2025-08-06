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
      const state = getState() as RootState;
      const userId = state.auth.user?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Check for duplicates in current rack
      const existingScans = await DatabaseService.getScansForRack(scanData.rackId);
      const isDuplicate = existingScans.some(scan => scan.barcode === scanData.barcode);

      const newScan = {
        barcode: scanData.barcode,
        rack_id: scanData.rackId,
        audit_session_id: scanData.auditSessionId,
        scanner_id: userId,
        device_id: scanData.deviceId,
        quantity: 1,
        is_recount: isDuplicate,
        recount_of: isDuplicate ? existingScans.find(s => s.barcode === scanData.barcode)?.id : undefined,
        manual_entry: scanData.manualEntry || false,
        notes: scanData.notes,
      };

      // Add to local database first
      const localScanId = await DatabaseService.addScan(newScan);

      // Try to sync to server
      try {
        const serverScan = await supabaseHelpers.addScan({
          ...newScan,
          device_id: scanData.deviceId,
        });

        // Mark as synced in local database
        await DatabaseService.markScansAsSynced([localScanId]);

        return {
          scan: serverScan,
          isDuplicate,
          localId: localScanId,
        };
      } catch (syncError) {
        // If sync fails, add to sync queue
        await DatabaseService.addToSyncQueue({
          device_id: scanData.deviceId || 'unknown',
          data_type: 'scan',
          payload: { scanId: localScanId, scanData: newScan },
          status: 'pending',
          retry_count: 0,
        });

        // Return local scan with sync pending
        const localScan = (await DatabaseService.getScansForRack(scanData.rackId))
          .find(s => s.id === localScanId);

        return {
          scan: localScan,
          isDuplicate,
          localId: localScanId,
          syncPending: true,
        };
      }
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

        if (action.payload.isDuplicate) {
          state.duplicateWarning = `Duplicate scan detected for ${action.payload.scan?.barcode}`;
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