import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Rack, AuditSession } from '../../../../shared/types';
import { supabaseHelpers } from '../../services/supabase';
import DatabaseService from '../../services/database';
import { RootState } from '../index';

interface RackState {
  availableRacks: Rack[];
  userRacks: Rack[];
  currentRack: Rack | null;
  currentAuditSession: AuditSession | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: RackState = {
  availableRacks: [],
  userRacks: [],
  currentRack: null,
  currentAuditSession: null,
  isLoading: false,
  error: null,
};

// Async thunks
export const loadAuditSession = createAsyncThunk(
  'racks/loadAuditSession',
  async (locationId: number, { rejectWithValue }) => {
    try {
      const auditSession = await supabaseHelpers.getActiveAuditSession(locationId);
      
      if (!auditSession) {
        throw new Error('No active audit session found for this location');
      }

      return auditSession;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const loadAvailableRacks = createAsyncThunk(
  'racks/loadAvailableRacks',
  async (auditSessionId: string, { rejectWithValue }) => {
    try {
      console.log('🔍 RACK_SLICE_DEBUG: Loading racks directly from Supabase...');
      const racks = await supabaseHelpers.getAvailableRacks(auditSessionId);
      console.log('🔍 RACK_SLICE_DEBUG: Racks fetched from Supabase:', racks?.length || 0);
      
      return racks;
    } catch (error: any) {
      console.error('🔍 RACK_SLICE_DEBUG: Fatal error in loadAvailableRacks:', error);
      return rejectWithValue(error.message);
    }
  }
);

export const loadUserRacks = createAsyncThunk(
  'racks/loadUserRacks',
  async (auditSessionId: string, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const userId = state.auth.user?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      console.log('🔍 RACK_SLICE_DEBUG: Loading user racks directly from Supabase...');
      const racks = await supabaseHelpers.getUserRacks(auditSessionId, userId);
      console.log('🔍 RACK_SLICE_DEBUG: User racks fetched from Supabase:', racks?.length || 0);
      
      return racks;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const assignRack = createAsyncThunk(
  'racks/assignRack',
  async (rackId: string, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const userId = state.auth.user?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      console.log('🔍 RACK_SLICE_DEBUG: Assigning rack directly via Supabase...');
      const assignedRack = await supabaseHelpers.assignRack(rackId, userId);
      console.log('🔍 RACK_SLICE_DEBUG: Rack assigned successfully:', assignedRack.id);
      
      return assignedRack;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const markRackReady = createAsyncThunk(
  'racks/markRackReady',
  async (rackId: string, { getState, rejectWithValue }) => {
    try {
      console.log('✅ RackSlice: markRackReady starting for:', rackId);
      const state = getState() as RootState;

      // Get scan count from Redux state instead of local database
      const scanCount = state.scans.scanCount;
      console.log('✅ RackSlice: Current scan count from Redux:', scanCount);
      
      if (scanCount === 0) {
        throw new Error('Cannot mark empty rack as ready for approval');
      }

      // Mark ready on server (simplified - no local database calls)
      console.log('✅ RackSlice: Calling supabaseHelpers.markRackReady...');
      const updatedRack = await supabaseHelpers.markRackReady(rackId);
      
      console.log('✅ RackSlice: markRackReady successful:', updatedRack);
      return updatedRack;
    } catch (error: any) {
      console.error('❌ RackSlice: markRackReady failed:', error);
      return rejectWithValue(error.message);
    }
  }
);

export const refreshRackData = createAsyncThunk(
  'racks/refreshRackData',
  async (_, { getState, dispatch }) => {
    const state = getState() as RootState;
    const auditSessionId = state.racks.currentAuditSession?.id;
    
    if (auditSessionId) {
      await dispatch(loadAvailableRacks(auditSessionId));
      await dispatch(loadUserRacks(auditSessionId));
    }
  }
);

const rackSlice = createSlice({
  name: 'racks',
  initialState,
  reducers: {
    setCurrentRack: (state, action: PayloadAction<Rack | null>) => {
      state.currentRack = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    updateRackInList: (state, action: PayloadAction<Rack>) => {
      const rack = action.payload;
      
      // Update in available racks
      const availableIndex = state.availableRacks.findIndex(r => r.id === rack.id);
      if (availableIndex !== -1) {
        state.availableRacks[availableIndex] = rack;
      }
      
      // Update in user racks
      const userIndex = state.userRacks.findIndex(r => r.id === rack.id);
      if (userIndex !== -1) {
        state.userRacks[userIndex] = rack;
      }
      
      // Update current rack if it matches
      if (state.currentRack?.id === rack.id) {
        state.currentRack = rack;
      }
    },
    addToUserRacks: (state, action: PayloadAction<Rack>) => {
      const rack = action.payload;
      
      // Remove from available racks
      state.availableRacks = state.availableRacks.filter(r => r.id !== rack.id);
      
      // Add to user racks if not already present
      if (!state.userRacks.find(r => r.id === rack.id)) {
        state.userRacks.unshift(rack);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Load audit session
      .addCase(loadAuditSession.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadAuditSession.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentAuditSession = action.payload;
      })
      .addCase(loadAuditSession.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Load available racks
      .addCase(loadAvailableRacks.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadAvailableRacks.fulfilled, (state, action) => {
        console.log('🔍 RACK_REDUCER_DEBUG: loadAvailableRacks.fulfilled called with:', action.payload?.length, 'racks');
        state.isLoading = false;
        state.availableRacks = action.payload;
        console.log('🔍 RACK_REDUCER_DEBUG: State updated, availableRacks now has:', state.availableRacks.length, 'racks');
      })
      .addCase(loadAvailableRacks.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Load user racks
      .addCase(loadUserRacks.fulfilled, (state, action) => {
        state.userRacks = action.payload;
      })

      // Assign rack
      .addCase(assignRack.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(assignRack.fulfilled, (state, action) => {
        state.isLoading = false;
        
        if (action.payload) {
          // Move from available to user racks
          state.availableRacks = state.availableRacks.filter(r => r.id !== action.payload.id);
          
          const existingIndex = state.userRacks.findIndex(r => r.id === action.payload.id);
          if (existingIndex !== -1) {
            state.userRacks[existingIndex] = action.payload;
          } else {
            state.userRacks.unshift(action.payload);
          }
          
          state.currentRack = action.payload;
        }
      })
      .addCase(assignRack.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Mark rack ready
      .addCase(markRackReady.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(markRackReady.fulfilled, (state, action) => {
        state.isLoading = false;
        
        if (action.payload) {
          // Update rack in user racks
          const index = state.userRacks.findIndex(r => r.id === action.payload.id);
          if (index !== -1) {
            state.userRacks[index] = action.payload;
          }
          
          // Update current rack if it matches
          if (state.currentRack?.id === action.payload.id) {
            state.currentRack = action.payload;
          }
        }
      })
      .addCase(markRackReady.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  setCurrentRack,
  clearError,
  updateRackInList,
  addToUserRacks,
} = rackSlice.actions;

export default rackSlice.reducer;