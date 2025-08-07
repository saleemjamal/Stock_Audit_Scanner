-- 21. Create Supabase Auth Users (FINAL - HANDLES DUPLICATES)
-- This script handles the duplicate user records created by handle_new_user() trigger
-- Run after disabling email confirmation in Supabase Dashboard

-- Step 1: Analyze current state
SELECT 'Current State Analysis' as section;

SELECT 'Original Users (with foreign keys)' as info, username, email, id, role
FROM users 
WHERE username IN ('saleem', 'supervisor1', 'scanner1')
ORDER BY username;

SELECT 'Auto-created Users (duplicates)' as info, username, email, id, role
FROM users 
WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
  AND (username IS NULL OR username NOT IN ('saleem', 'supervisor1', 'scanner1'))
ORDER BY email;

SELECT 'Auth Users' as info, email, raw_user_meta_data->>'username' as username
FROM auth.users 
WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
ORDER BY email;

-- Step 2: Delete duplicate auto-created user records (keep originals)
DO $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Delete auto-created duplicates that have no foreign key dependencies
    DELETE FROM users 
    WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
      AND (username IS NULL OR username NOT IN ('saleem', 'supervisor1', 'scanner1'))
      AND id NOT IN (SELECT DISTINCT started_by FROM audit_sessions WHERE started_by IS NOT NULL)
      AND id NOT IN (SELECT DISTINCT completed_by FROM audit_sessions WHERE completed_by IS NOT NULL)
      AND id NOT IN (SELECT DISTINCT scanner_id FROM racks WHERE scanner_id IS NOT NULL)
      AND id NOT IN (SELECT DISTINCT approved_by FROM racks WHERE approved_by IS NOT NULL)
      AND id NOT IN (SELECT DISTINCT scanner_id FROM scans WHERE scanner_id IS NOT NULL);
      
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % duplicate user records created by handle_new_user trigger', deleted_count;
END $$;

-- Step 3: Now safely update original user records with emails
UPDATE users SET email = 'saleem@poppatjamals.com' WHERE username = 'saleem';
UPDATE users SET email = 'supervisor1@test.com' WHERE username = 'supervisor1';  
UPDATE users SET email = 'scanner1@test.com' WHERE username = 'scanner1';

-- Step 4: Ensure auth users exist with proper credentials
DO $$
DECLARE
    saleem_exists BOOLEAN;
    supervisor1_exists BOOLEAN; 
    scanner1_exists BOOLEAN;
BEGIN
    -- Check if auth users already exist
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'saleem@poppatjamals.com') INTO saleem_exists;
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'supervisor1@test.com') INTO supervisor1_exists;
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'scanner1@test.com') INTO scanner1_exists;
    
    -- Create saleem auth user if not exists
    IF NOT saleem_exists THEN
        INSERT INTO auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, created_at, updated_at,
          raw_app_meta_data, raw_user_meta_data
        ) VALUES (
          '00000000-0000-0000-0000-000000000000',
          gen_random_uuid(), 'authenticated', 'authenticated',
          'saleem@poppatjamals.com',
          crypt('password123', gen_salt('bf')),
          NOW(), NOW(), NOW(),
          '{"provider": "email", "providers": ["email"]}',
          '{"username": "saleem", "role": "superuser"}'
        );
        RAISE NOTICE 'Created auth user: saleem@poppatjamals.com';
    ELSE
        -- Update existing auth user to ensure correct password/metadata
        UPDATE auth.users SET
          encrypted_password = crypt('password123', gen_salt('bf')),
          email_confirmed_at = NOW(),
          updated_at = NOW(),
          raw_user_meta_data = '{"username": "saleem", "role": "superuser"}'
        WHERE email = 'saleem@poppatjamals.com';
        RAISE NOTICE 'Updated existing auth user: saleem@poppatjamals.com';
    END IF;

    -- Create supervisor1 auth user if not exists
    IF NOT supervisor1_exists THEN
        INSERT INTO auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, created_at, updated_at,
          raw_app_meta_data, raw_user_meta_data
        ) VALUES (
          '00000000-0000-0000-0000-000000000000',
          gen_random_uuid(), 'authenticated', 'authenticated',
          'supervisor1@test.com',
          crypt('password123', gen_salt('bf')),
          NOW(), NOW(), NOW(),
          '{"provider": "email", "providers": ["email"]}',
          '{"username": "supervisor1", "role": "supervisor"}'
        );
        RAISE NOTICE 'Created auth user: supervisor1@test.com';
    ELSE
        UPDATE auth.users SET
          encrypted_password = crypt('password123', gen_salt('bf')),
          email_confirmed_at = NOW(),
          updated_at = NOW(),
          raw_user_meta_data = '{"username": "supervisor1", "role": "supervisor"}'
        WHERE email = 'supervisor1@test.com';
        RAISE NOTICE 'Updated existing auth user: supervisor1@test.com';
    END IF;

    -- Create scanner1 auth user if not exists  
    IF NOT scanner1_exists THEN
        INSERT INTO auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, created_at, updated_at,
          raw_app_meta_data, raw_user_meta_data
        ) VALUES (
          '00000000-0000-0000-0000-000000000000',
          gen_random_uuid(), 'authenticated', 'authenticated',
          'scanner1@test.com',
          crypt('password123', gen_salt('bf')),
          NOW(), NOW(), NOW(),
          '{"provider": "email", "providers": ["email"]}',
          '{"username": "scanner1", "role": "scanner"}'
        );
        RAISE NOTICE 'Created auth user: scanner1@test.com';
    ELSE
        UPDATE auth.users SET
          encrypted_password = crypt('password123', gen_salt('bf')),
          email_confirmed_at = NOW(),
          updated_at = NOW(),
          raw_user_meta_data = '{"username": "scanner1", "role": "scanner"}'
        WHERE email = 'scanner1@test.com';
        RAISE NOTICE 'Updated existing auth user: scanner1@test.com';
    END IF;
END $$;

-- Step 5: Final verification
SELECT 'Migration Step 1 Complete' as status;

SELECT 
  'Auth Users (Final)' as section,
  email, 
  raw_user_meta_data->>'username' as username, 
  raw_user_meta_data->>'role' as role,
  email_confirmed_at IS NOT NULL as confirmed
FROM auth.users 
WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
ORDER BY email;

SELECT 
  'Users Table (Final)' as section,
  username, email, role, active, 
  array_length(location_ids, 1) as location_count,
  id
FROM users
WHERE username IN ('saleem', 'supervisor1', 'scanner1')
ORDER BY username;

-- Verify no duplicates remain
SELECT 
  'Duplicate Check' as section,
  email, 
  COUNT(*) as count,
  CASE WHEN COUNT(*) = 1 THEN 'OK' ELSE 'DUPLICATE!' END as status
FROM users 
WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
GROUP BY email;

-- Verify emails match for Scripts 22-23
SELECT 
  'Email Matching for Migration' as section,
  u.username, 
  u.email as user_email, 
  au.email as auth_email,
  CASE WHEN u.email = au.email THEN 'READY' ELSE 'NOT READY' END as status
FROM users u
JOIN auth.users au ON u.email = au.email
WHERE u.username IN ('saleem', 'supervisor1', 'scanner1')
ORDER BY u.username;

SELECT 'Ready for Schema Update (Script 22)' as next_step;