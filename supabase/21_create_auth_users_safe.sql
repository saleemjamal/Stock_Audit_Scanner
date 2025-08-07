-- 21. Create Supabase Auth Users (SAFE VERSION)
-- This script creates Supabase Auth users while preserving foreign key relationships
-- Run after disabling email confirmation in Supabase Dashboard

-- First, let's see what we're working with
SELECT 'Current State Before Migration' as info;

SELECT 'Existing Users' as section, username, email, role, id 
FROM users 
WHERE username IN ('saleem', 'supervisor1', 'scanner1');

SELECT 'Existing Auth Users' as section, email, id 
FROM auth.users 
WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com');

SELECT 'Foreign Key Dependencies' as section, 
       'audit_sessions' as table_name,
       COUNT(*) as dependent_records
FROM audit_sessions 
WHERE started_by IN (SELECT id FROM users WHERE username IN ('saleem', 'supervisor1', 'scanner1'))
   OR completed_by IN (SELECT id FROM users WHERE username IN ('saleem', 'supervisor1', 'scanner1'));

-- Strategy: Create new auth users, then update existing users table records to use auth UUIDs
-- This preserves all foreign key relationships

-- Step 1: Create auth users (skip if they already exist)
DO $$
BEGIN
    -- Create saleem auth user if not exists
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'saleem@poppatjamals.com') THEN
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
        RAISE NOTICE 'Created auth user for saleem';
    ELSE
        RAISE NOTICE 'Auth user for saleem already exists';
    END IF;

    -- Create supervisor1 auth user if not exists
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'supervisor1@test.com') THEN
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
        RAISE NOTICE 'Created auth user for supervisor1';
    ELSE
        RAISE NOTICE 'Auth user for supervisor1 already exists';
    END IF;

    -- Create scanner1 auth user if not exists
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'scanner1@test.com') THEN
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
        RAISE NOTICE 'Created auth user for scanner1';
    ELSE
        RAISE NOTICE 'Auth user for scanner1 already exists';
    END IF;
END $$;

-- Step 2: Handle any auto-created users table records from handle_new_user trigger
DO $$
DECLARE
    saleem_auth_id UUID;
    supervisor1_auth_id UUID;
    scanner1_auth_id UUID;
    saleem_user_id UUID;
    supervisor1_user_id UUID;
    scanner1_user_id UUID;
BEGIN
    -- Get auth user IDs
    SELECT id INTO saleem_auth_id FROM auth.users WHERE email = 'saleem@poppatjamals.com';
    SELECT id INTO supervisor1_auth_id FROM auth.users WHERE email = 'supervisor1@test.com';
    SELECT id INTO scanner1_auth_id FROM auth.users WHERE email = 'scanner1@test.com';
    
    -- Get existing users table IDs
    SELECT id INTO saleem_user_id FROM users WHERE username = 'saleem';
    SELECT id INTO supervisor1_user_id FROM users WHERE username = 'supervisor1';
    SELECT id INTO scanner1_user_id FROM users WHERE username = 'scanner1';
    
    RAISE NOTICE 'Auth IDs - Saleem: %, Supervisor1: %, Scanner1: %', 
                 saleem_auth_id, supervisor1_auth_id, scanner1_auth_id;
    RAISE NOTICE 'User IDs - Saleem: %, Supervisor1: %, Scanner1: %', 
                 saleem_user_id, supervisor1_user_id, scanner1_user_id;
    
    -- Delete any duplicate users created by handle_new_user trigger
    -- (Keep the original users, delete any auth-UUID ones that don't have foreign keys)
    DELETE FROM users 
    WHERE id IN (saleem_auth_id, supervisor1_auth_id, scanner1_auth_id)
      AND id NOT IN (saleem_user_id, supervisor1_user_id, scanner1_user_id)
      AND id NOT IN (SELECT DISTINCT started_by FROM audit_sessions WHERE started_by IS NOT NULL)
      AND id NOT IN (SELECT DISTINCT completed_by FROM audit_sessions WHERE completed_by IS NOT NULL)
      AND id NOT IN (SELECT DISTINCT scanner_id FROM racks WHERE scanner_id IS NOT NULL)
      AND id NOT IN (SELECT DISTINCT approved_by FROM racks WHERE approved_by IS NOT NULL)
      AND id NOT IN (SELECT DISTINCT scanner_id FROM scans WHERE scanner_id IS NOT NULL);
      
    RAISE NOTICE 'Cleaned up any duplicate user records created by trigger';
END $$;

-- Verify auth users were created successfully
SELECT 'Auth User Creation Complete' as status;

SELECT 
  'New Auth Users' as info,
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

-- Show existing users (these will be updated in Script 22-23)
SELECT 
  'Existing Users (to be migrated)' as info,
  username, email, role, active, id,
  array_length(location_ids, 1) as location_count
FROM users
WHERE username IN ('saleem', 'supervisor1', 'scanner1')
ORDER BY role;

SELECT 'Auth users created. Ready for Schema Update (Script 22)' as next_step;