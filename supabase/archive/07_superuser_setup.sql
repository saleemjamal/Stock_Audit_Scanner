-- Super User Setup: Create saleem@poppatjamals.com account
-- Execute this after 05_auth_migration.sql and 06_rls_update.sql

-- First, create a test location if it doesn't exist
INSERT INTO locations (name, address, city, state, active) 
VALUES ('Main Store', '123 Main St', 'City', 'State', true)
ON CONFLICT DO NOTHING;

-- Note: The actual Supabase auth user must be created through the Supabase Auth UI or API
-- This script prepares the profile for when the auth user exists

-- Create or update the super user profile
-- This will work once the auth.users entry exists
INSERT INTO users (
  id, 
  email, 
  username,
  full_name, 
  role, 
  location_ids, 
  active,
  has_password,
  created_at,
  updated_at
) VALUES (
  -- Note: Replace with actual UUID from auth.users after creating the auth account
  '00000000-0000-0000-0000-000000000001', 
  'saleem@poppatjamals.com',
  'saleem',
  'Saleem Admin', 
  'superuser', 
  ARRAY(SELECT id FROM locations), -- Access to all locations
  true,
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  role = EXCLUDED.role,
  location_ids = EXCLUDED.location_ids,
  active = EXCLUDED.active,
  has_password = EXCLUDED.has_password,
  updated_at = NOW();

-- Create some sample users for testing
-- Scanner user
INSERT INTO users (
  id,
  email,
  username, 
  full_name,
  role,
  location_ids,
  active,
  has_password
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  'scanner1@test.com',
  'scanner1',
  'Test Scanner',
  'scanner', 
  ARRAY[1], -- Assigned to first location
  true,
  false -- Will need to set password
) ON CONFLICT (id) DO NOTHING;

-- Supervisor user  
INSERT INTO users (
  id,
  email,
  username,
  full_name, 
  role,
  location_ids,
  active,
  has_password
) VALUES (
  '00000000-0000-0000-0000-000000000003',
  'supervisor1@test.com', 
  'supervisor1',
  'Test Supervisor',
  'supervisor',
  ARRAY[1], -- Assigned to first location
  true,
  false -- Will need to set password
) ON CONFLICT (id) DO NOTHING;

-- Create a sample audit session for testing
INSERT INTO audit_sessions (
  id,
  location_id,
  total_rack_count,
  status,
  started_at,
  started_by,
  notes
) VALUES (
  gen_random_uuid(),
  1, -- First location
  10, -- 10 racks total
  'active',
  NOW(),
  '00000000-0000-0000-0000-000000000001', -- Started by superuser
  'Sample audit session for testing'
) ON CONFLICT DO NOTHING;

-- Create sample racks for the audit session
INSERT INTO racks (
  audit_session_id,
  location_id, 
  rack_number,
  status
) 
SELECT 
  (SELECT id FROM audit_sessions WHERE total_rack_count = 10 LIMIT 1),
  1,
  'A1-' || generate_series(1, 10),
  'available'
ON CONFLICT DO NOTHING;

-- Display setup summary
SELECT 
  'Database setup completed' as status,
  (SELECT COUNT(*) FROM users) as total_users,
  (SELECT COUNT(*) FROM users WHERE role = 'superuser') as superusers,
  (SELECT COUNT(*) FROM locations) as total_locations,
  (SELECT COUNT(*) FROM audit_sessions) as audit_sessions,
  (SELECT COUNT(*) FROM racks) as total_racks;

-- Instructions for completing the setup:
SELECT 'IMPORTANT: Complete these steps in Supabase Dashboard:' as todo_title,
'
1. Go to Authentication > Users in Supabase Dashboard
2. Create auth user: saleem@poppatjamals.com with a secure password  
3. Copy the generated UUID from auth.users
4. Update the users table: UPDATE users SET id = ''[new-uuid]'' WHERE username = ''saleem''
5. Test login on mobile app with username: saleem, password: [your-password]
6. Create additional auth users for test accounts (scanner1, supervisor1)
7. Update their UUIDs in the users table as well
' as instructions;

-- Verification query to check setup
SELECT 
  username,
  email, 
  role,
  location_ids,
  active,
  has_password,
  created_at
FROM users 
ORDER BY role, created_at;