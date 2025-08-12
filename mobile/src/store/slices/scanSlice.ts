import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Scan } from '../../../../shared/types';
import { supabaseHelpers } from '../../services/supabase';

interface ScanState {
  currentRackScans: Scan[];
  scanCount: number;
  isLoading: boolean;
  error: string | null;
}

const initialState: ScanState = {
  currentRackScans: [],
  scanCount: 0,
  isLoading: false,
  error: null,
};

// Simplified async thunk - just for loading rack scans from server
// Scan creation now happens through ScanQueueProvider

export const loadRackScans = createAsyncThunk(
  'scans/loadRackScans',
  async (rackId: string, { rejectWithValue }) => {
    try {
      // Direct API call - no local database caching
      const serverScans = await supabaseHelpers.getRackScans(rackId);
      return serverScans;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

// Removed deleteScan and syncPendingScans - these are handled by the queue system

const scanSlice = createSlice({
  name: 'scans',
  initialState,
  reducers: {
    clearCurrentRackScans: (state) => {
      state.currentRackScans = [];
      state.scanCount = 0;
    },
    clearError: (state) => {
      state.error = null;
    },
    updateScanCount: (state, action: PayloadAction<number>) => {
      state.scanCount = action.payload;
    },
    // Add scan to local state (called from queue system)
    addScanToState: (state, action: PayloadAction<Scan>) => {
      state.currentRackScans.unshift(action.payload);
      state.scanCount = state.currentRackScans.length;
    },
  },
  extraReducers: (builder) => {
    builder
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
      });
  },
});

export const {
  clearCurrentRackScans,
  clearError,
  updateScanCount,
  addScanToState,
} = scanSlice.actions;

export default scanSlice.reducer;