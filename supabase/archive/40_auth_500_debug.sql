-- 40. Debug 500 Auth Error - Check for auth user issues
-- The 500 error suggests auth users have configuration problems

-- Check current auth users configuration
SELECT '=== AUTH USERS DETAILED CHECK ===' as section;
SELECT 
  id,
  email,
  encrypted_password IS NOT NULL as has_password,
  length(encrypted_password) as password_length,
  encrypted_password LIKE '$2%' as is_bcrypt,
  email_confirmed_at IS NOT NULL as email_confirmed,
  phone_confirmed_at IS NOT NULL as phone_confirmed,
  confirmation_sent_at IS NOT NULL as confirmation_sent,
  recovery_sent_at,
  email_change_sent_at,
  new_email,
  banned_until,
  instance_id,
  aud,
  role,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  last_sign_in_at
FROM auth.users 
WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
ORDER BY email;

-- Check if there are any duplicate auth users
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

-- Check if auth.users table has proper constraints
SELECT '=== AUTH CONSTRAINTS ===' as section;
SELECT 
  tc.table_name, 
  tc.constraint_name, 
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'auth' 
  AND tc.table_name = 'users'
  AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE', 'CHECK')
ORDER BY tc.constraint_type, tc.constraint_name;

-- Test if we can manually verify a password (this should work)
SELECT '=== MANUAL PASSWORD TEST ===' as section;
SELECT 
  email,
  crypt('password123', encrypted_password) = encrypted_password as password_match,
  CASE 
    WHEN crypt('password123', encrypted_password) = encrypted_password THEN '✅ Password OK'
    ELSE '❌ Password FAILED'
  END as test_result
FROM auth.users 
WHERE email = 'saleem@poppatjamals.com';

-- Check if there are any triggers on auth.users that might be causing issues
SELECT '=== AUTH TRIGGERS ===' as section;
SELECT 
  trigger_name,
  event_manipulation,
  action_statement,
  action_timing
FROM information_schema.triggers 
WHERE event_object_schema = 'auth' 
  AND event_object_table = 'users'
ORDER BY trigger_name;

-- Check auth schema functions that might be involved
SELECT '=== AUTH FUNCTIONS ===' as section;
SELECT 
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'auth' 
  AND routine_name LIKE '%sign%'
ORDER BY routine_name;

-- Try to find any auth sessions that might be conflicting
SELECT '=== EXISTING SESSIONS ===' as section;
SELECT 
  id,
  user_id,
  created_at,
  updated_at,
  factor_id,
  aal,
  not_after
FROM auth.sessions 
WHERE user_id IN (
  SELECT id FROM auth.users 
  WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
)
ORDER BY created_at DESC
LIMIT 10;

SELECT '🔍 AUTH 500 ERROR DIAGNOSTIC COMPLETE - Check results above' as final_status;