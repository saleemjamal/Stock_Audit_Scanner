-- 21. Debug Current State and Fix Duplicates
-- This script first shows exactly what we're dealing with, then fixes it

-- ========================================
-- STEP 1: COMPLETE DATABASE ANALYSIS
-- ========================================

SELECT '=== COMPLETE USERS TABLE ANALYSIS ===' as section;

-- Show ALL users in the table
SELECT 
  'All Users in Database' as info,
  id, username, email, role, active,
  CASE 
    WHEN username IN ('saleem', 'supervisor1', 'scanner1') THEN 'ORIGINAL'
    WHEN email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com') THEN 'AUTO-CREATED'
    ELSE 'OTHER'
  END as user_type
FROM users
ORDER BY user_type, username, email;

-- Show all auth users
SELECT 
  'All Auth Users' as info,
  id, email, raw_user_meta_data->>'username' as username,
  email_confirmed_at IS NOT NULL as confirmed
FROM auth.users
WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
ORDER BY email;

-- Check for exact email duplicates
SELECT 
  'Email Duplicates Analysis' as info,
  email, 
  COUNT(*) as duplicate_count,
  array_agg(DISTINCT id) as user_ids,
  array_agg(DISTINCT username) as usernames
FROM users 
WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
GROUP BY email
HAVING COUNT(*) > 1;

-- Check foreign key dependencies for each user
SELECT 
  'Foreign Key Dependencies' as info,
  u.id as user_id,
  u.username,
  u.email,
  COALESCE(audit_sessions.count, 0) as audit_session_refs,
  COALESCE(racks.count, 0) as rack_refs,
  COALESCE(scans.count, 0) as scan_refs
FROM users u
LEFT JOIN (
  SELECT started_by as user_id, COUNT(*) as count FROM audit_sessions 
  WHERE started_by IS NOT NULL GROUP BY started_by
  UNION ALL
  SELECT completed_by as user_id, COUNT(*) as count FROM audit_sessions 
  WHERE completed_by IS NOT NULL GROUP BY completed_by
) audit_sessions ON u.id = audit_sessions.user_id
LEFT JOIN (
  SELECT scanner_id as user_id, COUNT(*) as count FROM racks 
  WHERE scanner_id IS NOT NULL GROUP BY scanner_id
  UNION ALL
  SELECT approved_by as user_id, COUNT(*) as count FROM racks 
  WHERE approved_by IS NOT NULL GROUP BY approved_by
) racks ON u.id = racks.user_id
LEFT JOIN (
  SELECT scanner_id as user_id, COUNT(*) as count FROM scans 
  WHERE scanner_id IS NOT NULL GROUP BY scanner_id
) scans ON u.id = scans.user_id
WHERE u.username IN ('saleem', 'supervisor1', 'scanner1') 
   OR u.email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
ORDER BY u.username, u.email;

-- ========================================
-- STEP 2: SURGICAL CLEANUP
-- ========================================

SELECT '=== STARTING SURGICAL CLEANUP ===' as section;

-- Strategy: Remove ALL email addresses temporarily, then set them one by one
DO $$
DECLARE
    cleanup_count INTEGER := 0;
    original_saleem_id UUID;
    original_supervisor1_id UUID;
    original_scanner1_id UUID;
