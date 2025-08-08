-- Debug why racks aren't showing in mobile app
-- Even though authentication works and audit_session_id matches

-- Check the exact state of racks
SELECT '=== RACK DETAILS ===' as section;
SELECT 
  r.id,
  r.rack_number,
  r.audit_session_id,
  r.location_id,
  r.status,
  r.scanner_id,
  a.status as audit_status,
  l.name as location_name
FROM racks r
JOIN audit_sessions a ON r.audit_session_id = a.id
JOIN locations l ON r.location_id = l.id
WHERE r.audit_session_id = '46acf8c0-4026-4b9b-bc66-5103aff8ba47'
ORDER BY r.rack_number;

-- Check how many are available
SELECT '=== RACK STATUS BREAKDOWN ===' as section;
SELECT 
  status,
  COUNT(*) as count
FROM racks
WHERE audit_session_id = '46acf8c0-4026-4b9b-bc66-5103aff8ba47'
GROUP BY status;

-- Simulate the exact query the mobile app uses
SELECT '=== MOBILE APP QUERY SIMULATION ===' as section;
SELECT 
  COUNT(*) as racks_found,
  'Query: WHERE audit_session_id = 46acf8c0-4026-4b9b-bc66-5103aff8ba47 AND status = available' as query_used
FROM racks
WHERE audit_session_id = '46acf8c0-4026-4b9b-bc66-5103aff8ba47'
  AND status = 'available';

-- Get sample of available racks
SELECT '=== SAMPLE AVAILABLE RACKS ===' as section;
SELECT *
FROM racks
WHERE audit_session_id = '46acf8c0-4026-4b9b-bc66-5103aff8ba47'
  AND status = 'available'
LIMIT 5;

-- Check if there's a location_id mismatch
SELECT '=== LOCATION CHECK ===' as section;
SELECT DISTINCT
  r.location_id as rack_location_id,
  a.location_id as audit_session_location_id,
  l.name as location_name,
  CASE 
    WHEN r.location_id = a.location_id THEN 'MATCH ✅'
    ELSE 'MISMATCH ❌'
  END as location_match
FROM racks r
JOIN audit_sessions a ON r.audit_session_id = a.id
JOIN locations l ON r.location_id = l.id
WHERE r.audit_session_id = '46acf8c0-4026-4b9b-bc66-5103aff8ba47';