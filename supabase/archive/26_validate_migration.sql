-- 26. Validate Supabase Auth Migration
-- This script provides comprehensive validation of the migration
-- Run after completing all migration scripts to verify success

-- ========================================
-- AUTH USERS VALIDATION
-- ========================================

SELECT '=== AUTH USERS VALIDATION ===' as section;

-- Check that all auth users were created correctly
SELECT 
  'Auth Users Created' as test_name,
  email,
  raw_user_meta_data->>'username' as username,
  raw_user_meta_data->>'role' as role,
  email_confirmed_at IS NOT NULL as confirmed,
  CASE 
    WHEN email_confirmed_at IS NOT NULL THEN 'PASS'
    ELSE 'FAIL - Not Confirmed'
  END as status
FROM auth.users 
WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
ORDER BY 
  CASE raw_user_meta_data->>'role'
    WHEN 'superuser' THEN 1
    WHEN 'supervisor' THEN 2
    WHEN 'scanner' THEN 3
  END;

-- ========================================
-- USERS TABLE INTEGRATION VALIDATION  
-- ========================================

SELECT '=== USERS TABLE INTEGRATION ===' as section;

-- Check that users table is properly linked to auth users
SELECT 
  'Users Table Integration' as test_name,
  u.username,
  u.email,
  u.role,
  u.active,
  CASE WHEN au.id IS NOT NULL THEN 'LINKED' ELSE 'MISSING' END as auth_link_status,
  CASE 
    WHEN au.id IS NOT NULL AND u.active THEN 'PASS'
    WHEN au.id IS NOT NULL AND NOT u.active THEN 'WARN - User Inactive'
    ELSE 'FAIL - Missing Auth Link'
  END as status
FROM users u
LEFT JOIN auth.users au ON u.id = au.id
WHERE u.username IN ('saleem', 'supervisor1', 'scanner1')
ORDER BY u.role;

-- ========================================
-- LOCATION ACCESS VALIDATION
-- ========================================

SELECT '=== LOCATION ACCESS VALIDATION ===' as section;

-- Check that location access is preserved
SELECT 
  'Location Access Preserved' as test_name,
  u.username,
  u.role,
  array_length(u.location_ids, 1) as location_count,
  (SELECT array_agg(l.name ORDER BY l.name) FROM locations l WHERE l.id = ANY(u.location_ids)) as location_names,
  CASE 
    WHEN u.role = 'superuser' AND array_length(u.location_ids, 1) >= 4 THEN 'PASS - Superuser has all locations'
    WHEN u.role != 'superuser' AND array_length(u.location_ids, 1) > 0 THEN 'PASS - User has locations'
    WHEN u.role != 'superuser' AND array_length(u.location_ids, 1) IS NULL THEN 'WARN - No locations assigned'
    ELSE 'FAIL - Location access issue'
  END as status
FROM users u
WHERE u.username IN ('saleem', 'supervisor1', 'scanner1')
ORDER BY u.role, u.username;

-- ========================================
-- FOREIGN KEY REFERENCES VALIDATION
-- ========================================

SELECT '=== FOREIGN KEY REFERENCES VALIDATION ===' as section;

-- Check audit session references
SELECT 
  'Audit Session References' as test_name,
  COUNT(*) as total_sessions,
  COUNT(CASE WHEN started_by IN (SELECT id FROM users) THEN 1 END) as valid_started_by,
  COUNT(CASE WHEN completed_by IN (SELECT id FROM users) OR completed_by IS NULL THEN 1 END) as valid_completed_by,
  CASE 
    WHEN COUNT(*) = COUNT(CASE WHEN started_by IN (SELECT id FROM users) THEN 1 END) 
     AND COUNT(*) = COUNT(CASE WHEN completed_by IN (SELECT id FROM users) OR completed_by IS NULL THEN 1 END)
    THEN 'PASS'
    ELSE 'FAIL - Invalid user references'
  END as status
FROM audit_sessions;

-- Check rack references  
SELECT 
  'Rack References' as test_name,
  COUNT(*) as total_racks,
  COUNT(CASE WHEN scanner_id IN (SELECT id FROM users) OR scanner_id IS NULL THEN 1 END) as valid_scanner_refs,
  COUNT(CASE WHEN approved_by IN (SELECT id FROM users) OR approved_by IS NULL THEN 1 END) as valid_approved_refs,
  CASE 
    WHEN COUNT(*) = COUNT(CASE WHEN scanner_id IN (SELECT id FROM users) OR scanner_id IS NULL THEN 1 END)
     AND COUNT(*) = COUNT(CASE WHEN approved_by IN (SELECT id FROM users) OR approved_by IS NULL THEN 1 END)
    THEN 'PASS'
    ELSE 'FAIL - Invalid user references'
  END as status
FROM racks;

