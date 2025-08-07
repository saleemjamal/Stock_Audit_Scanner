-- 21. Create Supabase Auth Users (SIMPLE VERSION)
-- This script creates Supabase Auth users and handles existing user conflicts
-- Run after disabling email confirmation in Supabase Dashboard

-- Delete existing auth users if they exist (clean slate approach)
DELETE FROM auth.users WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com');

-- Delete corresponding users table records if they exist
DELETE FROM users WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com');

-- Now create fresh auth users
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
) VALUES 
-- saleem (superuser)
(
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'saleem@poppatjamals.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"username": "saleem", "role": "superuser"}'
),
-- supervisor1
(
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'supervisor1@test.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"username": "supervisor1", "role": "supervisor"}'
),
-- scanner1
(
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'scanner1@test.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"username": "scanner1", "role": "scanner"}'
);

-- Wait a moment for any triggers to complete
SELECT pg_sleep(1);

-- Check if handle_new_user() created the users table records automatically
DO $$
DECLARE
    users_count INTEGER;
    saleem_auth_id UUID;
    supervisor1_auth_id UUID;
    scanner1_auth_id UUID;
BEGIN
    -- Get auth user IDs
    SELECT id INTO saleem_auth_id FROM auth.users WHERE email = 'saleem@poppatjamals.com';
    SELECT id INTO supervisor1_auth_id FROM auth.users WHERE email = 'supervisor1@test.com';
    SELECT id INTO scanner1_auth_id FROM auth.users WHERE email = 'scanner1@test.com';
    
    -- Check if users were auto-created by trigger
    SELECT COUNT(*) INTO users_count 
    FROM users 
    WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com');
    
    IF users_count = 0 THEN
        RAISE NOTICE 'No auto-created users found, creating manually...';
        
        -- Create users table records manually
        INSERT INTO users (id, email, username, full_name, role, active, location_ids, created_at)
        VALUES 
            (saleem_auth_id, 'saleem@poppatjamals.com', 'saleem', 'Saleem (Super User)', 'superuser', true, ARRAY[1,2,3,4], NOW()),
            (supervisor1_auth_id, 'supervisor1@test.com', 'supervisor1', 'Supervisor One', 'supervisor', true, ARRAY[1,2], NOW()),
            (scanner1_auth_id, 'scanner1@test.com', 'scanner1', 'Scanner One', 'scanner', true, ARRAY[1], NOW());
            
    ELSE
        RAISE NOTICE 'Found % auto-created users, updating them...', users_count;
        
        -- Update auto-created records with correct data
        UPDATE users SET
            username = CASE 
                WHEN email = 'saleem@poppatjamals.com' THEN 'saleem'
                WHEN email = 'supervisor1@test.com' THEN 'supervisor1' 
                WHEN email = 'scanner1@test.com' THEN 'scanner1'
            END,
            full_name = CASE 
                WHEN email = 'saleem@poppatjamals.com' THEN 'Saleem (Super User)'
                WHEN email = 'supervisor1@test.com' THEN 'Supervisor One'
                WHEN email = 'scanner1@test.com' THEN 'Scanner One'
            END,
            active = true,
            location_ids = CASE 
                WHEN email = 'saleem@poppatjamals.com' THEN ARRAY[1,2,3,4]
                WHEN email = 'supervisor1@test.com' THEN ARRAY[1,2]
                WHEN email = 'scanner1@test.com' THEN ARRAY[1]
            END,
            updated_at = NOW()
        WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com');
    END IF;
END $$;

-- Verify everything was created successfully
SELECT 'Supabase Auth Users Created Successfully' as status;

SELECT 
  'Auth Users Created' as info,
  email, 
  raw_user_meta_data->>'username' as username, 
  raw_user_meta_data->>'role' as role,
  email_confirmed_at IS NOT NULL as confirmed,
  created_at
FROM auth.users 
WHERE email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
ORDER BY 
  CASE raw_user_meta_data->>'role'
    WHEN 'superuser' THEN 1
    WHEN 'supervisor' THEN 2  
    WHEN 'scanner' THEN 3
  END;

-- Verify users table integration
SELECT 
  'Users Table Integration' as info,
  u.username,
  u.email,
  u.role,
  u.active,
  array_length(u.location_ids, 1) as location_count,
  CASE WHEN au.id IS NOT NULL THEN 'LINKED' ELSE 'MISSING' END as auth_link_status
FROM users u
LEFT JOIN auth.users au ON u.id = au.id
WHERE u.email IN ('saleem@poppatjamals.com', 'supervisor1@test.com', 'scanner1@test.com')
ORDER BY u.role;

SELECT 'Ready for Schema Update (Script 22)' as next_step;