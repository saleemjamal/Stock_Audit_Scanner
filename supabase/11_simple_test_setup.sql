-- Simple Test Setup (Bypass Auth User Creation Issues)
-- This creates a minimal working setup for testing

-- Drop the foreign key constraint entirely for now
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- Create a simple test user without auth.users dependency
INSERT INTO users (
    id,
    email,
    username,
    full_name,
    role,
    location_ids,
    active,
    has_password,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'saleem@poppatjamals.com',
    'saleem',
    'Saleem Admin',
    'superuser',
    ARRAY(SELECT id FROM locations),
    true,
    true,
    NOW(),
    NOW()
) ON CONFLICT (email) DO UPDATE SET
    username = EXCLUDED.username,
    role = EXCLUDED.role,
    location_ids = EXCLUDED.location_ids,
    has_password = EXCLUDED.has_password,
    updated_at = NOW();

-- Create test scanner
INSERT INTO users (
    id,
    email,
    username,
    full_name,
    role,
    location_ids,
    active,
    has_password
) VALUES (
    gen_random_uuid(),
    'scanner1@test.com',
    'scanner1',
    'Test Scanner',
    'scanner',
    ARRAY[1],
    true,
    true
) ON CONFLICT (email) DO NOTHING;

-- Create test supervisor
INSERT INTO users (
    id,
    email,
    username,
    full_name,
    role,
    location_ids,
    active,
    has_password
) VALUES (
    gen_random_uuid(),
    'supervisor1@test.com',
    'supervisor1',
    'Test Supervisor',
    'supervisor',
    ARRAY[1],
    true,
    true
) ON CONFLICT (email) DO NOTHING;

-- Show created users
SELECT 'Created test users:' as info;
SELECT username, email, role, active FROM users ORDER BY role;

-- Instructions for testing
SELECT 'TESTING APPROACH:' as title,
'Since Dashboard user creation is failing, we can test the apps directly:

1. MOBILE APP: Try login with username: saleem (any password for now)
2. DASHBOARD: Try login with username: saleem (any password for now) 

The authentication will fail at Supabase level, but you can see if:
- Login UI works correctly
- Username validation works
- Error handling is proper
- Role-based blocking works

Once we solve the Supabase auth issue, we can connect it properly.
' as instructions;