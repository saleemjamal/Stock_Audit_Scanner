-- 21. Direct Fix - Work with Existing Constraints
-- This script works around the NOT NULL email constraint

-- ========================================
-- STEP 1: ANALYZE CURRENT STATE
-- ========================================

SELECT '=== CURRENT STATE ANALYSIS ===' as section;

-- Show all users with potential conflicts
SELECT 
  'All Relevant Users' as info,
  id, username, email, role,
  CASE 
    WHEN username IN ('saleem', 'supervisor1', 'scanner1') AND email NOT LIKE '%@%' THEN 'ORIGINAL_NO_EMAIL'
    WHEN username IN ('saleem', 'supervisor1', 'scanner1') AND email LIKE '%@%' THEN 'ORIGINAL_WITH_EMAIL'
    WHEN username IS NULL AND email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com') THEN 'AUTO_CREATED'
    ELSE 'OTHER'
  END as user_type
FROM users
WHERE username IN ('saleem', 'supervisor1', 'scanner1') 
   OR email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
ORDER BY user_type, email, username;

-- Check what auth users exist
SELECT 
  'Existing Auth Users' as info,
  email, id, raw_user_meta_data->>'username' as username
FROM auth.users
WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com');

-- ========================================
-- STEP 2: DIRECT APPROACH - MERGE DUPLICATES
-- ========================================

DO $$
DECLARE
    saleem_original_id UUID;
    supervisor1_original_id UUID;
    scanner1_original_id UUID;
    saleem_duplicate_id UUID;
    supervisor1_duplicate_id UUID;
    scanner1_duplicate_id UUID;
    saleem_auth_id UUID;
    supervisor1_auth_id UUID;
    scanner1_auth_id UUID;
BEGIN
    -- Find original users (by username)
    SELECT id INTO saleem_original_id FROM users WHERE username = 'saleem' LIMIT 1;
    SELECT id INTO supervisor1_original_id FROM users WHERE username = 'supervisor1' LIMIT 1;
    SELECT id INTO scanner1_original_id FROM users WHERE username = 'scanner1' LIMIT 1;
    
    -- Find duplicate users (by email, no username)
    SELECT id INTO saleem_duplicate_id FROM users 
    WHERE email = 'saleem@poppatjamals.com' AND (username IS NULL OR username != 'saleem') LIMIT 1;
    
    SELECT id INTO supervisor1_duplicate_id FROM users 
    WHERE email = 'supervisor1@test.com' AND (username IS NULL OR username != 'supervisor1') LIMIT 1;
    
    SELECT id INTO scanner1_duplicate_id FROM users 
    WHERE email = 'scanner1@test.com' AND (username IS NULL OR username != 'scanner1') LIMIT 1;
    
    -- Get auth user IDs
    SELECT id INTO saleem_auth_id FROM auth.users WHERE email = 'saleem@poppatjamals.com';
    SELECT id INTO supervisor1_auth_id FROM auth.users WHERE email = 'supervisor1@test.com';
    SELECT id INTO scanner1_auth_id FROM auth.users WHERE email = 'scanner1@test.com';
    
    RAISE NOTICE 'Saleem - Original: %, Duplicate: %, Auth: %', saleem_original_id, saleem_duplicate_id, saleem_auth_id;
    RAISE NOTICE 'Supervisor1 - Original: %, Duplicate: %, Auth: %', supervisor1_original_id, supervisor1_duplicate_id, supervisor1_auth_id;
    RAISE NOTICE 'Scanner1 - Original: %, Duplicate: %, Auth: %', scanner1_original_id, scanner1_duplicate_id, scanner1_auth_id;
    
    -- SALEEM: Handle the conflict
    IF saleem_original_id IS NOT NULL AND saleem_duplicate_id IS NOT NULL THEN
        -- Delete the duplicate (auto-created one)
        DELETE FROM users WHERE id = saleem_duplicate_id;
        -- Update original with email
        UPDATE users SET email = 'saleem@poppatjamals.com' WHERE id = saleem_original_id;
        RAISE NOTICE 'Saleem: Deleted duplicate, updated original with email';
    ELSIF saleem_original_id IS NOT NULL THEN
        -- Just update original with email
        UPDATE users SET email = 'saleem@poppatjamals.com' WHERE id = saleem_original_id;
        RAISE NOTICE 'Saleem: Updated original with email';
    ELSIF saleem_duplicate_id IS NOT NULL THEN
        -- Update duplicate to have proper username
        UPDATE users SET username = 'saleem', role = 'superuser', location_ids = ARRAY[1,2,3,4] WHERE id = saleem_duplicate_id;
        RAISE NOTICE 'Saleem: Updated duplicate to become original';
    END IF;
    
    -- SUPERVISOR1: Handle the conflict
    IF supervisor1_original_id IS NOT NULL AND supervisor1_duplicate_id IS NOT NULL THEN
        DELETE FROM users WHERE id = supervisor1_duplicate_id;
        UPDATE users SET email = 'supervisor1@test.com' WHERE id = supervisor1_original_id;
        RAISE NOTICE 'Supervisor1: Deleted duplicate, updated original with email';
    ELSIF supervisor1_original_id IS NOT NULL THEN
        UPDATE users SET email = 'supervisor1@test.com' WHERE id = supervisor1_original_id;
        RAISE NOTICE 'Supervisor1: Updated original with email';
    ELSIF supervisor1_duplicate_id IS NOT NULL THEN
        UPDATE users SET username = 'supervisor1', role = 'supervisor', location_ids = ARRAY[1,2] WHERE id = supervisor1_duplicate_id;
        RAISE NOTICE 'Supervisor1: Updated duplicate to become original';
    END IF;
    
    -- SCANNER1: Handle the conflict
    IF scanner1_original_id IS NOT NULL AND scanner1_duplicate_id IS NOT NULL THEN
        DELETE FROM users WHERE id = scanner1_duplicate_id;
        UPDATE users SET email = 'scanner1@test.com' WHERE id = scanner1_original_id;
        RAISE NOTICE 'Scanner1: Deleted duplicate, updated original with email';
    ELSIF scanner1_original_id IS NOT NULL THEN
        UPDATE users SET email = 'scanner1@test.com' WHERE id = scanner1_original_id;
        RAISE NOTICE 'Scanner1: Updated original with email';
    ELSIF scanner1_duplicate_id IS NOT NULL THEN
        UPDATE users SET username = 'scanner1', role = 'scanner', location_ids = ARRAY[1] WHERE id = scanner1_duplicate_id;
        RAISE NOTICE 'Scanner1: Updated duplicate to become original';
    END IF;
