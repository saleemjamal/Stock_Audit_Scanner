-- 21. Create Supabase Auth Users (FIXED VERSION)
-- This script creates Supabase Auth users and handles the handle_new_user() trigger conflict
-- Run after disabling email confirmation in Supabase Dashboard

-- First, temporarily disable the handle_new_user trigger if it exists
DO $$
BEGIN
    -- Check if handle_new_user function exists and disable trigger temporarily
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user') THEN
        RAISE NOTICE 'Temporarily disabling handle_new_user trigger...';
        DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    END IF;
END $$;

-- Create auth users with ON CONFLICT handling
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
)
ON CONFLICT (email) DO UPDATE SET
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = EXCLUDED.email_confirmed_at,
  updated_at = NOW(),
  raw_user_meta_data = EXCLUDED.raw_user_meta_data;

-- Now handle the users table records properly
DO $$
DECLARE
    saleem_auth_id UUID;
    supervisor1_auth_id UUID;
    scanner1_auth_id UUID;
BEGIN
    -- Get the auth user IDs
    SELECT id INTO saleem_auth_id FROM auth.users WHERE email = 'saleem@poppatjamals.com';
    SELECT id INTO supervisor1_auth_id FROM auth.users WHERE email = 'supervisor1@test.com';
    SELECT id INTO scanner1_auth_id FROM auth.users WHERE email = 'scanner1@test.com';
    
    RAISE NOTICE 'Auth user IDs - Saleem: %, Supervisor1: %, Scanner1: %', saleem_auth_id, supervisor1_auth_id, scanner1_auth_id;
    
    -- Insert or update users table records
    INSERT INTO users (id, email, username, full_name, role, active, location_ids, created_at)
    VALUES 
        (saleem_auth_id, 'saleem@poppatjamals.com', 'saleem', 'Saleem (Super User)', 'superuser', true, ARRAY[1,2,3,4], NOW()),
        (supervisor1_auth_id, 'supervisor1@test.com', 'supervisor1', 'Supervisor One', 'supervisor', true, ARRAY[1,2], NOW()),
        (scanner1_auth_id, 'scanner1@test.com', 'scanner1', 'Scanner One', 'scanner', true, ARRAY[1], NOW())
    ON CONFLICT (email) DO UPDATE SET
        id = EXCLUDED.id,
        username = EXCLUDED.username,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        active = EXCLUDED.active,
        location_ids = EXCLUDED.location_ids,
        updated_at = NOW();
        
    RAISE NOTICE 'Users table records created/updated successfully';
END $$;

-- Re-enable the handle_new_user trigger if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user') THEN
        RAISE NOTICE 'Re-enabling handle_new_user trigger...';
        CREATE TRIGGER on_auth_user_created
          AFTER INSERT ON auth.users
          FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
    END IF;
END $$;

-- Verify auth users were created successfully
SELECT 'Supabase Auth Users Created Successfully' as status;

SELECT 
  'New Auth Users' as info,
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

SELECT 'Ready for next migration step (Schema Update)' as next_step;