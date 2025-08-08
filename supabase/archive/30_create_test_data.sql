-- 30. Create Test Data - Skip Auth Migration
-- Since users table is working with login_with_username, create test data directly

-- ========================================
-- STEP 1: VERIFY CURRENT USER STATE
-- ========================================

SELECT '=== CURRENT USERS ===' as section;

SELECT 
  'Existing Users' as info,
  id, username, email, role, active,
  array_length(location_ids, 1) as location_count
FROM users 
WHERE username IN ('saleem', 'supervisor1', 'scanner1')
ORDER BY username;

-- ========================================
-- STEP 2: CREATE TEST LOCATIONS
-- ========================================

SELECT '=== CREATING TEST LOCATIONS ===' as section;

-- Create test locations if they don't exist (using conditional insert)
DO $$
BEGIN
    -- Downtown Store
    IF NOT EXISTS (SELECT 1 FROM locations WHERE name = 'Downtown Store') THEN
        INSERT INTO locations (name, address, city, state, active) 
        VALUES ('Downtown Store', '123 Main St', 'Dallas', 'TX', true);
    END IF;
    
    -- Warehouse A
    IF NOT EXISTS (SELECT 1 FROM locations WHERE name = 'Warehouse A') THEN
        INSERT INTO locations (name, address, city, state, active) 
        VALUES ('Warehouse A', '456 Industrial Blvd', 'Irving', 'TX', true);
    END IF;
    
    -- North Branch
    IF NOT EXISTS (SELECT 1 FROM locations WHERE name = 'North Branch') THEN
        INSERT INTO locations (name, address, city, state, active) 
        VALUES ('North Branch', '789 Commerce Way', 'Plano', 'TX', true);
    END IF;
    
    -- South Branch
    IF NOT EXISTS (SELECT 1 FROM locations WHERE name = 'South Branch') THEN
        INSERT INTO locations (name, address, city, state, active) 
        VALUES ('South Branch', '321 Oak St', 'Richardson', 'TX', true);
    END IF;
END $$;

-- Show created locations
SELECT 
  'Created Locations' as info,
  id, name, city, state, active
FROM locations
ORDER BY name;

-- ========================================
-- STEP 3: VERIFY USER LOCATION ACCESS (Already Set Up)
-- ========================================

SELECT '=== CURRENT USER LOCATION ACCESS ===' as section;

-- Users already have location access - just show current state
SELECT 
  'Current User Access' as info,
  'Users already have location access configured' as message;

-- Verify location assignments
SELECT 
  'Updated User Location Access' as info,
  u.username, u.email, u.role,
  array_length(u.location_ids, 1) as location_count,
  string_agg(l.name, ', ') as locations
FROM users u
LEFT JOIN locations l ON l.id = ANY(u.location_ids)
WHERE u.username IN ('saleem', 'supervisor1', 'scanner1')
GROUP BY u.id, u.username, u.email, u.role, u.location_ids
ORDER BY u.username;

-- ========================================
-- STEP 4: CREATE TEST AUDIT SESSION
-- ========================================

SELECT '=== CREATING TEST AUDIT SESSION ===' as section;

-- Create an active audit session at Downtown Store (if none exists)
INSERT INTO audit_sessions (location_id, total_rack_count, status, started_at, started_by)
SELECT 
    l.id as location_id,
    20 as total_rack_count, 
    'active' as status,
    NOW() as started_at,
    u.id as started_by
FROM locations l
CROSS JOIN users u 
WHERE l.name = 'Downtown Store' 
  AND u.username = 'saleem'
  AND NOT EXISTS (
    SELECT 1 FROM audit_sessions aus2
    WHERE aus2.location_id = l.id AND aus2.status = 'active'
  );

-- Show created audit session
SELECT 
  'Created Audit Session' as info,
  aus.id, l.name as location, aus.total_rack_count, aus.status,
  u.username as started_by, aus.started_at
FROM audit_sessions aus
JOIN locations l ON aus.location_id = l.id
JOIN users u ON aus.started_by = u.id
ORDER BY aus.started_at DESC
LIMIT 1;

-- ========================================
-- STEP 5: CREATE TEST RACKS
-- ========================================

SELECT '=== CREATING TEST RACKS ===' as section;

-- Create 5 test racks for the active audit session
WITH active_session AS (
    SELECT id, location_id FROM audit_sessions 
    WHERE status = 'active' 
    ORDER BY started_at DESC 
    LIMIT 1
),
rack_numbers AS (
    SELECT generate_series(1, 5) as rack_num
)
INSERT INTO racks (audit_session_id, location_id, rack_number, status)
SELECT 
    active_session.id,
    active_session.location_id,
    'R-' || LPAD(rack_numbers.rack_num::text, 3, '0'),
    'available'
FROM active_session
CROSS JOIN rack_numbers
WHERE NOT EXISTS (
    SELECT 1 FROM racks r
    WHERE r.audit_session_id = active_session.id 
    AND r.rack_number = 'R-' || LPAD(rack_numbers.rack_num::text, 3, '0')
);

-- Show created racks
SELECT 
  'Created Test Racks' as info,
  r.id, r.rack_number, r.status, l.name as location,
  aus.started_at as session_created
FROM racks r
JOIN audit_sessions aus ON r.audit_session_id = aus.id
JOIN locations l ON r.location_id = l.id
ORDER BY r.rack_number;

-- ========================================
-- STEP 6: FINAL VERIFICATION
-- ========================================

SELECT '=== SYSTEM READY ===' as section;

SELECT 
  'System Status' as info,
  (SELECT COUNT(*) FROM users WHERE username IN ('saleem', 'supervisor1', 'scanner1')) as user_count,
  (SELECT COUNT(*) FROM locations WHERE active = true) as location_count,
  (SELECT COUNT(*) FROM audit_sessions WHERE status = 'active') as active_sessions,
  (SELECT COUNT(*) FROM racks WHERE status = 'available') as available_racks;

-- Show what users can access
SELECT 
  'User Access Summary' as info,
  u.username, u.role,
  CASE 
    WHEN array_length(u.location_ids, 1) = (SELECT COUNT(*) FROM locations WHERE active = true) 
    THEN 'ALL LOCATIONS'
    ELSE array_length(u.location_ids, 1)::text || ' locations'
  END as access_level
FROM users u
WHERE u.username IN ('saleem', 'supervisor1', 'scanner1')
ORDER BY u.username;

SELECT 'TEST DATA CREATION COMPLETE - System ready for testing!' as final_status;