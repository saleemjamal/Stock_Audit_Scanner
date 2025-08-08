-- Create User Programmatically (Alternative Approach)
-- Run this if Dashboard user creation fails

-- First, let's check what's in auth.users currently
SELECT 'Current auth.users:' as info, COUNT(*) as user_count FROM auth.users;

-- Check if there are any existing policies or triggers that might be blocking
SELECT 'Checking for auth policies:' as info;
SELECT schemaname, tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'auth' AND tablename = 'users';

-- Let's try a simpler approach: create a user directly in auth.users
-- This bypasses the Dashboard's user creation process

-- Generate a UUID for our user
SELECT 'Generated UUID for saleem:' as info, gen_random_uuid() as uuid;

-- Create the auth user directly (this might work when Dashboard fails)
-- You'll need to replace 'GENERATED_UUID_HERE' with the UUID from above
INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
) VALUES (
    'REPLACE_WITH_GENERATED_UUID', -- Use the UUID from the SELECT above
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'saleem@poppatjamals.com',
    crypt('your_password_here', gen_salt('bf')), -- Replace 'your_password_here' with actual password
    NOW(),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
);

-- Alternative: Let's check if there's a simpler way
SELECT 'If direct INSERT fails, try this alternative:' as alternative;

-- Show what columns exist in auth.users
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'auth' AND table_name = 'users'
ORDER BY ordinal_position;