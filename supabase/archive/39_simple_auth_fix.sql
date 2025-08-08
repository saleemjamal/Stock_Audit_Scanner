-- 39. Simple Auth Fix - Work within Supabase constraints
-- Since we can't disable system triggers, let's take a different approach

-- First, check current state
SELECT '=== CURRENT STATE ===' as section;
SELECT 
  au.id as auth_id,
  au.email,
  u.id as user_id,
  u.username,
  au.id = u.id as ids_match
FROM auth.users au
LEFT JOIN users u ON u.email = au.email
WHERE au.email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
ORDER BY au.email;

-- Check if there are any foreign key constraints we need to handle
SELECT '=== FOREIGN KEY CHECK ===' as section;
SELECT 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND ccu.table_name = 'users'
  AND ccu.column_name = 'id';

-- Instead of updating the users table, let's verify auth works and create a test
SELECT '=== AUTH VERIFICATION ===' as section;

-- Test that we can find users by their auth emails
SELECT 
  'Test user lookup' as test_name,
  au.email,
  au.id as auth_user_id,
  u.username,
  u.role,
  u.location_ids
FROM auth.users au
LEFT JOIN users u ON (
  (au.email = 'saleem@poppatjamals.com' AND u.username = 'saleem') OR
  (au.email = 'supervisor1@test.com' AND u.username = 'supervisor1') OR
  (au.email = 'scanner1@test.com' AND u.username = 'scanner1')
)
WHERE au.email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
ORDER BY au.email;

-- Test password verification for one user
SELECT '=== PASSWORD TEST ===' as section;
SELECT 
  email,
  crypt('password123', encrypted_password) = encrypted_password as password_correct,
  email_confirmed_at IS NOT NULL as email_confirmed,
  aud = 'authenticated' as correct_aud,
  role = 'authenticated' as correct_role
FROM auth.users 
WHERE email = 'saleem@poppatjamals.com';

-- Create a simple test function to verify auth works
CREATE OR REPLACE FUNCTION test_supabase_auth(test_email text, test_password text)
RETURNS json AS $$
DECLARE
  auth_user auth.users%ROWTYPE;
  user_profile users%ROWTYPE;
  result json;
BEGIN
  -- Find auth user
  SELECT * INTO auth_user FROM auth.users WHERE email = test_email;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Verify password
  IF crypt(test_password, auth_user.encrypted_password) != auth_user.encrypted_password THEN
    RETURN json_build_object('success', false, 'error', 'Invalid password');
  END IF;
  
  -- Find user profile by email mapping
  SELECT * INTO user_profile FROM users WHERE 
    (test_email = 'saleem@poppatjamals.com' AND username = 'saleem') OR
    (test_email = 'supervisor1@test.com' AND username = 'supervisor1') OR
    (test_email = 'scanner1@test.com' AND username = 'scanner1');
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;
  
  -- Return success with user data
  RETURN json_build_object(
    'success', true,
    'auth_id', auth_user.id,
    'user_id', user_profile.id,
    'username', user_profile.username,
    'role', user_profile.role,
    'email_confirmed', auth_user.email_confirmed_at IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Test all three users
SELECT '=== AUTHENTICATION TESTS ===' as section;
SELECT 'saleem test' as user_test, test_supabase_auth('saleem@poppatjamals.com', 'password123') as result;
SELECT 'supervisor1 test' as user_test, test_supabase_auth('supervisor1@test.com', 'password123') as result;
SELECT 'scanner1 test' as user_test, test_supabase_auth('scanner1@test.com', 'password123') as result;

-- Check RLS policies that might be blocking access
SELECT '=== RLS POLICIES ===' as section;
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'locations', 'audit_sessions')
ORDER BY tablename, policyname;

SELECT '✅ AUTH DIAGNOSTIC COMPLETE - Check test results above' as final_status;