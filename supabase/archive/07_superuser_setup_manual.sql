-- Super User Setup: Manual Process
-- Execute this AFTER creating auth users in Supabase Dashboard

-- First, create a test location if it doesn't exist
INSERT INTO locations (name, address, city, state, active) 
VALUES ('Main Store', '123 Main St', 'City', 'State', true)
ON CONFLICT (name) DO NOTHING;

-- STEP 1: First create the auth users in Supabase Dashboard
-- Go to Authentication > Users and create:
-- 1. saleem@poppatjamals.com with password
-- 2. scanner1@test.com with password (optional for testing)
-- 3. supervisor1@test.com with password (optional for testing)

-- STEP 2: After creating auth users, get their UUIDs and run these INSERT statements
-- Replace 'YOUR_ACTUAL_UUID_HERE' with the real UUIDs from auth.users

-- Example for superuser (replace with actual UUID):
-- INSERT INTO users (
--   id, 
--   email, 
--   username,
--   full_name, 
--   role, 
--   location_ids, 
--   active,
--   has_password,
--   created_at,
--   updated_at
-- ) VALUES (
--   'YOUR_ACTUAL_SALEEM_UUID_HERE', 
--   'saleem@poppatjamals.com',
--   'saleem',
--   'Saleem Admin', 
--   'superuser', 
--   ARRAY(SELECT id FROM locations), -- Access to all locations
--   true,
--   true,
--   NOW(),
--   NOW()
-- );

-- Example for test scanner (replace with actual UUID):
-- INSERT INTO users (
--   id,
--   email,
--   username, 
--   full_name,
--   role,
--   location_ids,
--   active,
--   has_password
-- ) VALUES (
--   'YOUR_ACTUAL_SCANNER_UUID_HERE',
--   'scanner1@test.com',
--   'scanner1',
--   'Test Scanner',
--   'scanner', 
--   ARRAY[1], -- Assigned to first location
--   true,
--   true
-- );

-- Example for test supervisor (replace with actual UUID):
-- INSERT INTO users (
--   id,
--   email,
--   username,
--   full_name, 
--   role,
--   location_ids,
--   active,
--   has_password
-- ) VALUES (
--   'YOUR_ACTUAL_SUPERVISOR_UUID_HERE',
--   'supervisor1@test.com', 
--   'supervisor1',
--   'Test Supervisor',
--   'supervisor',
--   ARRAY[1], -- Assigned to first location
--   true,
--   true
-- );

-- STEP 3: Create a sample audit session (uncomment after adding users)
-- INSERT INTO audit_sessions (
--   id,
--   location_id,
--   total_rack_count,
--   status,
--   started_at,
--   started_by,
--   notes
-- ) VALUES (
--   gen_random_uuid(),
--   1, -- First location
--   10, -- 10 racks total
--   'active',
--   NOW(),
--   'YOUR_ACTUAL_SALEEM_UUID_HERE', -- Started by superuser
--   'Sample audit session for testing'
-- );

-- STEP 4: Create sample racks (uncomment after audit session)
-- INSERT INTO racks (
--   audit_session_id,
--   location_id, 
--   rack_number,
--   status
-- ) 
-- SELECT 
--   (SELECT id FROM audit_sessions WHERE total_rack_count = 10 ORDER BY created_at DESC LIMIT 1),
--   1,
--   'A1-' || generate_series(1, 10),
--   'available';

-- Query to see what auth users exist (run this first)
SELECT 'Run this query to see existing auth users:' as instruction;
SELECT 
  'SELECT id, email, created_at FROM auth.users ORDER BY created_at;' as query_to_run;

-- Query to check locations
SELECT 'Locations available:' as status, id, name FROM locations;