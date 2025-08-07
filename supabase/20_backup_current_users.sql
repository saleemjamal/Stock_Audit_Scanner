-- 20. Backup Current Users Before Migration
-- This creates a backup of current users before Supabase Auth migration
-- Run this first to ensure we can rollback if needed

-- Create backup table
CREATE TABLE users_backup_pre_migration AS 
SELECT * FROM users;

-- Verify backup was created successfully
SELECT 'Backup Created Successfully' as status, 
       COUNT(*) as user_count 
FROM users_backup_pre_migration;

-- Show current users that will be migrated
SELECT 
  'Current Users to Migrate' as info,
  username, 
  email, 
  role, 
  active, 
  has_password,
  CASE WHEN password_hash IS NOT NULL THEN 'SET' ELSE 'NOT SET' END as password_status,
  location_ids
FROM users_backup_pre_migration
WHERE active = true
ORDER BY role, username;

-- Show location mapping for reference
SELECT 
  'Location Mapping for Reference' as info,
  u.username,
  u.role,
  array_length(u.location_ids, 1) as location_count,
  (SELECT array_agg(l.name) FROM locations l WHERE l.id = ANY(u.location_ids)) as location_names
FROM users_backup_pre_migration u
WHERE u.active = true
ORDER BY u.role, u.username;