# Supabase Authentication Migration Guide

## ⚠️ IMPORTANT: BACKUP FIRST

**This migration will modify your working authentication system. Follow backup procedures before starting.**

## Overview

We're migrating from a **custom authentication system** (RPC functions + manual password hashing) to **Supabase Auth** (built-in authentication with automatic session management).

### What Changes
- ❌ Remove: Custom `login_with_username` RPC function
- ❌ Remove: Manual password hashing in users table
- ❌ Remove: Custom session management
- ✅ Add: Supabase Auth integration
- ✅ Add: Automatic session management
- ✅ Add: Standard authentication patterns

### What Stays the Same
- ✅ All business logic (locations, racks, scans)
- ✅ Role-based access control
- ✅ Username/password login (mapped to email)
- ✅ All UI screens and workflows

---

## Phase 1: Pre-Migration Setup (15 minutes)

### Step 1.1: Backup Current System

```bash
# 1. Backup entire project
cd C:\Projects\Stock_Audit
git add .
git commit -m "Backup before Supabase Auth migration"

# 2. Export current database (via Supabase Dashboard)
# - Go to Settings > Database
# - Click "Download backup"
# - Save as "stock_audit_backup_pre_migration.sql"
```

### Step 1.2: Configure Supabase Auth Settings

**In Supabase Dashboard:**

1. **Go to Authentication > Settings**
2. **Disable Email Confirmation:**
   - Find "Enable email confirmations"
   - Turn **OFF** 
   - Click "Save"
3. **Configure Password Requirements:**
   - Minimum password length: 6
   - Save settings
4. **Site URL Configuration:**
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/dashboard`

### Step 1.3: Test Current System Works

```bash
# Verify current system before migration
cd mobile
npx react-native run-android

# Test these work:
# 1. Login with saleem/password123
# 2. See locations
# 3. Web dashboard login
```

**✅ Checkpoint:** Current system fully working before migration

---

## Phase 2: Database Migration (30 minutes)

### Step 2.1: Create Migration Scripts

Create these SQL scripts in `supabase/` folder:

#### Script 20: Backup Current Users

```sql
-- 20_backup_current_users.sql
-- Create backup of current users before migration

-- Create backup table
CREATE TABLE users_backup_pre_migration AS 
SELECT * FROM users;

-- Verify backup
SELECT 'Backup Created' as status, COUNT(*) as user_count 
FROM users_backup_pre_migration;

-- Show current users
SELECT username, email, role, active, has_password
FROM users_backup_pre_migration
ORDER BY role, username;
```

#### Script 21: Create Auth Users

```sql
-- 21_create_auth_users.sql
-- Create Supabase Auth users for existing users

-- Create saleem (superuser)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'saleem@poppatjamals.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"username": "saleem", "role": "superuser"}'
);

-- Create supervisor1
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'supervisor1@test.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"username": "supervisor1", "role": "supervisor"}'
);

-- Create scanner1
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'scanner1@test.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"username": "scanner1", "role": "scanner"}'
);

-- Verify auth users created
SELECT 'Auth Users Created' as status;
SELECT email, raw_user_meta_data->>'username' as username, raw_user_meta_data->>'role' as role
FROM auth.users 
WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com');
```

#### Script 22: Update Users Table Schema

```sql
-- 22_update_users_table_schema.sql
-- Modify users table to work with Supabase Auth

-- Drop old constraints and columns
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_unique;
DROP INDEX IF EXISTS users_username_unique;

-- Remove custom auth columns
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;
ALTER TABLE users DROP COLUMN IF EXISTS has_password;
ALTER TABLE users DROP COLUMN IF EXISTS last_login;

-- Keep username for display purposes but remove uniqueness requirement
ALTER TABLE users ALTER COLUMN username DROP NOT NULL;

-- Add Supabase Auth integration
-- The users.id will now reference auth.users.id
```

#### Script 23: Migrate User Data

```sql
-- 23_migrate_user_data.sql
-- Link existing user records to new auth users

-- Update users table with auth user IDs
UPDATE users SET 
  id = (SELECT id FROM auth.users WHERE email = 'saleem@poppatjamals.com'),
  email = 'saleem@poppatjamals.com'
WHERE username = 'saleem';

UPDATE users SET 
  id = (SELECT id FROM auth.users WHERE email = 'supervisor1@test.com'),
  email = 'supervisor1@test.com'
WHERE username = 'supervisor1';

UPDATE users SET 
  id = (SELECT id FROM auth.users WHERE email = 'scanner1@test.com'),
  email = 'scanner1@test.com'
