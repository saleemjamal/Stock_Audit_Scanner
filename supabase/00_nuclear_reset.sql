-- 00. NUCLEAR RESET - Clean Slate for Google SSO
-- This will delete ALL custom tables and data
-- WARNING: This is destructive and irreversible!

-- First, let's see what we're about to delete
SELECT '=== CURRENT TABLES TO BE DELETED ===' as section;
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Check current auth.users (these will also be cleaned)
SELECT '=== CURRENT AUTH USERS TO BE CLEANED ===' as section;
SELECT 
  email,
  instance_id,
  'WILL BE DELETED' as status
FROM auth.users 
WHERE email LIKE '%@%'
ORDER BY email;

-- Drop all custom tables (in dependency order)
BEGIN;

-- Drop tables that reference other tables first
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS scans CASCADE;
DROP TABLE IF EXISTS racks CASCADE; 
DROP TABLE IF EXISTS audit_sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS locations CASCADE;

-- Drop any custom functions
DROP FUNCTION IF EXISTS login_with_username(text, text) CASCADE;
DROP FUNCTION IF EXISTS get_audit_session_stats(uuid) CASCADE;
DROP FUNCTION IF EXISTS test_supabase_auth(text, text) CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Drop any custom types
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS audit_status CASCADE;
DROP TYPE IF EXISTS rack_status CASCADE;

COMMIT;

-- Clean auth.users table (delete all existing users)
-- We'll let Google OAuth create new ones properly
DELETE FROM auth.users 
WHERE email IS NOT NULL;

-- Clean auth.sessions (remove any existing sessions) 
DELETE FROM auth.sessions 
WHERE id IS NOT NULL;

-- Verify clean slate
SELECT '=== CLEAN SLATE VERIFICATION ===' as section;

-- Should show no custom tables
SELECT 
  'Custom tables remaining:' as check_type,
  COUNT(*) as count
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE';

-- Should show no auth users
SELECT 
  'Auth users remaining:' as check_type,
  COUNT(*) as count
FROM auth.users;

-- Should show no auth sessions
SELECT 
  'Auth sessions remaining:' as check_type,
  COUNT(*) as count
FROM auth.sessions;

SELECT '🧹 NUCLEAR RESET COMPLETE - Database is now clean slate!' as final_status;
SELECT 'Next: Run 01_clean_schema.sql to create new Google SSO-ready tables' as next_step;