-- 29. Diagnose Constraint Issue
-- Find out exactly why we're still getting duplicate key violations

-- ========================================
-- STEP 1: CURRENT STATE ANALYSIS
-- ========================================

SELECT '=== CURRENT DATABASE STATE ===' as section;

-- Show all users in users table
SELECT 
  'All Users in users table' as info,
  id, username, email, role, active, created_at
FROM users
ORDER BY created_at DESC;

-- Show all auth users
SELECT 
  'All auth.users records' as info,
  id, email, 
  raw_user_meta_data->>'username' as username,
  email_confirmed_at IS NOT NULL as confirmed,
  created_at
FROM auth.users
ORDER BY created_at DESC;

-- ========================================
-- STEP 2: CONSTRAINT ANALYSIS
-- ========================================

SELECT '=== CONSTRAINT ANALYSIS ===' as section;

-- Find all unique constraints on users table
SELECT 
  'Unique constraints on users table' as info,
  constraint_name, 
  constraint_type,
  column_name
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu USING (constraint_name)
WHERE tc.table_name = 'users' 
  AND tc.constraint_type = 'UNIQUE'
ORDER BY constraint_name;

-- Check for duplicate emails in users table
SELECT 
  'Duplicate emails in users table' as info,
  email, COUNT(*) as count
FROM users 
WHERE email IS NOT NULL
GROUP BY email
HAVING COUNT(*) > 1;

-- ========================================
-- STEP 3: TRIGGER ANALYSIS
-- ========================================

SELECT '=== TRIGGER ANALYSIS ===' as section;

-- Find all triggers on auth.users
SELECT 
  'Triggers on auth.users table' as info,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users' 
   OR event_object_table = 'auth.users'
ORDER BY trigger_name;

-- Check for functions that might create users
SELECT 
  'Functions that might affect users' as info,
  proname as function_name,
  prosrc as function_body
FROM pg_proc 
WHERE prosrc ILIKE '%users%' 
  AND prosrc ILIKE '%insert%'
LIMIT 5;

-- ========================================
-- STEP 4: SPECIFIC EMAIL CHECK
-- ========================================

SELECT '=== SPECIFIC EMAIL ANALYSIS ===' as section;

-- Check if saleem@poppatjamals.com exists anywhere
SELECT 
  'saleem@poppatjamals.com in users' as info,
  COUNT(*) as count,
  string_agg(id::text, ', ') as user_ids
FROM users 
WHERE email = 'saleem@poppatjamals.com';

SELECT 
  'saleem@poppatjamals.com in auth.users' as info,
  COUNT(*) as count,
  string_agg(id::text, ', ') as auth_ids
FROM auth.users 
WHERE email = 'saleem@poppatjamals.com';

-- ========================================
-- STEP 5: RECOMMENDED NEXT STEPS
-- ========================================

SELECT '=== RECOMMENDATIONS ===' as section;

-- Show what we need to clean up
SELECT 
  CASE 
    WHEN (SELECT COUNT(*) FROM users WHERE email = 'saleem@poppatjamals.com') > 1 
    THEN 'ISSUE: Multiple users with saleem@poppatjamals.com - need to clean up'
    WHEN (SELECT COUNT(*) FROM users WHERE email = 'saleem@poppatjamals.com') = 0
    THEN 'OK: No users with saleem@poppatjamals.com'
    ELSE 'OK: Single user with saleem@poppatjamals.com'
  END as saleem_status,
  
  CASE 
    WHEN (SELECT COUNT(*) FROM auth.users WHERE email = 'saleem@poppatjamals.com') > 0
    THEN 'INFO: Auth user already exists for saleem@poppatjamals.com'
    ELSE 'INFO: No auth user for saleem@poppatjamals.com'
  END as auth_status;

SELECT 'Diagnostic complete - check results above' as final_status;