WHERE username = 'scanner1';

-- Update all foreign key references
UPDATE audit_sessions SET 
  started_by = (SELECT id FROM users WHERE username = 'saleem')
WHERE started_by = (SELECT id FROM users_backup_pre_migration WHERE username = 'saleem');

-- Verify migration
SELECT 'User Migration Complete' as status;
SELECT u.username, u.email, u.role, 
       CASE WHEN au.id IS NOT NULL THEN 'Linked' ELSE 'Missing' END as auth_status
FROM users u
LEFT JOIN auth.users au ON u.id = au.id;
```

#### Script 24: Remove Custom Auth Functions

```sql
-- 24_remove_custom_auth.sql
-- Clean up old custom authentication system

-- Drop custom RPC functions
DROP FUNCTION IF EXISTS public.login_with_username(text, text);
DROP FUNCTION IF EXISTS public.authenticate_user(text, text);

-- Remove RPC permissions
-- (These were granted to anon/authenticated roles)

-- Verify cleanup
SELECT 'Custom Auth Functions Removed' as status;

-- Verify no remaining custom auth code
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%login%' OR routine_name LIKE '%auth%';
```

#### Script 25: Enable Row Level Security

```sql
-- 25_enable_rls_for_auth.sql
-- Update RLS policies to work with Supabase Auth

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

-- Only superusers can view all users
CREATE POLICY "Superusers can view all users" ON users
  FOR SELECT USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'superuser'
  );

-- Only superusers can manage users
CREATE POLICY "Only superusers can manage users" ON users
  FOR ALL USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'superuser'
  );

-- Update other table policies to use auth.uid()
-- Locations
DROP POLICY IF EXISTS "Users can view assigned locations" ON locations;
CREATE POLICY "Users can view assigned locations" ON locations
  FOR SELECT USING (
    id = ANY((SELECT location_ids FROM users WHERE id = auth.uid())::int[])
    OR
    (SELECT role FROM users WHERE id = auth.uid()) = 'superuser'
  );

-- Audit sessions  
DROP POLICY IF EXISTS "Users can view location sessions" ON audit_sessions;
CREATE POLICY "Users can view location sessions" ON audit_sessions
  FOR SELECT USING (
    location_id = ANY((SELECT location_ids FROM users WHERE id = auth.uid())::int[])
    OR
    (SELECT role FROM users WHERE id = auth.uid()) = 'superuser'
  );

-- Racks
DROP POLICY IF EXISTS "Users can view location racks" ON racks;
CREATE POLICY "Users can view location racks" ON racks
  FOR SELECT USING (
    location_id = ANY((SELECT location_ids FROM users WHERE id = auth.uid())::int[])
    OR
    (SELECT role FROM users WHERE id = auth.uid()) = 'superuser'
  );

-- Scans
DROP POLICY IF EXISTS "Users can view their scans" ON scans;
CREATE POLICY "Users can view their scans" ON scans
  FOR SELECT USING (
    scanner_id = auth.uid()
    OR
    (SELECT role FROM users WHERE id = auth.uid()) IN ('supervisor', 'superuser')
  );

SELECT 'RLS Policies Updated for Supabase Auth' as status;
```

### Step 2.2: Execute Migration Scripts

**Run these in order in Supabase SQL Editor:**

1. ✅ Run `20_backup_current_users.sql`
2. ✅ Run `21_create_auth_users.sql` 
3. ✅ Run `22_update_users_table_schema.sql`
4. ✅ Run `23_migrate_user_data.sql`
5. ✅ Run `24_remove_custom_auth.sql`
6. ✅ Run `25_enable_rls_for_auth.sql`

**✅ Checkpoint:** Database migration complete, verify all scripts succeeded

---

## Phase 3: Mobile App Migration (45 minutes)

### Step 3.1: Create Username-Email Mapping

Create `mobile/src/utils/authHelpers.ts`:

```typescript
// Username to email mapping for login
const USERNAME_EMAIL_MAP: Record<string, string> = {
  'saleem': 'saleem@poppatjamals.com',
  'supervisor1': 'supervisor1@test.com',
  'scanner1': 'scanner1@test.com',
};

export const getUserEmail = (username: string): string => {
  return USERNAME_EMAIL_MAP[username] || `${username}@poppatjamals.com`;
};

export const getUsernameFromEmail = (email: string): string => {
  const entry = Object.entries(USERNAME_EMAIL_MAP).find(([_, emailAddr]) => emailAddr === email);
  return entry?.[0] || email.split('@')[0];
};
```

### Step 3.2: Update Auth Slice

Replace `mobile/src/store/slices/authSliceWorkaround.ts` with:

```typescript
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { supabase } from '../../services/supabase';
import { getUserEmail } from '../../utils/authHelpers';
import { User } from '../../../../shared/types';

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

