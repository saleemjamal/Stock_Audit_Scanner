-- 34. Validate Supabase Auth Migration
-- Comprehensive validation of Supabase Auth migration

-- Check auth users exist
SELECT '=== AUTH USERS CHECK ===' as test_section;
SELECT 
  'Auth Users Status' as test_name,
  email,
  raw_user_meta_data->>'username' as username,
  raw_user_meta_data->>'role' as role,
  email_confirmed_at IS NOT NULL as confirmed,
  created_at
FROM auth.users 
WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
ORDER BY email;

-- Check users table integration
SELECT '=== USERS TABLE INTEGRATION CHECK ===' as test_section;
SELECT 
  'Users Table Integration' as test_name,
  u.username,
  u.email,
  u.role,
  u.active,
  CASE WHEN au.id IS NOT NULL THEN 'Linked' ELSE 'Missing' END as auth_linked,
  CASE WHEN u.id = au.id THEN 'ID_MATCH' ELSE 'ID_MISMATCH' END as id_status
FROM users u
LEFT JOIN auth.users au ON u.id = au.id
WHERE u.username IN ('saleem', 'supervisor1', 'scanner1')
ORDER BY u.username;

-- Check location access still works
SELECT '=== LOCATION ACCESS CHECK ===' as test_section;
SELECT 
  'Location Access Status' as test_name,
  u.username,
  u.role,
  array_length(u.location_ids, 1) as location_count,
  (SELECT array_agg(l.name) FROM locations l WHERE l.id = ANY(u.location_ids)) as location_names
FROM users u
WHERE u.username IN ('saleem', 'supervisor1', 'scanner1')
ORDER BY u.username;

-- Check audit session references
SELECT '=== AUDIT SESSION REFERENCES CHECK ===' as test_section;
SELECT 
  'Audit Session Links' as test_name,
  a.id as session_id,
  l.name as location,
  u.username as started_by_user,
  u.role as user_role,
  a.status,
  a.started_at
FROM audit_sessions a
JOIN locations l ON a.location_id = l.id
JOIN users u ON a.started_by = u.id
WHERE a.status = 'active'
ORDER BY a.started_at DESC;

-- Check test racks are available
SELECT '=== TEST RACKS CHECK ===' as test_section;
SELECT 
  'Available Test Racks' as test_name,
  r.id as rack_id,
  r.rack_number,
  r.status,
  l.name as location,
  aus.started_at as session_created
FROM racks r
JOIN audit_sessions aus ON r.audit_session_id = aus.id
JOIN locations l ON r.location_id = l.id
WHERE r.status = 'available'
ORDER BY r.rack_number;

-- Check RLS policies are updated
SELECT '=== RLS POLICIES CHECK ===' as test_section;
SELECT 
  'RLS Policy Status' as test_name,
  schemaname, 
  tablename, 
  policyname,
  CASE 
    WHEN qual LIKE '%auth.uid()%' THEN 'Updated for Supabase Auth'
    WHEN qual LIKE '%get_current_user_id()%' THEN 'Needs Migration'
    ELSE 'Unknown Status'
  END as policy_status
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'locations', 'audit_sessions', 'racks', 'scans')
ORDER BY tablename, policyname;

-- Check for remaining custom auth functions
SELECT '=== CUSTOM AUTH CLEANUP CHECK ===' as test_section;
SELECT 
  'Custom Auth Functions' as test_name,
  routine_name, 
  routine_type,
  CASE 
    WHEN routine_name LIKE '%login%' THEN 'Should be removed'
    WHEN routine_name LIKE '%auth%' THEN 'Should be reviewed'
    ELSE 'OK'
  END as cleanup_status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND (routine_name LIKE '%login%' OR routine_name LIKE '%auth%')
ORDER BY routine_name;

-- Overall migration status summary
SELECT '=== MIGRATION STATUS SUMMARY ===' as test_section;
SELECT 
  'Migration Summary' as test_name,
  (SELECT COUNT(*) FROM auth.users WHERE email LIKE '%@%') as auth_users_count,
  (SELECT COUNT(*) FROM users WHERE id IN (SELECT id FROM auth.users)) as linked_users_count,
  (SELECT COUNT(*) FROM locations WHERE active = true) as active_locations_count,
  (SELECT COUNT(*) FROM audit_sessions WHERE status = 'active') as active_sessions_count,
  (SELECT COUNT(*) FROM racks WHERE status = 'available') as available_racks_count;

-- Test user credentials validation
SELECT '=== USER CREDENTIALS TEST ===' as test_section;
SELECT 
  'User Credentials Status' as test_name,
  au.email,
  au.raw_user_meta_data->>'username' as username,
  au.raw_user_meta_data->>'role' as expected_role,
  u.role as actual_role,
  CASE 
    WHEN au.encrypted_password IS NOT NULL THEN 'Has Password'
    ELSE 'Missing Password'
  END as password_status,
  CASE 
    WHEN au.email_confirmed_at IS NOT NULL THEN 'Email Confirmed'
    ELSE 'Email Not Confirmed'
  END as email_status
FROM auth.users au
JOIN users u ON au.id = u.id
WHERE au.email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
ORDER BY au.email;

-- Final readiness check
SELECT '=== FINAL READINESS CHECK ===' as test_section;
SELECT 
  'System Readiness' as test_name,
  CASE 
    WHEN (SELECT COUNT(*) FROM auth.users WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')) = 3
    AND (SELECT COUNT(*) FROM users WHERE username IN ('saleem', 'supervisor1', 'scanner1') AND id IN (SELECT id FROM auth.users)) = 3
    AND (SELECT COUNT(*) FROM locations WHERE active = true) >= 4
    AND (SELECT COUNT(*) FROM audit_sessions WHERE status = 'active') >= 1
    AND (SELECT COUNT(*) FROM racks WHERE status = 'available') >= 5
    THEN '✅ READY FOR TESTING'
    ELSE '❌ MIGRATION INCOMPLETE'
  END as readiness_status;

SELECT 'SUPABASE AUTH MIGRATION VALIDATION COMPLETE' as final_status;