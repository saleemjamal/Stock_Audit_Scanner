-- 37. Fix Auth Users - Ensure they work with Supabase Auth
-- The password is correct, but we need to ensure the auth users are properly configured

-- First, let's check the current state
SELECT '=== CURRENT AUTH USERS STATE ===' as section;
SELECT 
  id,
  email,
  aud,
  role,
  email_confirmed_at,
  instance_id,
  raw_app_meta_data,
  raw_user_meta_data
FROM auth.users 
WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
ORDER BY email;

-- Fix the auth users to ensure they're properly configured for Supabase Auth
DO $$
DECLARE
    user_id UUID;
BEGIN
    -- Fix saleem
    SELECT id INTO user_id FROM users WHERE username = 'saleem';
    
    UPDATE auth.users 
    SET 
        id = user_id,  -- Use the same ID as in users table
        aud = 'authenticated',
        role = 'authenticated',
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        confirmation_sent_at = NOW(),
        confirmed_at = NOW(),
        updated_at = NOW()
    WHERE email = 'saleem@poppatjamals.com';
    
    -- Fix supervisor1
    SELECT id INTO user_id FROM users WHERE username = 'supervisor1';
    
    UPDATE auth.users 
    SET 
        id = user_id,
        aud = 'authenticated',
        role = 'authenticated',
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        confirmation_sent_at = NOW(),
        confirmed_at = NOW(),
        updated_at = NOW()
    WHERE email = 'supervisor1@test.com';
    
    -- Fix scanner1
    SELECT id INTO user_id FROM users WHERE username = 'scanner1';
    
    UPDATE auth.users 
    SET 
        id = user_id,
        aud = 'authenticated',
        role = 'authenticated',
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        confirmation_sent_at = NOW(),
        confirmed_at = NOW(),
        updated_at = NOW()
    WHERE email = 'scanner1@test.com';
    
    RAISE NOTICE 'Fixed all auth users with proper IDs and confirmation';
END $$;

-- Verify the fix
SELECT '=== AFTER FIX ===' as section;
SELECT 
  au.email,
  au.id as auth_id,
  u.id as user_id,
  au.id = u.id as ids_match,
  au.email_confirmed_at IS NOT NULL as email_confirmed,
  u.username,
  u.role
FROM auth.users au
JOIN users u ON au.email = CASE 
    WHEN u.username = 'saleem' THEN 'saleem@poppatjamals.com'
    WHEN u.username = 'supervisor1' THEN 'supervisor1@test.com'
    WHEN u.username = 'scanner1' THEN 'scanner1@test.com'
END
WHERE au.email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
ORDER BY au.email;

-- Check RLS policies don't block auth access
SELECT '=== RLS CHECK ===' as section;
SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'users'
ORDER BY policyname;

SELECT 'AUTH USERS FIXED - Try logging in again' as final_status;