// Initialize auth - check existing session
export const initializeAuth = createAsyncThunk(
  'auth/initialize',
  async (_, { rejectWithValue }) => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) throw error;
      
      if (session?.user) {
        // Get user profile from our users table
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profileError) throw profileError;

        return { session, user: userProfile };
      }
      
      return { session: null, user: null };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

// Sign in with username/password (converted to email)
export const signInWithPassword = createAsyncThunk(
  'auth/signInWithPassword',
  async ({ username, password }: { username: string; password: string }, { rejectWithValue }) => {
    try {
      // Convert username to email
      const email = getUserEmail(username);
      
      // Sign in with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      if (data.session?.user) {
        // Get user profile from our users table
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.session.user.id)
          .single();

        if (profileError) throw profileError;

        return { session: data.session, user: userProfile };
      }
      
      throw new Error('Login failed');
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

// Sign out
export const signOut = createAsyncThunk(
  'auth/signOut',
  async (_, { rejectWithValue }) => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      return { success: true };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

// Update profile
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
      
      // Sign in
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
```

### Step 3.3: Update Supabase Helpers

Update `mobile/src/services/supabase.ts`, replace `getUserLocations` function:

```typescript
// Get locations for user - Updated for Supabase Auth
async getUserLocations(userId: string) {
  // Get user profile using Supabase Auth user ID
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('location_ids')
    .eq('id', userId)
    .single();
  
  if (profileError) throw profileError;
  
  // Get locations based on user's location_ids
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .in('id', profile.location_ids || [])
    .eq('active', true);
  
  if (error) throw error;
  return data;
},
```

### Step 3.4: Update Store Configuration

Update `mobile/src/store/index.ts`, change import:

```typescript
// Change this line:
import authReducer from './slices/authSliceWorkaround';

// To this:
import authReducer from './slices/authSlice';
```

### Step 3.5: Update Login Screen Import

Update `mobile/src/screens/auth/LoginScreen.tsx`, change import:

```typescript
// Change this line:
import { signInWithPassword, clearError } from '../../store/slices/authSliceWorkaround';

// To this:
import { signInWithPassword, clearError } from '../../store/slices/authSlice';
```

**✅ Checkpoint:** Mobile app code updated for Supabase Auth

---

## Phase 4: Web Dashboard Migration (30 minutes)

### Step 4.1: Update Login Page

Update `dashboard/src/app/auth/login/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Container,
  Alert,
  CircularProgress,
  TextField,
  InputAdornment,
  IconButton,
} from '@mui/material'
import { Visibility, VisibilityOff, Login as LoginIcon } from '@mui/icons-material'
import { createClient } from '@/lib/supabase'

// Username to email mapping
const USERNAME_EMAIL_MAP: Record<string, string> = {
  'saleem': 'saleem@poppatjamals.com',
  'supervisor1': 'supervisor1@test.com',
  'scanner1': 'scanner1@test.com',
};

const getUserEmail = (username: string): string => {
  return USERNAME_EMAIL_MAP[username] || `${username}@poppatjamals.com`;
};

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password')
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Convert username to email
      const email = getUserEmail(username);

      // Sign in with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw new Error('Invalid username or password')
      }

      if (data.session?.user) {
        // Get user profile to check role
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.session.user.id)
          .single()

        if (profileError) {
          throw new Error('Unable to load user profile')
        }

        // Check if user has dashboard access (supervisor or superuser only)
        if (userProfile.role === 'scanner') {
          await supabase.auth.signOut() // Sign them out
          throw new Error('Access denied. Scanners should use the mobile app.')
        }

        // Redirect to dashboard on success
        router.push('/dashboard')
      }
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Card sx={{ width: '100%', maxWidth: 400 }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Typography variant="h4" component="h1" gutterBottom>
                Stock Audit Dashboard
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Sign in to manage inventory audits
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSignIn} sx={{ mt: 1 }}>
              <TextField
                margin="normal"
                required
                fullWidth
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                disabled={loading}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        disabled={loading}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                startIcon={loading ? <CircularProgress size={20} /> : <LoginIcon />}
                disabled={loading || !username.trim() || !password.trim()}
                sx={{ mt: 3, mb: 2, py: 1.5 }}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </Box>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 3, textAlign: 'center' }}
            >
              Supervisors and administrators only.
              <br />
              Contact your administrator for login credentials.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Container>
  )
}
```

### Step 4.2: Update Dashboard Page

Update `dashboard/src/app/dashboard/page.tsx`:

```typescript
'use client'

