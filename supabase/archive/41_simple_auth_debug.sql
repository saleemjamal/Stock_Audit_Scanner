-- 41. Simple Auth Debug - Check only existing columns
-- First, let's see what columns actually exist in auth.users

SELECT '=== AUTH USERS COLUMNS ===' as section;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'auth' 
  AND table_name = 'users'
ORDER BY ordinal_position;

-- Basic auth users check with only common columns
SELECT '=== AUTH USERS BASIC CHECK ===' as section;
SELECT 
  id,
  email,
  encrypted_password IS NOT NULL as has_password,
  length(encrypted_password) as password_length,
  encrypted_password LIKE '$2%' as is_bcrypt,
  email_confirmed_at IS NOT NULL as email_confirmed,
  instance_id,
  aud,
  role,
  created_at,
  updated_at
FROM auth.users 
WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
ORDER BY email;

-- Check for duplicates
SELECT '=== DUPLICATE CHECK ===' as section;
SELECT email, COUNT(*) as count
FROM auth.users 
WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
GROUP BY email
HAVING COUNT(*) > 1;

-- Check instance_id consistency
SELECT '=== INSTANCE ID CHECK ===' as section;
SELECT 
  DISTINCT instance_id,
  COUNT(*) as user_count
FROM auth.users 
WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
GROUP BY instance_id;

-- Manual password test
SELECT '=== PASSWORD TEST ===' as section;
SELECT 
  email,
  crypt('password123', encrypted_password) = encrypted_password as password_match
FROM auth.users 
WHERE email = 'saleem@poppatjamals.com';

-- Check what instance_id should be by looking at any existing auth user
SELECT '=== EXPECTED INSTANCE ID ===' as section;
SELECT 
  'Expected instance_id from existing auth users:' as info,
  DISTINCT instance_id
FROM auth.users 
WHERE instance_id IS NOT NULL
LIMIT 1;

SELECT 'SIMPLE AUTH DEBUG COMPLETE' as final_status;