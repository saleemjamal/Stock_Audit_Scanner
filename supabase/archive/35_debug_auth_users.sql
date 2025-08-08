-- 35. Debug Auth Users - Check if passwords work
-- Test if Supabase Auth users actually exist and can authenticate

-- First check if auth users exist
SELECT '=== AUTH USERS EXISTENCE CHECK ===' as section;
SELECT 
  id,
  email, 
  encrypted_password IS NOT NULL as has_password,
  email_confirmed_at IS NOT NULL as email_confirmed,
  created_at,
  raw_user_meta_data->>'username' as username
FROM auth.users 
WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
ORDER BY email;

-- Check if users can be found by our mapping
SELECT '=== EMAIL MAPPING TEST ===' as section;
SELECT 
  'saleem should map to' as test,
  'saleem@poppatjamals.com' as expected_email,
  CASE 
    WHEN EXISTS (SELECT 1 FROM auth.users WHERE email = 'saleem@poppatjamals.com') 
    THEN 'EMAIL EXISTS' 
    ELSE 'EMAIL MISSING' 
  END as status;

SELECT 
  'supervisor1 should map to' as test,
  'supervisor1@test.com' as expected_email,
  CASE 
    WHEN EXISTS (SELECT 1 FROM auth.users WHERE email = 'supervisor1@test.com') 
    THEN 'EMAIL EXISTS' 
    ELSE 'EMAIL MISSING' 
  END as status;

SELECT 
  'scanner1 should map to' as test,
  'scanner1@test.com' as expected_email,
  CASE 
    WHEN EXISTS (SELECT 1 FROM auth.users WHERE email = 'scanner1@test.com') 
    THEN 'EMAIL EXISTS' 
    ELSE 'EMAIL MISSING' 
  END as status;

-- Check password format and creation
SELECT '=== PASSWORD CHECK ===' as section;
SELECT 
  email,
  length(encrypted_password) as password_length,
  encrypted_password LIKE '$2%' as is_bcrypt_format,
  email_confirmed_at IS NOT NULL as email_confirmed,
  instance_id
FROM auth.users 
WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
ORDER BY email;

-- Try to manually test password (this won't work in SQL but shows the concept)
SELECT '=== MANUAL PASSWORD TEST ===' as section;
SELECT 
  'Manual password verification test' as info,
  'Run this in a separate query to test one password:' as instruction,
  'SELECT crypt(''password123'', encrypted_password) = encrypted_password as password_match FROM auth.users WHERE email = ''saleem@poppatjamals.com'';' as test_query;

-- Check instance configuration
SELECT '=== INSTANCE CHECK ===' as section;
SELECT 
  DISTINCT instance_id,
  COUNT(*) as user_count
FROM auth.users 
WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
GROUP BY instance_id;

SELECT 'DEBUG COMPLETE - Check results above' as final_status;