import { Suspense, useEffect, useState } from 'react'
import { Box, Grid, Typography, Card, CardContent, CircularProgress } from '@mui/material'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import AuditOverview from '@/components/AuditOverview'
import RecentActivity from '@/components/RecentActivity'
import PendingApprovals from '@/components/PendingApprovals'
import LocationStats from '@/components/LocationStats'

export default function DashboardPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) throw error
      
      if (!session) {
        router.push('/auth/login')
        return
      }

      // Get user profile
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (profileError) {
        console.error('Error loading user profile:', profileError)
        router.push('/auth/login')
        return
      }

      // Allow supervisors and superusers only (block scanners)
      if (userProfile.role === 'scanner') {
        await supabase.auth.signOut()
        router.push('/auth/login?error=insufficient_permissions')
        return
      }

      setCurrentUser(userProfile)
    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/auth/login')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!currentUser) {
    return null // Will redirect in useEffect
  }

  return (
    <DashboardLayout>
      <Box sx={{ flexGrow: 1, p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Dashboard Overview
        </Typography>
        
        <Grid container spacing={3}>
          {/* Main Stats */}
          <Grid item xs={12}>
            <Suspense fallback={<CircularProgress />}>
              <AuditOverview />
            </Suspense>
          </Grid>

          {/* Location Stats */}
          <Grid item xs={12} md={8}>
            <Suspense fallback={<CircularProgress />}>
              <LocationStats />
            </Suspense>
          </Grid>

          {/* Pending Approvals */}
          <Grid item xs={12} md={4}>
            <Suspense fallback={<CircularProgress />}>
              <PendingApprovals />
            </Suspense>
          </Grid>

          {/* Recent Activity */}
          <Grid item xs={12}>
            <Suspense fallback={<CircularProgress />}>
              <RecentActivity />
            </Suspense>
          </Grid>
        </Grid>
      </Box>
    </DashboardLayout>
  )
}
```

### Step 4.3: Update Dashboard Layout

Update `dashboard/src/components/DashboardLayout.tsx`, fix the sign out function:

```typescript
// Replace the handleSignOut function:
const handleSignOut = async () => {
  await supabase.auth.signOut()
  router.push('/auth/login')
}
```

**✅ Checkpoint:** Web dashboard updated for Supabase Auth

---

## Phase 5: Testing & Validation (30 minutes)

### Step 5.1: Test Mobile App

1. **Build and run mobile app:**
   ```bash
   cd mobile
   npx react-native run-android
   ```

2. **Test login with all users:**
   - Username: `saleem`, Password: `password123` (should work)
   - Username: `supervisor1`, Password: `password123` (should work)
   - Username: `scanner1`, Password: `password123` (should work)

3. **Test location loading:**
   - Login as saleem → Should see 4 locations
   - Select "Downtown Store" → Should see 20 racks

### Step 5.2: Test Web Dashboard

1. **Start dashboard:**
   ```bash
   cd dashboard
   npm run dev
   ```

2. **Test login:**
   - Username: `saleem`, Password: `password123` → Should access dashboard
   - Username: `supervisor1`, Password: `password123` → Should access dashboard
   - Username: `scanner1`, Password: `password123` → Should be blocked

3. **Test navigation:**
   - Dashboard should load with audit overview
   - Sign out should work properly

### Step 5.3: Validation Checklist

Create `supabase/26_validate_migration.sql`:

```sql
-- 26_validate_migration.sql
-- Comprehensive validation of Supabase Auth migration

-- Check auth users exist
SELECT 'Auth Users Check' as test_name;
SELECT 
  email,
  raw_user_meta_data->>'username' as username,
  raw_user_meta_data->>'role' as role,
  email_confirmed_at IS NOT NULL as confirmed
FROM auth.users 
WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com');

-- Check users table integration
SELECT 'Users Table Integration Check' as test_name;
SELECT 
  u.username,
  u.email,
  u.role,
  u.active,
  CASE WHEN au.id IS NOT NULL THEN 'Linked' ELSE 'Missing' END as auth_linked
FROM users u
LEFT JOIN auth.users au ON u.id = au.id
WHERE u.username IN ('saleem', 'supervisor1', 'scanner1');

-- Check location access still works
SELECT 'Location Access Check' as test_name;
SELECT 
  u.username,
  u.role,
  array_length(u.location_ids, 1) as location_count,
  (SELECT array_agg(l.name) FROM locations l WHERE l.id = ANY(u.location_ids)) as location_names
FROM users u
WHERE u.username IN ('saleem', 'supervisor1', 'scanner1');

-- Check audit session references
SELECT 'Audit Session References Check' as test_name;
SELECT 
  a.id,
  l.name as location,
  u.username as started_by_user,
  a.status
FROM audit_sessions a
JOIN locations l ON a.location_id = l.id
JOIN users u ON a.started_by = u.id
WHERE a.status = 'active';

-- Check RLS policies
SELECT 'RLS Policies Check' as test_name;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'locations', 'audit_sessions', 'racks', 'scans');

