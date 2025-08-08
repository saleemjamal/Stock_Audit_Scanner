-- Diagnose Auth User Creation Issue
-- Run this to identify what's blocking auth user creation

-- Check current database schema and constraints
SELECT 'Checking database constraints and triggers...' as status;

-- 1. Check all foreign keys that might reference auth.users
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND (ccu.table_name = 'users' OR tc.table_name = 'users');

-- 2. Check for triggers on auth.users
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_schema = 'auth' AND event_object_table = 'users';

-- 3. Check RLS policies on auth schema
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'auth';

-- 4. Check if auth.users table exists and its structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'auth' AND table_name = 'users'
ORDER BY ordinal_position;

-- 5. Try to see if we can query auth.users
SELECT 'Auth users count:' as info, COUNT(*) as count FROM auth.users;

-- 6. Check for any custom functions that might be triggered
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'auth' OR routine_name LIKE '%user%';

-- Final recommendation
SELECT 'DIAGNOSIS COMPLETE' as status,
'Check the results above for:
1. Foreign key constraints preventing user creation
2. Triggers that might be failing
3. RLS policies blocking creation
4. Missing columns in auth.users

Common fixes:
- Drop foreign key constraints temporarily
- Disable RLS on related tables
- Check Supabase project settings for auth configuration
' as recommendations;