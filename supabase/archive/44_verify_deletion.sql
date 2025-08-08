-- 44. Verify Auth Users Deletion
-- Run this after deleting the users via Supabase Dashboard

SELECT '=== CHECKING AUTH USERS DELETION ===' as section;
SELECT 
  email,
  'STILL EXISTS - DELETE FROM DASHBOARD' as status
FROM auth.users 
WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com');

-- If the above returns no rows, the deletion was successful
SELECT 
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM auth.users 
      WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
    ) 
    THEN '✅ SUCCESS - All auth users deleted successfully'
    ELSE '❌ DELETION INCOMPLETE - Some users still exist'
  END as deletion_status;

-- Verify our users table is still intact
SELECT '=== USERS TABLE STILL INTACT ===' as section;
SELECT 
  username,
  email, 
  role,
  'PRESERVED' as status
FROM users 
WHERE username IN ('saleem', 'supervisor1', 'scanner1')
ORDER BY username;

SELECT '🎯 Next Step: Create new auth users via Supabase Dashboard' as next_instruction;
SELECT 'Go to: Authentication → Users → Add User' as dashboard_location;
SELECT 'Create: saleem@poppatjamals.com / password123' as user_1;
SELECT 'Create: supervisor1@test.com / password123' as user_2;
SELECT 'Create: scanner1@test.com / password123' as user_3;