-- Overall migration status
SELECT 'Migration Status Summary' as test_name;
SELECT 
  (SELECT COUNT(*) FROM auth.users WHERE email LIKE '%@%') as auth_users_count,
  (SELECT COUNT(*) FROM users WHERE id IN (SELECT id FROM auth.users)) as linked_users_count,
  (SELECT COUNT(*) FROM locations WHERE active = true) as active_locations_count,
  (SELECT COUNT(*) FROM audit_sessions WHERE status = 'active') as active_sessions_count,
  (SELECT COUNT(*) FROM racks) as total_racks_count;
```

**Run validation script and verify all checks pass.**

### Step 5.4: Rollback Plan (If Needed)

If migration fails, restore from backup:

```sql
-- Emergency rollback script
-- 27_emergency_rollback.sql

-- Restore users table
DROP TABLE IF EXISTS users;
ALTER TABLE users_backup_pre_migration RENAME TO users;

-- Restore custom auth functions
-- (Re-run script 15_standalone_auth_fixed.sql)

-- Clear auth users if needed
DELETE FROM auth.users WHERE email IN (
  'saleem@poppatjamals.com', 
  'supervisor1@test.com', 
  'scanner1@test.com'
);

SELECT 'Rollback completed - custom auth restored' as status;
```

---

## Phase 6: Cleanup & Documentation (15 minutes)

### Step 6.1: Update Documentation

1. **Update CLAUDE.md:**
   - Remove references to custom auth
   - Add Supabase Auth information
   - Update known issues section

2. **Update README.md:**
   - Change login instructions
   - Update environment setup

### Step 6.2: Clean Up Files

```bash
# Remove old custom auth files
rm mobile/src/store/slices/authSliceWorkaround.ts

# Commit migration
git add .
git commit -m "✅ Migration to Supabase Auth complete

- Replaced custom RPC auth with Supabase Auth
- Updated mobile app authentication
- Updated web dashboard authentication  
- All helper functions now use standard Supabase patterns
- Username-to-email mapping preserves UX
- All tests passing"
```

### Step 6.3: Final Testing

1. **End-to-End Mobile Test:**
   - Login → Location Selection → Rack Selection → Scanning

2. **End-to-End Dashboard Test:**
   - Login → Dashboard → Approval Interface

3. **Cross-Platform Test:**
   - Same user can access both mobile and web
   - Data consistency across platforms

---

## Success Criteria

✅ **Authentication:**
- All three test users can log in on both platforms
- Username/password experience unchanged for users
- Session management working automatically

✅ **Data Access:**
- All helper functions working without modification
- Location loading working in mobile app
- Dashboard components accessing data correctly

✅ **Security:**
- RLS policies updated and working
- Scanner role blocked from web dashboard
- Superuser has full access

✅ **Functionality:**
- Complete mobile workflow: Login → Location → Racks → Scanning
- Complete web workflow: Login → Dashboard → Approvals
- Cross-platform data consistency

---

## Troubleshooting

### Issue: "User not found" error
**Solution:** Check username-email mapping in auth helpers

### Issue: "Insufficient permissions" error  
**Solution:** Verify RLS policies updated with `auth.uid()`

### Issue: Sessions not persisting
**Solution:** Check Supabase client configuration in both apps

### Issue: Dashboard components not loading data
**Solution:** Verify helper functions using correct user IDs

---

## Post-Migration Benefits

1. **Simpler Codebase:** Removed custom auth code
2. **Better Integration:** All Supabase features work properly  
3. **Automatic Sessions:** No manual session management
4. **Standard Patterns:** Following Supabase best practices
5. **Built-in Features:** Password reset, email verification available
6. **Better Security:** Leveraging Supabase's security features

---

**Total Migration Time:** ~2.5 hours
**Risk Level:** Medium (with rollback plan)
**Reward:** Significantly simpler and more maintainable authentication system