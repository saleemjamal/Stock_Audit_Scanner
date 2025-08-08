import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { supabase, supabaseHelpers } from '../../services/supabase';
import { getUserEmail, getUsernameFromEmail } from '../../utils/authHelpers';
import { googleSignIn } from '../../services/googleSignIn';
import { User } from '../../../../shared/types';

// AUTHENTICATION SECURITY MODEL:
// - Uses Google OAuth for authentication
// - Implements WHITELISTING: only pre-authorized users can access system
// - Users must be pre-added to 'users' table by superuser before they can sign in
// - Unauthorized Google accounts are immediately blocked with clear error message
// - No auto-user creation - maintains strict access control

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
      console.log('🔐 DEBUG: Getting session from Supabase...');
      const { data: { session }, error } = await supabase.auth.getSession();
      
      console.log('🔐 DEBUG: Session check result:', { 
        hasSession: !!session, 
        hasUser: !!session?.user,
        email: session?.user?.email,
        error: error?.message 
      });
      
      if (error) {
        console.error('🔐 DEBUG: Session error:', error);
        throw error;
      }
      
      if (session?.user) {
        console.log('🔐 DEBUG: Session found, looking up user profile for:', session.user.email);
        
        // Get user profile by email (Google OAuth uses email)
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('email', session.user.email)
          .single();
        
        console.log('🔐 DEBUG: User profile lookup result:', { 
          hasProfile: !!userProfile,
          profile: userProfile,
          error: profileError?.code,
          errorMessage: profileError?.message 
        });
          
        if (profileError) {
          if (profileError.code === 'PGRST116') {
            console.error('🔐 DEBUG: User not found in database');
            throw new Error(`Your account (${session.user.email}) is not authorized for this system.`);
          }
          console.error('🔐 DEBUG: Profile lookup error:', profileError);
          throw profileError;
        }
        
        console.log('🔐 DEBUG: Returning session and user profile');
        return { session, user: userProfile };
      }
      
      console.log('🔐 DEBUG: No session found');
      return { session: null, user: null };
    } catch (error: any) {
      console.error('🔐 DEBUG: initializeAuth error:', error);
      return rejectWithValue(error.message);
    }
  }
);

export const signInWithPassword = createAsyncThunk(
  'auth/signInWithPassword',
  async ({ username, password }: { username: string; password: string }, { rejectWithValue }) => {
    try {
      // Convert username to email using our mapping
      const email = getUserEmail(username);
      
      // Sign in with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      if (data.session?.user) {
        // Get user profile by email (Google OAuth uses email)
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('email', data.session.user.email)
          .single();

        if (profileError) {
          if (profileError.code === 'PGRST116') {
            throw new Error(`Your account (${data.session.user.email}) is not authorized for this system.`);
          }
          throw profileError;
        }

        return { session: data.session, user: userProfile };
      }
      
      throw new Error('Login failed');
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const signInWithGoogle = createAsyncThunk(
  'auth/signInWithGoogle',
  async (_, { rejectWithValue }) => {
    try {
      console.log('🔐 GOOGLE_AUTH: Starting native Google Sign-In');
      
      // Sign in with native Google SDK
      const googleResult = await googleSignIn.signIn();
      
      if (!googleResult.idToken) {
        throw new Error('No ID token received from Google Sign-In');
      }
      
      console.log('🔐 GOOGLE_AUTH: Google sign-in successful, authenticating with Supabase');
      
      // Sign in to Supabase using the Google ID token
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: googleResult.idToken,
      });
      
      if (error) {
        console.error('🔐 GOOGLE_AUTH: Supabase authentication error:', error);
        throw error;
      }
      
      if (data.session?.user) {
        console.log('🔐 GOOGLE_AUTH: Looking up user profile for:', data.session.user.email);
        
        // Get user profile by email
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('email', data.session.user.email)
          .single();
        
        if (profileError) {
          if (profileError.code === 'PGRST116') {
            // User doesn't exist in our database - block access (whitelisting)
            console.log('🔐 GOOGLE_AUTH: User not found in whitelist:', data.session.user.email);
            
            // Sign out the user immediately for security
            await supabase.auth.signOut();
            
            throw new Error(
              `Access denied. Your Google account (${data.session.user.email}) is not authorized for this system. ` +
              'Only pre-approved users can access the mobile app. Please contact a system administrator ' +
              '(saleem@poppatjamals.com) to be added to the authorized user list.'
            );
          }
          throw profileError;
        }
        
        console.log('🔐 GOOGLE_AUTH: Authentication complete');
        return { session: data.session, user: userProfile };
      }
      
      throw new Error('Authentication failed');
    } catch (error: any) {
      console.error('🔐 GOOGLE_AUTH: Error:', error);
      await googleSignIn.signOut(); // Clean up on error
      return rejectWithValue(error.message);
    }
  }
);

export const signInWithSupabaseOAuth = createAsyncThunk(
  'auth/signInWithSupabaseOAuth',
  async ({ provider }: { provider: 'google' }, { rejectWithValue }) => {
    try {
      console.log('🔐 OAUTH: Starting OAuth flow with provider:', provider);
      
      // Use Supabase's OAuth flow (will open browser)
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: 'https://lgiljudekiobysjsuepo.supabase.co/auth/v1/callback',
        },
      });
      
      console.log('🔐 OAUTH: Supabase response:', { data, error });
      
      if (error) {
        console.error('OAuth error:', error);
        throw error;
      }
      
      if (!data || !data.url) {
        throw new Error('No OAuth URL returned from Supabase');
      }
      
      console.log('🔐 OAUTH: Generated URL:', data.url);
      
      // OAuth flow will redirect back to app, session will be handled by auth state change
      return { success: true, url: data.url };
    } catch (error: any) {
      console.error('signInWithSupabaseOAuth error:', error);
      return rejectWithValue(error.message);
    }
  }
);

export const signOut = createAsyncThunk(
  'auth/signOut',
  async (_, { rejectWithValue }) => {
    try {
      // Sign out from Google if signed in
      const isGoogleSignedIn = await googleSignIn.isSignedIn();
      if (isGoogleSignedIn) {
        await googleSignIn.signOut();
      }
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
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
        state.isAuthenticated = !!action.payload.session;
      })
      .addCase(signInWithPassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Google Sign-In
      .addCase(signInWithGoogle.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(signInWithGoogle.fulfilled, (state, action) => {
        state.isLoading = false;
        state.session = action.payload.session;
        state.user = action.payload.user;
        state.isAuthenticated = true;
      })
      .addCase(signInWithGoogle.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      })
      
      // Supabase OAuth
      .addCase(signInWithSupabaseOAuth.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(signInWithSupabaseOAuth.fulfilled, (state) => {
        state.isLoading = false;
        // Session will be set by initializeAuth when user returns from OAuth
      })
      .addCase(signInWithSupabaseOAuth.rejected, (state, action) => {
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