-- Check Auth.Users Columns
-- This will show us exactly what columns exist in your auth.users table

-- Show all columns in auth.users
SELECT 'Columns in auth.users:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'auth' AND table_name = 'users'
ORDER BY ordinal_position;

-- Check if essential columns exist
SELECT 'Checking essential columns:' as check_type;
SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'id') 
         THEN '✓ id column exists' 
         ELSE '✗ id column MISSING' END as id_check,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'email') 
         THEN '✓ email column exists' 
         ELSE '✗ email column MISSING' END as email_check,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'encrypted_password') 
         THEN '✓ encrypted_password exists' 
         ELSE '✗ encrypted_password MISSING' END as password_check;

-- Check Supabase version
SELECT 'Supabase auth version info:' as info;
SELECT version() as postgres_version;

-- Check if auth schema exists
SELECT 'Auth schema check:' as info;
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name = 'auth';