END $$;

-- ========================================
-- STEP 3: ENSURE AUTH USERS EXIST
-- ========================================

DO $$
BEGIN
    -- Create auth users if they don't exist
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'saleem@poppatjamals.com') THEN
        INSERT INTO auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, created_at, updated_at,
          raw_app_meta_data, raw_user_meta_data
        ) VALUES (
          '00000000-0000-0000-0000-000000000000',
          gen_random_uuid(), 'authenticated', 'authenticated',
          'saleem@poppatjamals.com', crypt('password123', gen_salt('bf')),
          NOW(), NOW(), NOW(),
          '{"provider": "email", "providers": ["email"]}',
          '{"username": "saleem", "role": "superuser"}'
        );
        RAISE NOTICE 'Created auth user: saleem@poppatjamals.com';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'supervisor1@test.com') THEN
        INSERT INTO auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, created_at, updated_at,
          raw_app_meta_data, raw_user_meta_data
        ) VALUES (
          '00000000-0000-0000-0000-000000000000',
          gen_random_uuid(), 'authenticated', 'authenticated',
          'supervisor1@test.com', crypt('password123', gen_salt('bf')),
          NOW(), NOW(), NOW(),
          '{"provider": "email", "providers": ["email"]}',
          '{"username": "supervisor1", "role": "supervisor"}'
        );
        RAISE NOTICE 'Created auth user: supervisor1@test.com';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'scanner1@test.com') THEN
        INSERT INTO auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, created_at, updated_at,
          raw_app_meta_data, raw_user_meta_data
        ) VALUES (
          '00000000-0000-0000-0000-000000000000',
          gen_random_uuid(), 'authenticated', 'authenticated',
          'scanner1@test.com', crypt('password123', gen_salt('bf')),
          NOW(), NOW(), NOW(),
          '{"provider": "email", "providers": ["email"]}',
          '{"username": "scanner1", "role": "scanner"}'
        );
        RAISE NOTICE 'Created auth user: scanner1@test.com';
    END IF;
END $$;

-- ========================================
-- STEP 4: FINAL VERIFICATION
-- ========================================

SELECT '=== FINAL RESULTS ===' as section;

SELECT 
  'Final Users State' as info,
  username, email, role, active, id
FROM users
WHERE username IN ('saleem', 'supervisor1', 'scanner1')
ORDER BY username;

SELECT 
  'Auth Users State' as info,
  email, raw_user_meta_data->>'username' as username
FROM auth.users
WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
ORDER BY email;

-- Verify readiness for Scripts 22-23
SELECT 
  'Migration Readiness' as info,
  u.username,
  u.email as user_email,
  au.email as auth_email,
  CASE WHEN u.email = au.email THEN 'READY' ELSE 'NOT_READY' END as status
FROM users u
JOIN auth.users au ON u.email = au.email
WHERE u.username IN ('saleem', 'supervisor1', 'scanner1')
ORDER BY u.username;

SELECT 'MIGRATION STEP 1 COMPLETE - Ready for Script 22' as final_status;