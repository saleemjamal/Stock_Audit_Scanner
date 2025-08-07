-- 28. Create Auth Users (Clean Version)
-- Creates auth.users records without foreign key conflicts
-- Based on successful script 27 approach

-- First verify current state
SELECT 
  'Current Users Table State' as info,
  id, username, email, role, active, array_length(location_ids, 1) as location_count
FROM users 
WHERE username IN ('saleem', 'supervisor1', 'scanner1')
ORDER BY username;

-- Check existing auth users
SELECT 
  'Existing Auth Users' as info,
  id, email, raw_user_meta_data->>'username' as username,
  email_confirmed_at IS NOT NULL as confirmed
FROM auth.users 
WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
ORDER BY email;

-- Create auth users with proper conflict handling
DO $$
DECLARE
    auth_user_id UUID;
    existing_count INTEGER;
BEGIN
    -- Create saleem auth user
    SELECT COUNT(*) FROM auth.users WHERE email = 'saleem@poppatjamals.com' INTO existing_count;
    IF existing_count = 0 THEN
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

    -- Create supervisor1 auth user  
    SELECT COUNT(*) FROM auth.users WHERE email = 'supervisor1@test.com' INTO existing_count;
    IF existing_count = 0 THEN
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

    -- Create scanner1 auth user
    SELECT COUNT(*) FROM auth.users WHERE email = 'scanner1@test.com' INTO existing_count;
    IF existing_count = 0 THEN
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

-- Verify auth users were created successfully
SELECT 
  'Final Auth Users State' as info,
  id, email, 
  raw_user_meta_data->>'username' as username,
  raw_user_meta_data->>'role' as role,
  email_confirmed_at IS NOT NULL as confirmed,
  created_at
FROM auth.users 
WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
ORDER BY email;

-- Verify users table is ready for migration (has emails)
SELECT 
  'Users Table Migration Readiness' as info,
  username, email, role,
  CASE 
    WHEN email IS NOT NULL AND email LIKE '%@%' THEN 'READY'
    ELSE 'NOT_READY'
  END as migration_status
FROM users 
WHERE username IN ('saleem', 'supervisor1', 'scanner1')
ORDER BY username;

SELECT 'Auth users creation completed - Ready for Script 22' as final_status;