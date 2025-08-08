-- Standalone Authentication Workaround (Fixed)
-- This creates a working authentication system without depending on auth.users

-- 1. First, ensure we don't have the problematic constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- 2. Drop the partial unique index and create a proper unique constraint
DROP INDEX IF EXISTS users_username_unique;
ALTER TABLE users ADD CONSTRAINT users_username_unique UNIQUE (username);

-- 3. Add a password_hash column to users table for direct authentication
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 4. Create a function to handle login (username/password check)
CREATE OR REPLACE FUNCTION public.authenticate_user(
    p_username TEXT,
    p_password TEXT
) RETURNS TABLE (
    user_id UUID,
    user_email TEXT,
    user_role TEXT,
    user_locations INTEGER[]
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.email,
        u.role,
        u.location_ids
    FROM users u
    WHERE u.username = p_username
      AND u.active = true
      AND u.password_hash = crypt(p_password, u.password_hash);
END;
$$;

-- 5. Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 6. Create our test users with passwords
-- Password for all test users will be 'password123'

-- Create or update saleem (superuser)
INSERT INTO users (
    id,
    email,
    username,
    full_name,
    role,
    location_ids,
    active,
    has_password,
    password_hash
) VALUES (
    gen_random_uuid(),
    'saleem@poppatjamals.com',
    'saleem',
    'Saleem Admin',
    'superuser',
    ARRAY(SELECT id FROM locations),
    true,
    true,
    crypt('password123', gen_salt('bf'))
) ON CONFLICT (username) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    has_password = true,
    role = 'superuser',
    active = true;

-- Create or update scanner1
INSERT INTO users (
    id,
    email,
    username,
    full_name,
    role,
    location_ids,
    active,
    has_password,
    password_hash
) VALUES (
    gen_random_uuid(),
    'scanner1@test.com',
    'scanner1',
    'Test Scanner',
    'scanner',
    ARRAY[1],
    true,
    true,
    crypt('password123', gen_salt('bf'))
) ON CONFLICT (username) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    has_password = true,
    role = 'scanner',
    active = true;

-- Create or update supervisor1
INSERT INTO users (
    id,
    email,
    username,
    full_name,
    role,
    location_ids,
    active,
    has_password,
    password_hash
) VALUES (
    gen_random_uuid(),
    'supervisor1@test.com',
    'supervisor1',
    'Test Supervisor',
    'supervisor',
    ARRAY[1],
    true,
    true,
    crypt('password123', gen_salt('bf'))
) ON CONFLICT (username) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    has_password = true,
    role = 'supervisor',
    active = true;

-- 7. Create RPC function for login that apps can call
CREATE OR REPLACE FUNCTION public.login_with_username(
    p_username TEXT,
    p_password TEXT
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user RECORD;
BEGIN
    -- Find user and verify password
    SELECT 
        u.id,
        u.email,
        u.username,
        u.full_name,
        u.role,
        u.location_ids,
        u.active
    INTO v_user
    FROM users u
    WHERE u.username = p_username
      AND u.active = true
      AND u.password_hash = crypt(p_password, u.password_hash);
    
    IF v_user.id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Invalid username or password'
        );
    END IF;
    
    -- Update last login
    UPDATE users SET last_login = NOW() WHERE id = v_user.id;
    
    -- Return user data
    RETURN json_build_object(
        'success', true,
        'user', json_build_object(
            'id', v_user.id,
            'email', v_user.email,
            'username', v_user.username,
            'full_name', v_user.full_name,
            'role', v_user.role,
            'location_ids', v_user.location_ids
        )
    );
END;
$$;

-- 8. Grant necessary permissions for RPC functions
GRANT EXECUTE ON FUNCTION public.login_with_username TO anon;
GRANT EXECUTE ON FUNCTION public.login_with_username TO authenticated;

-- 9. Test the login function
SELECT 'Testing login function with saleem/password123:' as test;
SELECT public.login_with_username('saleem', 'password123');

-- 10. Show all users with their roles
SELECT 'Created users (all passwords are: password123):' as info;
SELECT username, email, role, active, has_password, 
       CASE WHEN password_hash IS NOT NULL THEN 'SET' ELSE 'NOT SET' END as password_status
FROM users ORDER BY role;

-- Instructions
SELECT 'AUTHENTICATION SYSTEM READY!' as status,
'The system now works with username/password authentication:

LOGIN CREDENTIALS:
- Username: saleem, Password: password123 (superuser)
- Username: supervisor1, Password: password123 (supervisor)  
- Username: scanner1, Password: password123 (scanner)

The apps can call the login_with_username RPC function to authenticate users.
This provides a simple, working authentication system without Supabase Auth complexity.
' as instructions;