-- Super User Setup: Fixed Version
-- Execute this AFTER running 05_auth_migration.sql and 06_rls_update_simple.sql

-- First, create a test location (using INSERT only if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM locations WHERE name = 'Main Store') THEN
        INSERT INTO locations (name, address, city, state, active) 
        VALUES ('Main Store', '123 Main St', 'City', 'State', true);
    END IF;
END $$;

-- Display current state
SELECT 'Database setup ready for manual user creation' as status;

-- Show existing locations
SELECT 'Available locations:' as info, id, name, active FROM locations;

-- Show auth users (this will help you get the UUIDs)
SELECT 'Check auth.users table for UUIDs after creating users in Dashboard' as instruction;

-- Instructions for manual setup
SELECT 'MANUAL STEPS REQUIRED:' as step_title,
'
1. Go to Supabase Dashboard > Authentication > Users
2. Click "Add user" and create: saleem@poppatjamals.com with password
3. Copy the generated UUID from the users list
4. Run this INSERT with the real UUID:

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
  ''REPLACE_WITH_ACTUAL_UUID'', 
  ''saleem@poppatjamals.com'',
  ''saleem'',
  ''Saleem Admin'', 
  ''superuser'', 
  ARRAY(SELECT id FROM locations),
  true,
  true
);

5. Test login with username: saleem, password: [your-password]
' as instructions;

-- Template for adding more users
SELECT 'For additional test users, use this template:' as template_title,
'
-- Test Scanner
INSERT INTO users (id, email, username, full_name, role, location_ids, active, has_password) 
VALUES (''SCANNER_UUID'', ''scanner1@test.com'', ''scanner1'', ''Test Scanner'', ''scanner'', ARRAY[1], true, true);

-- Test Supervisor  
INSERT INTO users (id, email, username, full_name, role, location_ids, active, has_password)
VALUES (''SUPERVISOR_UUID'', ''supervisor1@test.com'', ''supervisor1'', ''Test Supervisor'', ''supervisor'', ARRAY[1], true, true);
' as user_templates;