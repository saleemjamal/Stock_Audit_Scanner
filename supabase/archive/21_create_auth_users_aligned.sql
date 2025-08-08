-- 21. Create Supabase Auth Users (ALIGNED WITH SCRIPTS 22-23)
-- This script creates Supabase Auth users and prepares users table for migration
-- Run after disabling email confirmation in Supabase Dashboard

-- Step 1: Update existing users table records with emails (required for Script 22-23)
UPDATE users SET email = 'saleem@poppatjamals.com' WHERE username = 'saleem';
UPDATE users SET email = 'supervisor1@test.com' WHERE username = 'supervisor1';  
UPDATE users SET email = 'scanner1@test.com' WHERE username = 'scanner1';

-- Step 2: Create auth users with proper error handling
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
        -- Update existing auth user
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

-- Step 3: Handle any duplicate users created by handle_new_user() trigger
DO $$
DECLARE
    saleem_auth_id UUID;
    supervisor1_auth_id UUID;
    scanner1_auth_id UUID;
    duplicate_count INTEGER;
BEGIN
    -- Get auth user IDs
    SELECT id INTO saleem_auth_id FROM auth.users WHERE email = 'saleem@poppatjamals.com';
    SELECT id INTO supervisor1_auth_id FROM auth.users WHERE email = 'supervisor1@test.com';  
    SELECT id INTO scanner1_auth_id FROM auth.users WHERE email = 'scanner1@test.com';
    
    -- Check for and clean up any duplicate users created by trigger
    SELECT COUNT(*) INTO duplicate_count
    FROM users 
    WHERE id IN (saleem_auth_id, supervisor1_auth_id, scanner1_auth_id)
      AND email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
      AND username IS NULL; -- These would be auto-created by trigger
      
    IF duplicate_count > 0 THEN
        RAISE NOTICE 'Found % duplicate users created by handle_new_user trigger, cleaning up...', duplicate_count;
        
        -- Delete duplicates that don't have foreign key dependencies
        DELETE FROM users 
        WHERE id IN (saleem_auth_id, supervisor1_auth_id, scanner1_auth_id)
          AND username IS NULL -- Auto-created records
          AND id NOT IN (SELECT DISTINCT started_by FROM audit_sessions WHERE started_by IS NOT NULL)
          AND id NOT IN (SELECT DISTINCT completed_by FROM audit_sessions WHERE completed_by IS NOT NULL)
          AND id NOT IN (SELECT DISTINCT scanner_id FROM racks WHERE scanner_id IS NOT NULL)
          AND id NOT IN (SELECT DISTINCT approved_by FROM racks WHERE approved_by IS NOT NULL)
          AND id NOT IN (SELECT DISTINCT scanner_id FROM scans WHERE scanner_id IS NOT NULL);
          
        RAISE NOTICE 'Cleaned up duplicate user records';
    ELSE
        RAISE NOTICE 'No duplicate users found';
    END IF;
END $$;

-- Verification: Show current state
SELECT 'Step 1 Complete - Auth Users Created and Users Table Prepared' as status;

SELECT 
  'Auth Users' as section,
  email, 
  raw_user_meta_data->>'username' as username, 
  raw_user_meta_data->>'role' as role,
  email_confirmed_at IS NOT NULL as confirmed,
  id
FROM auth.users 
WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
ORDER BY 
  CASE raw_user_meta_data->>'role'
    WHEN 'superuser' THEN 1
    WHEN 'supervisor' THEN 2  
    WHEN 'scanner' THEN 3
  END;

SELECT 
  'Users Table (Ready for Schema Update)' as section,
  username, email, role, active, id,
  array_length(location_ids, 1) as location_count
FROM users
WHERE username IN ('saleem', 'supervisor1', 'scanner1')
ORDER BY role;

-- Verify emails match (required for Script 23 JOIN)
SELECT 
  'Email Matching Verification' as section,
  u.username, 
  u.email as user_email, 
  au.email as auth_email,
  CASE WHEN u.email = au.email THEN 'MATCH' ELSE 'MISMATCH' END as status
FROM users u
FULL OUTER JOIN auth.users au ON u.email = au.email
WHERE u.username IN ('saleem', 'supervisor1', 'scanner1')
   OR au.email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
ORDER BY u.username;

SELECT 'Ready for Schema Update (Script 22)' as next_step;