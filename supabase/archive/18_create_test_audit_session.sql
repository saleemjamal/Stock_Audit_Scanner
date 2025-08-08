-- 18. Create Test Audit Session and Racks
-- This script creates an active audit session with test racks for development
-- Run this after creating locations and fixing user access

-- Step 1: Clean up existing data
UPDATE audit_sessions SET status = 'completed' WHERE status = 'active';
DELETE FROM racks;

-- Step 2: Get the required IDs first
DO $$
DECLARE
    downtown_location_id INTEGER;
    saleem_user_id UUID;
    new_session_id UUID;
BEGIN
    -- Get location ID
    SELECT id INTO downtown_location_id FROM locations WHERE name = 'Downtown Store';
    
    -- Get saleem's user ID  
    SELECT id INTO saleem_user_id FROM users WHERE username = 'saleem';
    
    -- Create audit session
    INSERT INTO audit_sessions (location_id, total_rack_count, status, started_at, started_by)
    VALUES (downtown_location_id, 20, 'active', NOW(), saleem_user_id)
    RETURNING id INTO new_session_id;
    
    -- Create racks
    INSERT INTO racks (audit_session_id, location_id, rack_number, status)
    SELECT 
        new_session_id,
        downtown_location_id,
        'A1-' || generate_series,
        'available'
    FROM generate_series(1, 20);
    
    RAISE NOTICE 'Created audit session % with 20 racks', new_session_id;
END $$;

-- Verify the audit session setup
SELECT 
  'Audit Session Setup Complete' as status;

-- Show audit session details
SELECT 
  'Audit Session Details' as info,
  a.id,
  l.name as location_name,
  a.total_rack_count,
  a.status,
  a.started_at,
  u.username as started_by_user
FROM audit_sessions a
JOIN locations l ON a.location_id = l.id
JOIN users u ON a.started_by = u.id
WHERE a.status = 'active'
ORDER BY a.created_at DESC
LIMIT 1;

-- Show created racks summary
SELECT 
  'Racks Summary' as info,
  COUNT(*) as total_racks,
  COUNT(*) FILTER (WHERE status = 'available') as available_racks,
  MIN(rack_number) as first_rack,
  MAX(rack_number) as last_rack
FROM racks 
WHERE audit_session_id = (
  SELECT id FROM audit_sessions WHERE status = 'active' ORDER BY created_at DESC LIMIT 1
);

-- Show first few racks as examples
SELECT 
  'Sample Racks' as info,
  rack_number,
  status,
  created_at
FROM racks 
WHERE audit_session_id = (
  SELECT id FROM audit_sessions WHERE status = 'active' ORDER BY created_at DESC LIMIT 1
)
ORDER BY rack_number
LIMIT 5;