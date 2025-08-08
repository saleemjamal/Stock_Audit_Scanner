-- 38. Final Auth Fix - Align user IDs between auth.users and users table
-- Since auth.users already exist, we need to update the users table to match their IDs

-- First, check current state
SELECT '=== CURRENT STATE ===' as section;
SELECT 
  au.id as auth_id,
  au.email,
  u.id as user_id,
  u.username,
  au.id = u.id as ids_match
FROM auth.users au
LEFT JOIN users u ON u.email = au.email
WHERE au.email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
ORDER BY au.email;

-- Temporarily disable triggers that might interfere
ALTER TABLE users DISABLE TRIGGER ALL;

-- Update users table to match auth.users IDs
DO $$
DECLARE
    auth_user_id UUID;
    old_user_id UUID;
BEGIN
    -- Fix saleem
    SELECT id INTO auth_user_id FROM auth.users WHERE email = 'saleem@poppatjamals.com';
    SELECT id INTO old_user_id FROM users WHERE username = 'saleem';
    
    IF auth_user_id IS NOT NULL AND old_user_id IS NOT NULL AND auth_user_id != old_user_id THEN
        -- First update foreign key references
        UPDATE audit_sessions SET started_by = auth_user_id WHERE started_by = old_user_id;
        UPDATE audit_sessions SET completed_by = auth_user_id WHERE completed_by = old_user_id;
        UPDATE racks SET scanner_id = auth_user_id WHERE scanner_id = old_user_id;
        UPDATE racks SET approved_by = auth_user_id WHERE approved_by = old_user_id;
        UPDATE racks SET rejected_by = auth_user_id WHERE rejected_by = old_user_id;
        UPDATE scans SET scanner_id = auth_user_id WHERE scanner_id = old_user_id;
        UPDATE notifications SET user_id = auth_user_id WHERE user_id = old_user_id;
        UPDATE notifications SET created_by = auth_user_id WHERE created_by = old_user_id;
        
        -- Now update the user record
        UPDATE users SET id = auth_user_id WHERE username = 'saleem';
        RAISE NOTICE 'Updated saleem ID from % to %', old_user_id, auth_user_id;
    END IF;
    
    -- Fix supervisor1
    SELECT id INTO auth_user_id FROM auth.users WHERE email = 'supervisor1@test.com';
    SELECT id INTO old_user_id FROM users WHERE username = 'supervisor1';
    
    IF auth_user_id IS NOT NULL AND old_user_id IS NOT NULL AND auth_user_id != old_user_id THEN
        -- First update foreign key references
        UPDATE audit_sessions SET started_by = auth_user_id WHERE started_by = old_user_id;
        UPDATE audit_sessions SET completed_by = auth_user_id WHERE completed_by = old_user_id;
        UPDATE racks SET scanner_id = auth_user_id WHERE scanner_id = old_user_id;
        UPDATE racks SET approved_by = auth_user_id WHERE approved_by = old_user_id;
        UPDATE racks SET rejected_by = auth_user_id WHERE rejected_by = old_user_id;
        UPDATE scans SET scanner_id = auth_user_id WHERE scanner_id = old_user_id;
        UPDATE notifications SET user_id = auth_user_id WHERE user_id = old_user_id;
        UPDATE notifications SET created_by = auth_user_id WHERE created_by = old_user_id;
        
        -- Now update the user record
        UPDATE users SET id = auth_user_id WHERE username = 'supervisor1';
        RAISE NOTICE 'Updated supervisor1 ID from % to %', old_user_id, auth_user_id;
    END IF;
    
    -- Fix scanner1
    SELECT id INTO auth_user_id FROM auth.users WHERE email = 'scanner1@test.com';
    SELECT id INTO old_user_id FROM users WHERE username = 'scanner1';
    
    IF auth_user_id IS NOT NULL AND old_user_id IS NOT NULL AND auth_user_id != old_user_id THEN
        -- First update foreign key references
        UPDATE audit_sessions SET started_by = auth_user_id WHERE started_by = old_user_id;
        UPDATE audit_sessions SET completed_by = auth_user_id WHERE completed_by = old_user_id;
        UPDATE racks SET scanner_id = auth_user_id WHERE scanner_id = old_user_id;
        UPDATE racks SET approved_by = auth_user_id WHERE approved_by = old_user_id;
        UPDATE racks SET rejected_by = auth_user_id WHERE rejected_by = old_user_id;
        UPDATE scans SET scanner_id = auth_user_id WHERE scanner_id = old_user_id;
        UPDATE notifications SET user_id = auth_user_id WHERE user_id = old_user_id;
        UPDATE notifications SET created_by = auth_user_id WHERE created_by = old_user_id;
        
        -- Now update the user record
        UPDATE users SET id = auth_user_id WHERE username = 'scanner1';
        RAISE NOTICE 'Updated scanner1 ID from % to %', old_user_id, auth_user_id;
    END IF;
    
END $$;

-- Re-enable triggers
ALTER TABLE users ENABLE TRIGGER ALL;

-- Update auth.users metadata to include username for easier reference
UPDATE auth.users 
SET raw_user_meta_data = jsonb_build_object(
    'username', 'saleem',
    'role', 'superuser',
    'full_name', 'Saleem Jamal'
)
WHERE email = 'saleem@poppatjamals.com';

UPDATE auth.users 
SET raw_user_meta_data = jsonb_build_object(
    'username', 'supervisor1',
    'role', 'supervisor',
    'full_name', 'Supervisor One'
)
WHERE email = 'supervisor1@test.com';

UPDATE auth.users 
SET raw_user_meta_data = jsonb_build_object(
    'username', 'scanner1',
    'role', 'scanner',
    'full_name', 'Scanner One'
)
WHERE email = 'scanner1@test.com';

-- Verify the fix
SELECT '=== AFTER FIX ===' as section;
SELECT 
  au.id as auth_id,
  au.email,
  u.id as user_id,
  u.username,
  u.role,
  au.id = u.id as ids_match,
  au.raw_user_meta_data->>'username' as meta_username,
  au.raw_user_meta_data->>'role' as meta_role
FROM auth.users au
JOIN users u ON u.id = au.id
WHERE au.email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
ORDER BY au.email;

-- Test authentication capability
SELECT '=== AUTH TEST ===' as section;
SELECT 
  email,
  encrypted_password IS NOT NULL as has_password,
  email_confirmed_at IS NOT NULL as email_confirmed,
  aud = 'authenticated' as correct_aud,
  role = 'authenticated' as correct_role
FROM auth.users 
WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
ORDER BY email;

SELECT '✅ AUTH FIX COMPLETE - Users table now matches auth.users IDs' as final_status;