-- Check scan references
SELECT 
  'Scan References' as test_name,
  COUNT(*) as total_scans,
  COUNT(CASE WHEN scanner_id IN (SELECT id FROM users) THEN 1 END) as valid_scanner_refs,
  CASE 
    WHEN COUNT(*) = 0 THEN 'PASS - No scans yet'
    WHEN COUNT(*) = COUNT(CASE WHEN scanner_id IN (SELECT id FROM users) THEN 1 END) THEN 'PASS'
    ELSE 'FAIL - Invalid user references'
  END as status
FROM scans;

-- ========================================
-- RLS POLICIES VALIDATION
-- ========================================

SELECT '=== RLS POLICIES VALIDATION ===' as section;

-- Check that RLS is enabled on key tables
SELECT 
  'RLS Enabled Status' as test_name,
  schemaname,
  tablename,
  CASE WHEN rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as rls_status,
  CASE WHEN rowsecurity THEN 'PASS' ELSE 'FAIL' END as status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'locations', 'audit_sessions', 'racks', 'scans')
ORDER BY tablename;

-- Count policies per table
SELECT 
  'RLS Policies Count' as test_name,
  tablename,
  COUNT(*) as policy_count,
  CASE 
    WHEN tablename = 'users' AND COUNT(*) >= 3 THEN 'PASS'
    WHEN tablename = 'locations' AND COUNT(*) >= 2 THEN 'PASS'  
    WHEN tablename = 'audit_sessions' AND COUNT(*) >= 2 THEN 'PASS'
    WHEN tablename = 'racks' AND COUNT(*) >= 3 THEN 'PASS'
    WHEN tablename = 'scans' AND COUNT(*) >= 2 THEN 'PASS'
    ELSE 'WARN - Check policy count'
  END as status
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('users', 'locations', 'audit_sessions', 'racks', 'scans')
GROUP BY tablename
ORDER BY tablename;

-- ========================================
-- CUSTOM AUTH CLEANUP VALIDATION
-- ========================================

SELECT '=== CUSTOM AUTH CLEANUP VALIDATION ===' as section;

-- Check that custom auth functions were removed
SELECT 
  'Custom Auth Functions Removed' as test_name,
  COALESCE(COUNT(NULLIF(routine_name, '')), 0) as remaining_functions,
  CASE 
    WHEN COUNT(*) = 0 THEN 'PASS - All custom auth functions removed'
    ELSE 'FAIL - Custom auth functions still exist'
  END as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND (
    routine_name ILIKE '%login_with_username%' OR 
    routine_name ILIKE '%authenticate_user%'
  );

-- ========================================
-- OVERALL MIGRATION STATUS
-- ========================================

SELECT '=== OVERALL MIGRATION STATUS ===' as section;

-- Summary of migration
SELECT 
  'Migration Summary' as test_name,
  (SELECT COUNT(*) FROM auth.users WHERE email LIKE '%@%') as auth_users_created,
  (SELECT COUNT(*) FROM users WHERE id IN (SELECT id FROM auth.users)) as users_linked,
  (SELECT COUNT(*) FROM locations WHERE active = true) as active_locations,
  (SELECT COUNT(*) FROM audit_sessions WHERE status = 'active') as active_sessions,
  (SELECT COUNT(*) FROM racks) as total_racks,
  (SELECT COUNT(*) FROM scans) as total_scans;

-- Final validation check
WITH validation_results AS (
  SELECT 
    (SELECT COUNT(*) FROM auth.users WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')) = 3 as auth_users_ok,
    (SELECT COUNT(*) FROM users WHERE id IN (SELECT id FROM auth.users) AND username IN ('saleem', 'supervisor1', 'scanner1')) = 3 as users_linked_ok,
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('users', 'locations', 'audit_sessions', 'racks', 'scans') AND rowsecurity = true) = 5 as rls_enabled_ok,
    (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name ILIKE '%login_with_username%') = 0 as custom_auth_removed_ok
)
SELECT 
  'FINAL MIGRATION VALIDATION' as test_name,
  CASE 
    WHEN auth_users_ok AND users_linked_ok AND rls_enabled_ok AND custom_auth_removed_ok 
    THEN 'PASS - MIGRATION SUCCESSFUL ✅'
    ELSE 'FAIL - MIGRATION INCOMPLETE ❌'
  END as overall_status,
  auth_users_ok,
  users_linked_ok, 
  rls_enabled_ok,
  custom_auth_removed_ok
FROM validation_results;

-- ========================================
-- NEXT STEPS
-- ========================================

SELECT '=== NEXT STEPS ===' as section;

SELECT 
  'Ready for Application Testing' as next_step,
  '
📱 MOBILE APP TESTING:
1. Build and run: cd mobile && npx react-native run-android
2. Login with: saleem/password123 (should work with new auth)
3. Should see 4 locations now (auth integration fixed)
4. Select Downtown Store → Should see 20 racks

🖥️ WEB DASHBOARD TESTING:  
1. Start dashboard: cd dashboard && npm run dev
2. Login with: saleem/password123 (should work with new auth)
3. Should see dashboard with audit data

✅ SUCCESS CRITERIA:
- All logins work with username/password (same UX)
- Location loading works in mobile app
- Both platforms use same authentication system
- All data accessible with proper permissions
  ' as instructions;