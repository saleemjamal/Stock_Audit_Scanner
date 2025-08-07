-- Fix Auth User Creation Issue
-- Run this to temporarily remove constraints blocking auth user creation

-- Check if the foreign key constraint exists and drop it temporarily
DO $$
BEGIN
    -- Drop the foreign key constraint from users table that references auth.users
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'users_id_fkey' 
        AND table_name = 'users'
    ) THEN
        ALTER TABLE users DROP CONSTRAINT users_id_fkey;
        RAISE NOTICE 'Dropped users_id_fkey constraint';
    END IF;
END $$;

-- Temporarily disable RLS on users table to allow auth user creation
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Show current state
SELECT 'Constraints temporarily removed for auth user creation' as status;

-- Check what constraints remain
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_name = 'users' 
  AND tc.table_schema = 'public';

-- Instructions
SELECT 'NOW TRY CREATING AUTH USERS:' as step_title,
'
1. Go to Supabase Dashboard > Authentication > Users
2. Create user: saleem@poppatjamals.com with password
3. After successful creation, come back and run 09_restore_constraints.sql
' as instructions;