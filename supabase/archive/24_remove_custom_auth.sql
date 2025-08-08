-- 24. Remove Custom Authentication Functions and Policies
-- This script cleans up the old custom authentication system
-- Run after migrating user data successfully

-- Drop custom RPC functions
DROP FUNCTION IF EXISTS public.login_with_username(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.authenticate_user(text, text) CASCADE;

-- Remove any other custom auth-related functions
DROP FUNCTION IF EXISTS public.create_user_with_password(text, text, text, text) CASCADE;

-- Revoke permissions that were granted to custom functions
-- (These were granted to anon/authenticated roles for RPC access)
-- Note: This is automatic when functions are dropped

-- Drop old triggers or procedures related to custom auth
DROP TRIGGER IF EXISTS users_password_trigger ON users;
DROP FUNCTION IF EXISTS update_password_hash() CASCADE;

-- Clean up old custom auth policies (we'll create new ones in next script)
DROP POLICY IF EXISTS "Allow username lookup for login" ON users;
DROP POLICY IF EXISTS "Users can login with username" ON users;

-- Verify cleanup
SELECT 'Custom Authentication Cleanup Complete' as status;

-- Check for any remaining custom auth functions
SELECT 
  'Remaining Custom Functions Check' as info,
  routine_name, 
  routine_type,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND (
    routine_name ILIKE '%login%' OR 
    routine_name ILIKE '%auth%' OR
    routine_name ILIKE '%password%'
  );

-- Show current policies (should be empty or minimal)
SELECT 
  'Current Policies Before RLS Update' as info,
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  cmd
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'users';

SELECT 'Ready for RLS policies update (next script)' as next_step;