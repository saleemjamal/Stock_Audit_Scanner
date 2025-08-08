-- 19. Verify Complete Setup
-- This script verifies that all test data is properly configured
-- Run this after all previous setup scripts to confirm everything is working

-- Check authentication system
SELECT 'Authentication Test' as test_name;
SELECT username, role, active, has_password,
       CASE WHEN password_hash IS NOT NULL THEN 'Password Set' ELSE 'No Password' END as password_status
FROM users 
WHERE username IN ('saleem', 'supervisor1', 'scanner1')
ORDER BY role;

-- Test login function with saleem
SELECT 'Login Function Test' as test_name;
SELECT login_with_username('saleem', 'password123');

-- Check locations and user access
SELECT 'Location Access Test' as test_name;
SELECT 
  u.username,
  u.role,
  array_length(u.location_ids, 1) as accessible_locations,
  (SELECT array_agg(l.name) FROM locations l WHERE l.id = ANY(u.location_ids)) as location_names
FROM users u
WHERE u.username IN ('saleem', 'supervisor1', 'scanner1')
ORDER BY u.role;

-- Check audit session status
SELECT 'Audit Session Test' as test_name;
SELECT 
  a.id as session_id,
  l.name as location,
  a.total_rack_count,
  a.status,
  u.username as started_by,
  COUNT(r.id) as racks_created
FROM audit_sessions a
JOIN locations l ON a.location_id = l.id
JOIN users u ON a.started_by = u.id
LEFT JOIN racks r ON r.audit_session_id = a.id
WHERE a.status = 'active'
GROUP BY a.id, l.name, a.total_rack_count, a.status, u.username;

-- Check rack distribution
SELECT 'Rack Status Test' as test_name;
SELECT 
  status,
  COUNT(*) as count
FROM racks 
WHERE audit_session_id = (SELECT id FROM audit_sessions WHERE status = 'active' LIMIT 1)
GROUP BY status
ORDER BY status;

-- Final readiness check
SELECT 'System Readiness' as test_name;
SELECT 
  CASE 
    WHEN (SELECT COUNT(*) FROM locations WHERE active = true) >= 4 THEN 'PASS'
    ELSE 'FAIL'
  END as locations_check,
  
  CASE 
    WHEN (SELECT COUNT(*) FROM users WHERE username = 'saleem' AND array_length(location_ids, 1) >= 4) = 1 THEN 'PASS'
    ELSE 'FAIL'
  END as superuser_access_check,
  
  CASE 
    WHEN (SELECT COUNT(*) FROM audit_sessions WHERE status = 'active') = 1 THEN 'PASS'
    ELSE 'FAIL'
  END as audit_session_check,
  
  CASE 
    WHEN (SELECT COUNT(*) FROM racks WHERE audit_session_id = (SELECT id FROM audit_sessions WHERE status = 'active' LIMIT 1)) = 20 THEN 'PASS'
    ELSE 'FAIL'
  END as racks_check;

-- Instructions for next steps
SELECT 'Next Steps' as info,
'
✅ Database Setup Complete!

MOBILE APP TESTING:
1. Open Stock Audit Scanner mobile app
2. Login with: saleem / password123
3. Should see 4 locations including "Downtown Store"
4. Select "Downtown Store"
5. Should see 20 available racks (A1-1 through A1-20)

WEB DASHBOARD TESTING:
1. Open http://localhost:3000
2. Login with: supervisor1 / password123
3. Should see dashboard with audit session info

If any check shows FAIL above, review the previous scripts.
' as instructions;