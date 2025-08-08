-- 43. Backup Users Data Before Clean Recreation
-- Save current users table state so we can restore after creating proper auth users

SELECT '=== CURRENT USERS BACKUP ===' as section;
SELECT 
  id as old_user_id,
  username,
  email,
  role,
  full_name,
  location_ids,
  active,
  created_at,
  updated_at
FROM users 
WHERE username IN ('saleem', 'supervisor1', 'scanner1')
ORDER BY username;

-- Show the current problematic auth.users we'll delete
SELECT '=== CURRENT AUTH USERS (TO BE DELETED) ===' as section;
SELECT 
  id as old_auth_id,
  email,
  instance_id,
  created_at
FROM auth.users 
WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
ORDER BY email;

-- Check what foreign key references exist that we'll need to update
SELECT '=== FOREIGN KEY REFERENCES TO UPDATE ===' as section;

-- Check audit_sessions
SELECT 'audit_sessions references:' as table_name, COUNT(*) as count
FROM audit_sessions 
WHERE started_by IN (
  SELECT id FROM users WHERE username IN ('saleem', 'supervisor1', 'scanner1')
)
OR completed_by IN (
  SELECT id FROM users WHERE username IN ('saleem', 'supervisor1', 'scanner1')
);

-- Check racks
SELECT 'racks references:' as table_name, COUNT(*) as count  
FROM racks
WHERE scanner_id IN (
  SELECT id FROM users WHERE username IN ('saleem', 'supervisor1', 'scanner1')
)
OR approved_by IN (
  SELECT id FROM users WHERE username IN ('saleem', 'supervisor1', 'scanner1')
)
OR rejected_by IN (
  SELECT id FROM users WHERE username IN ('saleem', 'supervisor1', 'scanner1')
);

-- Check scans
SELECT 'scans references:' as table_name, COUNT(*) as count
FROM scans
WHERE scanner_id IN (
  SELECT id FROM users WHERE username IN ('saleem', 'supervisor1', 'scanner1')
);

-- Check notifications  
SELECT 'notifications references:' as table_name, COUNT(*) as count
FROM notifications
WHERE user_id IN (
  SELECT id FROM users WHERE username IN ('saleem', 'supervisor1', 'scanner1')
)
OR created_by IN (
  SELECT id FROM users WHERE username IN ('saleem', 'supervisor1', 'scanner1')
);

SELECT '📋 BACKUP COMPLETE - Now proceed to delete auth.users via Supabase Dashboard' as next_step;
SELECT 'INSTRUCTIONS:' as info;
SELECT '1. Go to Supabase Dashboard → Authentication → Users' as step_1;
SELECT '2. Delete the 3 users: saleem@poppatjamals.com, supervisor1@test.com, scanner1@test.com' as step_2;  
SELECT '3. Come back and run the next script to verify deletion' as step_3;