-- 27. Resolve Duplicate Email Constraint
-- Quick fix for the duplicate key violation on saleem@poppatjamals.com

-- First, let's see what we have
SELECT 
  'Current Users with Target Emails' as info,
  id, username, email, role, active
FROM users 
WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
   OR username IN ('saleem', 'supervisor1', 'scanner1')
ORDER BY email, username;

-- Check auth.users table
SELECT 
  'Auth Users' as info,
  id, email, raw_user_meta_data->>'username' as username
FROM auth.users 
WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
ORDER BY email;

-- Strategy: Remove duplicates, keep the best record for each user
DO $$
DECLARE
    rec RECORD;
    keep_id UUID;
BEGIN
    -- Handle saleem@poppatjamals.com duplicates
    SELECT COUNT(*) FROM users WHERE email = 'saleem@poppatjamals.com' INTO rec;
    IF rec.count > 1 THEN
        -- Keep the one with username 'saleem' if it exists, otherwise keep the first one
        SELECT id INTO keep_id FROM users 
        WHERE email = 'saleem@poppatjamals.com' 
        ORDER BY CASE WHEN username = 'saleem' THEN 0 ELSE 1 END, created_at
        LIMIT 1;
        
        -- Delete other duplicates
        DELETE FROM users 
        WHERE email = 'saleem@poppatjamals.com' AND id != keep_id;
        
        -- Ensure the kept record has correct data
        UPDATE users SET 
            username = 'saleem',
            role = 'superuser',
            active = true,
            location_ids = COALESCE(location_ids, ARRAY(SELECT id FROM locations LIMIT 5))
        WHERE id = keep_id;
        
        RAISE NOTICE 'Resolved saleem@poppatjamals.com duplicates, kept ID: %', keep_id;
    END IF;

    -- Handle supervisor1@test.com duplicates  
    SELECT COUNT(*) FROM users WHERE email = 'supervisor1@test.com' INTO rec;
    IF rec.count > 1 THEN
        SELECT id INTO keep_id FROM users 
        WHERE email = 'supervisor1@test.com' 
        ORDER BY CASE WHEN username = 'supervisor1' THEN 0 ELSE 1 END, created_at
        LIMIT 1;
        
        DELETE FROM users 
        WHERE email = 'supervisor1@test.com' AND id != keep_id;
        
        UPDATE users SET 
            username = 'supervisor1',
            role = 'supervisor', 
            active = true,
            location_ids = COALESCE(location_ids, ARRAY(SELECT id FROM locations LIMIT 2))
        WHERE id = keep_id;
        
        RAISE NOTICE 'Resolved supervisor1@test.com duplicates, kept ID: %', keep_id;
    END IF;

    -- Handle scanner1@test.com duplicates
    SELECT COUNT(*) FROM users WHERE email = 'scanner1@test.com' INTO rec;
    IF rec.count > 1 THEN
        SELECT id INTO keep_id FROM users 
        WHERE email = 'scanner1@test.com' 
        ORDER BY CASE WHEN username = 'scanner1' THEN 0 ELSE 1 END, created_at
        LIMIT 1;
        
        DELETE FROM users 
        WHERE email = 'scanner1@test.com' AND id != keep_id;
        
        UPDATE users SET 
            username = 'scanner1',
            role = 'scanner',
            active = true,
            location_ids = COALESCE(location_ids, ARRAY(SELECT id FROM locations LIMIT 1))
        WHERE id = keep_id;
        
        RAISE NOTICE 'Resolved scanner1@test.com duplicates, kept ID: %', keep_id;
    END IF;

    -- Now handle users that might not have emails yet
    -- Update saleem if exists without email
    IF EXISTS (SELECT 1 FROM users WHERE username = 'saleem' AND (email IS NULL OR email != 'saleem@poppatjamals.com')) THEN
        UPDATE users SET email = 'saleem@poppatjamals.com' 
        WHERE username = 'saleem' AND id NOT IN (
            SELECT id FROM users WHERE email = 'saleem@poppatjamals.com'
        );
        RAISE NOTICE 'Added email to existing saleem user';
    END IF;

    -- Update supervisor1 if exists without email  
    IF EXISTS (SELECT 1 FROM users WHERE username = 'supervisor1' AND (email IS NULL OR email != 'supervisor1@test.com')) THEN
        UPDATE users SET email = 'supervisor1@test.com' 
        WHERE username = 'supervisor1' AND id NOT IN (
            SELECT id FROM users WHERE email = 'supervisor1@test.com'  
        );
        RAISE NOTICE 'Added email to existing supervisor1 user';
    END IF;

    -- Update scanner1 if exists without email
    IF EXISTS (SELECT 1 FROM users WHERE username = 'scanner1' AND (email IS NULL OR email != 'scanner1@test.com')) THEN
        UPDATE users SET email = 'scanner1@test.com' 
        WHERE username = 'scanner1' AND id NOT IN (
            SELECT id FROM users WHERE email = 'scanner1@test.com'
        );
        RAISE NOTICE 'Added email to existing scanner1 user';
    END IF;
END $$;

-- Final verification
SELECT 
  'Final Users State' as info,
  id, username, email, role, active, array_length(location_ids, 1) as location_count
FROM users 
WHERE username IN ('saleem', 'supervisor1', 'scanner1')
ORDER BY username;

SELECT 'Duplicate email constraint resolved' as status;