BEGIN
    -- Get the IDs of the original users (ones with username set and foreign key refs)
    SELECT u.id INTO original_saleem_id 
    FROM users u
    WHERE u.username = 'saleem' 
      AND (
        EXISTS(SELECT 1 FROM audit_sessions WHERE started_by = u.id OR completed_by = u.id)
        OR EXISTS(SELECT 1 FROM racks WHERE scanner_id = u.id OR approved_by = u.id)
        OR EXISTS(SELECT 1 FROM scans WHERE scanner_id = u.id)
      );
      
    SELECT u.id INTO original_supervisor1_id 
    FROM users u
    WHERE u.username = 'supervisor1' 
      AND (
        EXISTS(SELECT 1 FROM audit_sessions WHERE started_by = u.id OR completed_by = u.id)
        OR EXISTS(SELECT 1 FROM racks WHERE scanner_id = u.id OR approved_by = u.id)
        OR EXISTS(SELECT 1 FROM scans WHERE scanner_id = u.id)
        OR u.username = 'supervisor1' -- Keep supervisor1 even if no refs yet
      );
      
    SELECT u.id INTO original_scanner1_id 
    FROM users u
    WHERE u.username = 'scanner1' 
      AND (
        EXISTS(SELECT 1 FROM audit_sessions WHERE started_by = u.id OR completed_by = u.id)
        OR EXISTS(SELECT 1 FROM racks WHERE scanner_id = u.id OR approved_by = u.id)
        OR EXISTS(SELECT 1 FROM scans WHERE scanner_id = u.id)
        OR u.username = 'scanner1' -- Keep scanner1 even if no refs yet
      );
      
    -- If we couldn't find originals by foreign keys, find by username
    IF original_saleem_id IS NULL THEN
        SELECT id INTO original_saleem_id FROM users WHERE username = 'saleem' LIMIT 1;
    END IF;
    IF original_supervisor1_id IS NULL THEN
        SELECT id INTO original_supervisor1_id FROM users WHERE username = 'supervisor1' LIMIT 1;
    END IF;
    IF original_scanner1_id IS NULL THEN
        SELECT id INTO original_scanner1_id FROM users WHERE username = 'scanner1' LIMIT 1;
    END IF;
    
    RAISE NOTICE 'Original user IDs - Saleem: %, Supervisor1: %, Scanner1: %', 
                 original_saleem_id, original_supervisor1_id, original_scanner1_id;
    
    -- Step 2a: Clear all emails temporarily to avoid constraint violations
    UPDATE users SET email = NULL 
    WHERE username IN ('saleem', 'supervisor1', 'scanner1')
       OR email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com');
    
    -- Step 2b: Delete any users that are NOT the originals
    DELETE FROM users 
    WHERE (email IS NULL OR email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com'))
      AND id NOT IN (original_saleem_id, original_supervisor1_id, original_scanner1_id)
      AND (username IS NULL OR username IN ('saleem', 'supervisor1', 'scanner1'));
      
    GET DIAGNOSTICS cleanup_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % duplicate user records', cleanup_count;
    
    -- Step 2c: Set emails on the original users only
    UPDATE users SET email = 'saleem@poppatjamals.com' WHERE id = original_saleem_id;
    UPDATE users SET email = 'supervisor1@test.com' WHERE id = original_supervisor1_id;
    UPDATE users SET email = 'scanner1@test.com' WHERE id = original_scanner1_id;
    
    RAISE NOTICE 'Set emails on original users';
END $$;

-- ========================================
-- STEP 3: CREATE AUTH USERS
-- ========================================

-- Now create/update auth users (same as before)
DO $$
DECLARE
    saleem_exists BOOLEAN;
    supervisor1_exists BOOLEAN; 
    scanner1_exists BOOLEAN;
BEGIN
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'saleem@poppatjamals.com') INTO saleem_exists;
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'supervisor1@test.com') INTO supervisor1_exists;
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'scanner1@test.com') INTO scanner1_exists;
    
    -- Create or update auth users
    IF NOT saleem_exists THEN
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

    IF NOT supervisor1_exists THEN
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

    IF NOT scanner1_exists THEN
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

SELECT '=== FINAL STATE VERIFICATION ===' as section;

SELECT 
  'Final Users Table' as info,
  username, email, role, active, id,
  array_length(location_ids, 1) as location_count
FROM users
WHERE username IN ('saleem', 'supervisor1', 'scanner1')
ORDER BY username;

SELECT 
  'Final Auth Users' as info,
  email, 
  raw_user_meta_data->>'username' as username, 
  email_confirmed_at IS NOT NULL as confirmed
FROM auth.users 
WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
ORDER BY email;

-- Check for any remaining duplicates
SELECT 
  'Duplicate Check' as info,
  email, 
  COUNT(*) as count,
  CASE WHEN COUNT(*) = 1 THEN 'CLEAN' ELSE 'STILL DUPLICATED!' END as status
FROM users 
WHERE email IS NOT NULL
GROUP BY email
HAVING COUNT(*) > 1;

SELECT 'SCRIPT 21 COMPLETE - Ready for Script 22' as final_status;