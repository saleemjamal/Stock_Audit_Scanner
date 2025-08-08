-- 23. Migrate User Data to Link with Supabase Auth
-- This script connects existing user records to new auth users
-- Run after updating users table schema

-- Store the old user IDs before we change them (for foreign key updates)
CREATE TEMP TABLE user_id_mapping AS
SELECT 
  u.id as old_id,
  u.username,
  u.email,
  au.id as new_id
FROM users u
JOIN auth.users au ON u.email = au.email;

-- Update users table with Supabase Auth user IDs
UPDATE users SET 
  id = (SELECT id FROM auth.users WHERE email = 'saleem@poppatjamals.com'),
  email = 'saleem@poppatjamals.com'
WHERE username = 'saleem';

UPDATE users SET 
  id = (SELECT id FROM auth.users WHERE email = 'supervisor1@test.com'),
  email = 'supervisor1@test.com'
WHERE username = 'supervisor1';

UPDATE users SET 
  id = (SELECT id FROM auth.users WHERE email = 'scanner1@test.com'),
  email = 'scanner1@test.com'
WHERE username = 'scanner1';

-- Update foreign key references in audit_sessions
UPDATE audit_sessions 
SET started_by = (SELECT new_id FROM user_id_mapping WHERE username = 'saleem')
WHERE started_by = (SELECT old_id FROM user_id_mapping WHERE username = 'saleem');

UPDATE audit_sessions 
SET completed_by = (SELECT new_id FROM user_id_mapping WHERE username = 'saleem')
WHERE completed_by = (SELECT old_id FROM user_id_mapping WHERE username = 'saleem');

-- Update foreign key references in racks (scanner_id, approved_by, rejected_by)
UPDATE racks 
SET scanner_id = m.new_id
FROM user_id_mapping m
WHERE racks.scanner_id = m.old_id;

UPDATE racks 
SET approved_by = m.new_id  
FROM user_id_mapping m
WHERE racks.approved_by = m.old_id;

UPDATE racks 
SET rejected_by = m.new_id
FROM user_id_mapping m
WHERE racks.rejected_by = m.old_id;

-- Update foreign key references in scans
UPDATE scans 
SET scanner_id = m.new_id
FROM user_id_mapping m
WHERE scans.scanner_id = m.old_id;

-- Update any other tables that reference users
UPDATE expenses 
SET entered_by = m.new_id
FROM user_id_mapping m
WHERE expenses.entered_by = m.old_id;

UPDATE expenses 
SET approved_by = m.new_id
FROM user_id_mapping m  
WHERE expenses.approved_by = m.old_id;

-- Update notifications
UPDATE notifications 
SET user_id = m.new_id
FROM user_id_mapping m
WHERE notifications.user_id = m.old_id;

-- Verify the migration
SELECT 'User Data Migration Complete' as status;

-- Show updated users with auth integration
SELECT 
  'Migrated Users' as info,
  u.username,
  u.email,
  u.role,
  u.active,
  CASE WHEN au.id IS NOT NULL THEN 'Linked to Auth' ELSE 'Missing Auth Link' END as auth_status,
  au.email_confirmed_at IS NOT NULL as confirmed
FROM users u
LEFT JOIN auth.users au ON u.id = au.id
WHERE u.username IN ('saleem', 'supervisor1', 'scanner1')
ORDER BY u.role;

-- Verify foreign key updates
SELECT 
  'Foreign Key Updates Verification' as info,
  'audit_sessions' as table_name,
  COUNT(*) as records_with_valid_user_refs
FROM audit_sessions 
WHERE started_by IN (SELECT id FROM users);

SELECT 
  'racks' as table_name,
  COUNT(*) as records_with_valid_scanner_refs
FROM racks 
WHERE scanner_id IN (SELECT id FROM users);

SELECT 
  'scans' as table_name,
  COUNT(*) as records_with_valid_scanner_refs  
FROM scans
WHERE scanner_id IN (SELECT id FROM users);