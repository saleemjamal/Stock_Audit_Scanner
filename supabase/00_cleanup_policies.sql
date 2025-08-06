-- Cleanup Script - Remove Existing RLS Policies
-- Run this BEFORE running the fixed RLS policies
-- This will clean up any broken or partially created policies

-- Drop all existing policies on locations table
DROP POLICY IF EXISTS "Users can view locations they have access to" ON locations;
DROP POLICY IF EXISTS "Admins can manage locations" ON locations;
DROP POLICY IF EXISTS "Users can view accessible locations" ON locations;

-- Drop all existing policies on users table
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Supervisors can view users in their locations" ON users;
DROP POLICY IF EXISTS "Admins can manage all users" ON users;

-- Drop all existing policies on audit_sessions table
DROP POLICY IF EXISTS "Users can view audit sessions for their locations" ON audit_sessions;
DROP POLICY IF EXISTS "Supervisors and admins can manage audit sessions" ON audit_sessions;

-- Drop all existing policies on racks table
DROP POLICY IF EXISTS "Users can view racks for their locations" ON racks;
DROP POLICY IF EXISTS "Scanners can update their assigned racks" ON racks;
DROP POLICY IF EXISTS "Supervisors can approve/reject racks" ON racks;

-- Drop all existing policies on scans table
DROP POLICY IF EXISTS "Users can view scans for their locations" ON scans;
DROP POLICY IF EXISTS "Scanners can insert scans" ON scans;
DROP POLICY IF EXISTS "Users can view their own scans" ON scans;
DROP POLICY IF EXISTS "Users can view scans for accessible racks" ON scans;
DROP POLICY IF EXISTS "Scanners can insert scans to accessible racks" ON scans;

-- Drop all existing policies on notifications table
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;

-- Drop all existing policies on audit_log table
DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_log;
DROP POLICY IF EXISTS "System can create audit logs" ON audit_log;

-- Drop all existing policies on sync_queue table
DROP POLICY IF EXISTS "Users can view their device sync queue" ON sync_queue;
DROP POLICY IF EXISTS "Users can insert to sync queue" ON sync_queue;
DROP POLICY IF EXISTS "System can process sync queue" ON sync_queue;
DROP POLICY IF EXISTS "Users can manage their device sync queue" ON sync_queue;

-- Drop helper function if it exists
DROP FUNCTION IF EXISTS user_can_access_location(UUID, INTEGER);

-- Disable RLS temporarily to ensure clean state
ALTER TABLE locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE racks DISABLE ROW LEVEL SECURITY;
ALTER TABLE scans DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue DISABLE ROW LEVEL SECURITY;

-- Display completion message
SELECT 'RLS policies cleanup completed. Now run 02_rls_policies_simple.sql' as status;