import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { supabase, supabaseHelpers } from '../../services/supabase';
import { User } from '../../../../shared/types';
import Config from 'react-native-config';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  session: any;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  session: null,
};

// Async thunks
export const initializeAuth = createAsyncThunk(
  'auth/initialize',
  async (_, { rejectWithValue }) => {
    try {
      // Check if we have a stored user session (you might want to use AsyncStorage)
      const storedUser = null; // Replace with AsyncStorage.getItem('user') if needed
      return { session: null, user: storedUser };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const signInWithPassword = createAsyncThunk(
  'auth/signInWithPassword',
  async ({ username, password }: { username: string; password: string }, { rejectWithValue }) => {
    try {
      // Use our custom RPC function instead of Supabase Auth
      const { data, error } = await supabase
        .rpc('login_with_username', {
          p_username: username,
          p_password: password
        });
      
      if (error) throw error;
      
      if (!data.success) {
        throw new Error(data.message || 'Invalid username or password');
      }
      
      // Enforce single session - revoke other sessions
      if (data.access_token) {
        try {
          const response = await fetch(`${Config.SUPABASE_URL}/functions/v1/single-session-login`, {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${data.access_token}`,
              'Content-Type': 'application/json'
            }
          });
          const result = await response.json();
          console.log('Session cleanup:', result);
        } catch (error) {
          console.warn('Session cleanup failed:', error);
          // Continue anyway - not critical for functionality
        }
      }
      
      // Create a mock session for compatibility
      const mockSession = {
        user: {
          id: data.user.id,
          email: data.user.email,
        }
      };
      
      return { 
        session: mockSession, 
        user: data.user as User 
      };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const signOut = createAsyncThunk(
  'auth/signOut',
  async (_, { rejectWithValue }) => {
    try {
      // Clear any stored session (you might want to use AsyncStorage)
      // await AsyncStorage.removeItem('user');
      return { success: true };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (updates: Partial<User>, { getState, rejectWithValue }: any) => {
    try {
      const { auth } = getState();
      const userId = auth.user?.id;
      
      if (!userId) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
      
      if (error) throw error;
      
      return data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession: (state, action: PayloadAction<any>) => {
      state.session = action.payload;
      state.isAuthenticated = !!action.payload;
    },
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Initialize auth
      .addCase(initializeAuth.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        state.session = action.payload.session;
        state.user = action.payload.user;
        state.isAuthenticated = !!action.payload.session;
      })
      .addCase(initializeAuth.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      })
      
      // Sign in with password
      .addCase(signInWithPassword.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(signInWithPassword.fulfilled, (state, action) => {
        state.isLoading = false;
        state.session = action.payload.session;
        state.user = action.payload.user;
        state.isAuthenticated = true;
      })
      .addCase(signInWithPassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Sign out
      .addCase(signOut.fulfilled, (state) => {
        state.user = null;
        state.session = null;
        state.isAuthenticated = false;
        state.isLoading = false;
        state.error = null;
      })
      .addCase(signOut.rejected, (state, action) => {
        state.error = action.payload as string;
      })
      
      // Update profile
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.user = action.payload;
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const { setSession, setUser, clearError, setLoading } = authSlice.actions;
export default authSlice.reducer;