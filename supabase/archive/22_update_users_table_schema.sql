-- 22. Update Users Table Schema for Supabase Auth Integration
-- This script modifies the users table to work with Supabase Auth
-- Run after creating auth users

-- Drop old constraints that won't be needed
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_unique;
DROP INDEX IF EXISTS users_username_unique;

-- Remove custom authentication columns (we'll use Supabase Auth instead)
ALTER TABLE users DROP COLUMN IF EXISTS password_hash CASCADE;
ALTER TABLE users DROP COLUMN IF EXISTS has_password CASCADE;
ALTER TABLE users DROP COLUMN IF EXISTS last_login CASCADE;

-- Keep username for display purposes but make it optional (email will be primary)
ALTER TABLE users ALTER COLUMN username DROP NOT NULL;

-- Make sure email is required (will match auth.users.email)  
ALTER TABLE users ALTER COLUMN email SET NOT NULL;

-- Add unique constraint on email
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);

-- Verify schema changes
SELECT 'Users Table Schema Updated' as status;

-- Show new table structure
SELECT 
  'Updated Users Table Schema' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;