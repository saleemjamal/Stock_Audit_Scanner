import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { supabase } from '../../services/supabase';
import { googleSignIn } from '../../services/googleSignIn';
import { User } from '../../../../shared/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

// SIMPLE AUTH: Just Google Sign-In → Supabase → Business Profile
export const signInWithGoogle = createAsyncThunk(
  'auth/signInWithGoogle',
  async (_, { rejectWithValue }) => {
    try {
      // 1. Native Google Sign-In
      const googleResult = await googleSignIn.signIn();
      
      // 2. Authenticate with Supabase using Google token
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: googleResult.idToken,
      });
      
      if (error) throw error;
      
      // 3. Create/update business profile (using SAME UUID from auth.users)
      const { data: userProfile } = await supabase
        .from('users')
        .upsert({
          id: data.user.id,                                    // Same UUID as auth.users
          email: data.user.email,
          full_name: googleResult.user.name || data.user.user_metadata.full_name || '',
          role: data.user.email === 'saleem@poppatjamals.com' ? 'superuser' : 'scanner',
          location_ids: data.user.email === 'saleem@poppatjamals.com' ? [] : [],
          active: true,
          last_login_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      return userProfile;
    } catch (error: any) {
      await googleSignIn.signOut(); // Clean up on error
      return rejectWithValue(error.message);
    }
  }
);

export const initializeAuth = createAsyncThunk(
  'auth/initialize',
  async () => {
    // Check if user has Supabase session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return null;
    }
    
    // Get business profile
    const { data: userProfile } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)  // Use auth.users UUID
      .single();
    
    return userProfile;
  }
);

export const signOut = createAsyncThunk(
  'auth/signOut',
  async () => {
    await Promise.all([
      googleSignIn.signOut(),
      supabase.auth.signOut()
    ]);
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Google Sign-In
      .addCase(signInWithGoogle.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(signInWithGoogle.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(signInWithGoogle.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Initialize
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isAuthenticated = !!action.payload;
        state.isLoading = false;
      })
      
      // Sign out
      .addCase(signOut.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.isLoading = false;
        state.error = null;
      });
  },
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer;