-- Debug Rack Access Issues
-- This script diagnoses why racks are not showing up despite UUID being fixed

-- ========================================
-- STEP 1: VERIFY UUID FIX WORKED
-- ========================================

SELECT '=== UUID VERIFICATION ===' as section;

-- Confirm UUIDs now match
SELECT 
  'UUID Status' as check_type,
  au.id as auth_users_id,
  u.id as users_table_id, 
  u.email,
  u.role,
  u.location_ids,
  u.active,
  CASE 
    WHEN au.id = u.id THEN 'MATCHED ✅' 
    ELSE 'MISMATCHED ❌' 
  END as uuid_status
FROM auth.users au 
INNER JOIN users u ON au.email = u.email
WHERE au.email = 'saleem@poppatjamals.com';

-- ========================================
-- STEP 2: CHECK AUTH CONTEXT
-- ========================================

SELECT '=== CURRENT AUTH CONTEXT ===' as section;

-- Check current auth context (this will show null if not authenticated in SQL editor)
SELECT 
  'Current Auth Status' as check_type,
  auth.uid() as current_user_id,
  auth.jwt() ->> 'email' as jwt_email,
  CASE 
    WHEN auth.uid() IS NULL THEN 'NOT AUTHENTICATED ❌' 
    ELSE 'AUTHENTICATED ✅' 
  END as auth_status;

-- ========================================
-- STEP 3: CHECK LOCATIONS AND AUDIT SESSIONS
-- ========================================

SELECT '=== LOCATIONS AND AUDIT SESSIONS ===' as section;

-- Show all locations
SELECT 'All Locations' as info, id, name, active FROM locations ORDER BY id;

-- Show audit sessions
SELECT 'Audit Sessions' as info, id, location_id, status, total_rack_count, started_by 
FROM audit_sessions ORDER BY created_at DESC;

-- Show if saleem has location access
SELECT 
  'Saleem Location Access' as check_type,
  u.email,
  u.location_ids,
  l.name as location_names
FROM users u
CROSS JOIN UNNEST(u.location_ids) as location_id
JOIN locations l ON l.id = location_id
WHERE u.email = 'saleem@poppatjamals.com'
UNION ALL
SELECT 
  'Saleem Location Access (if superuser)' as check_type,
  u.email,
  u.location_ids,
  'ALL LOCATIONS (superuser)' as location_names
FROM users u 
WHERE u.email = 'saleem@poppatjamals.com' AND u.role = 'superuser';

-- ========================================
-- STEP 4: CHECK RACK DATA
-- ========================================

SELECT '=== RACK DATA ANALYSIS ===' as section;

-- Show all racks (bypassing RLS temporarily for debugging)
SELECT 
  'All Racks in Database' as info,
  r.id,
  r.audit_session_id,
  r.rack_number,
  r.location_id,
  r.status,
  r.scanner_id,
  l.name as location_name,
  a.status as audit_session_status
FROM racks r
JOIN locations l ON r.location_id = l.id
JOIN audit_sessions a ON r.audit_session_id = a.id
ORDER BY r.location_id, r.rack_number;

-- Count racks by status
SELECT 'Racks by Status' as info, status, COUNT(*) as count 
FROM racks 
GROUP BY status
ORDER BY status;

-- Count racks by location
SELECT 'Racks by Location' as info, l.name, COUNT(*) as rack_count
FROM racks r
JOIN locations l ON r.location_id = l.id
GROUP BY l.id, l.name
ORDER BY l.name;

-- ========================================
-- STEP 5: TEST RLS POLICIES DIRECTLY
-- ========================================

SELECT '=== RLS POLICY TESTING ===' as section;

-- Test the RLS helper functions
SELECT 'get_current_user_profile() result' as test_type, 
       (get_current_user_profile()).*;

SELECT 'is_superuser() result' as test_type, 
       is_superuser() as result;

-- Test what the RLS policy would see for racks
SELECT 
  'RLS Policy Check' as test_type,
  r.id as rack_id,
  r.rack_number,
  r.status,
  r.location_id,
  -- This is what the RLS policy checks:
  (r.location_id = ANY((get_current_user_profile()).location_ids)) as location_match,
  is_superuser() as is_superuser_check,
  -- Combined RLS logic:
  (r.location_id = ANY((get_current_user_profile()).location_ids) OR is_superuser()) as would_pass_rls
FROM racks r
WHERE r.status = 'available'
ORDER BY r.rack_number;

-- ========================================
-- STEP 6: MOBILE APP SPECIFIC CHECKS
-- ========================================

SELECT '=== MOBILE APP WORKFLOW CHECKS ===' as section;

-- Check the exact query the mobile app uses
-- This simulates: supabaseHelpers.getActiveAuditSession(locationId)
SELECT 
  'Active Audit Sessions' as query_type,
  id,
  location_id,
  status,
  total_rack_count,
  started_by
FROM audit_sessions 
WHERE status = 'active'
ORDER BY created_at DESC;

-- Check available racks for active sessions
-- This simulates: supabaseHelpers.getAvailableRacks(auditSessionId)
SELECT 
  'Available Racks for Active Sessions' as query_type,
  r.audit_session_id,
  r.id,
  r.rack_number,
  r.status,
  r.location_id,
  l.name as location_name
FROM racks r
JOIN locations l ON r.location_id = l.id
JOIN audit_sessions a ON r.audit_session_id = a.id
WHERE r.status = 'available' AND a.status = 'active'
ORDER BY r.rack_number;

-- ========================================
-- STEP 7: RECOMMENDATIONS
-- ========================================

SELECT '=== DIAGNOSTIC SUMMARY ===' as section;

-- Summary of potential issues
SELECT 
  CASE 
    WHEN NOT EXISTS(SELECT 1 FROM audit_sessions WHERE status = 'active') 
    THEN '❌ NO ACTIVE AUDIT SESSIONS - Create an active audit session'
    WHEN NOT EXISTS(SELECT 1 FROM racks WHERE status = 'available') 
    THEN '❌ NO AVAILABLE RACKS - Check rack statuses'
    WHEN auth.uid() IS NULL 
    THEN '❌ NOT AUTHENTICATED IN SQL EDITOR - This is expected, check mobile app logs'
    WHEN NOT EXISTS(SELECT 1 FROM users WHERE email = 'saleem@poppatjamals.com' AND role = 'superuser')
    THEN '❌ USER NOT SUPERUSER - Check user role'
    ELSE '✅ DATA LOOKS GOOD - Check mobile app authentication'
  END as diagnosis;

SELECT '=== NEXT DEBUG STEPS ===' as section;
SELECT '1. Check mobile app console logs during login' as step;
SELECT '2. Verify auth.jwt() contains email in mobile app' as step;
SELECT '3. Test RLS policies with authenticated user' as step;
SELECT '4. Check if get_current_user_profile() returns data in mobile app context' as step;