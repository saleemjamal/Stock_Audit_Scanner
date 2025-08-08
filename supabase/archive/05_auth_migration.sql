-- Auth Migration: Convert to Username/Password System
-- Execute this in Supabase SQL Editor after existing schema

-- Add username column to users table
ALTER TABLE users ADD COLUMN username VARCHAR(50);

-- Make username unique and required for new users
-- (Existing users will need usernames assigned manually)
CREATE UNIQUE INDEX users_username_unique ON users(username) WHERE username IS NOT NULL;

-- Update role enum to include superuser (replacing admin)
-- First, update existing admin users to superuser
UPDATE users SET role = 'superuser' WHERE role = 'admin';

-- Drop the old constraint and create new one
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('scanner', 'supervisor', 'superuser'));

-- Add password_hash column for storing hashed passwords
-- Note: Supabase handles password hashing, but we track if user has set password
ALTER TABLE users ADD COLUMN has_password BOOLEAN DEFAULT FALSE;

-- Add last_login tracking
UPDATE users SET last_login = created_at WHERE last_login IS NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to locations table
DROP TRIGGER IF EXISTS update_locations_updated_at ON locations;
CREATE TRIGGER update_locations_updated_at 
    BEFORE UPDATE ON locations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to audit_sessions table  
DROP TRIGGER IF EXISTS update_audit_sessions_updated_at ON audit_sessions;
CREATE TRIGGER update_audit_sessions_updated_at 
    BEFORE UPDATE ON audit_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON COLUMN users.username IS 'Unique username for login (required for new auth system)';
COMMENT ON COLUMN users.has_password IS 'Whether user has set up password authentication';
COMMENT ON COLUMN users.role IS 'User role: scanner (mobile only), supervisor (both), superuser (admin)';

-- Verification query (uncomment to run after migration)
-- SELECT username, email, role, has_password, active, created_at FROM users ORDER BY role, created_at;