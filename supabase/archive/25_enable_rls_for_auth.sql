-- 25. Enable Row Level Security for Supabase Auth Integration
-- This script updates RLS policies to work with Supabase Auth (auth.uid())
-- Run after removing custom authentication functions

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Superusers can view all users" ON users;
DROP POLICY IF EXISTS "Only superusers can manage users" ON users;
DROP POLICY IF EXISTS "Users can view assigned locations" ON locations;
DROP POLICY IF EXISTS "Users can view location sessions" ON audit_sessions;
DROP POLICY IF EXISTS "Users can view location racks" ON racks;
DROP POLICY IF EXISTS "Users can view their scans" ON scans;

-- USERS TABLE POLICIES
-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

-- Superusers can view all users  
CREATE POLICY "Superusers can view all users" ON users
  FOR SELECT USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'superuser'
  );

-- Only superusers can insert/update/delete users
CREATE POLICY "Only superusers can manage users" ON users
  FOR ALL USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'superuser'
  );

-- LOCATIONS TABLE POLICIES
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Users can view their assigned locations, superusers see all
CREATE POLICY "Users can view assigned locations" ON locations
  FOR SELECT USING (
    id = ANY((SELECT location_ids FROM users WHERE id = auth.uid())::int[])
    OR
    (SELECT role FROM users WHERE id = auth.uid()) = 'superuser'
  );

-- Only superusers can manage locations
CREATE POLICY "Only superusers can manage locations" ON locations
  FOR ALL USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'superuser'
  );

-- AUDIT SESSIONS TABLE POLICIES  
ALTER TABLE audit_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view sessions for their assigned locations
CREATE POLICY "Users can view location sessions" ON audit_sessions
  FOR SELECT USING (
    location_id = ANY((SELECT location_ids FROM users WHERE id = auth.uid())::int[])
    OR
    (SELECT role FROM users WHERE id = auth.uid()) = 'superuser'
  );

-- Supervisors and superusers can manage audit sessions
CREATE POLICY "Supervisors can manage audit sessions" ON audit_sessions
  FOR ALL USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('supervisor', 'superuser')
    AND (
      location_id = ANY((SELECT location_ids FROM users WHERE id = auth.uid())::int[])
      OR
      (SELECT role FROM users WHERE id = auth.uid()) = 'superuser'
    )
  );

-- RACKS TABLE POLICIES
ALTER TABLE racks ENABLE ROW LEVEL SECURITY;

-- Users can view racks for their assigned locations
CREATE POLICY "Users can view location racks" ON racks
  FOR SELECT USING (
    location_id = ANY((SELECT location_ids FROM users WHERE id = auth.uid())::int[])
    OR
    (SELECT role FROM users WHERE id = auth.uid()) = 'superuser'
  );

-- Scanners can update racks they're assigned to
CREATE POLICY "Scanners can update assigned racks" ON racks
  FOR UPDATE USING (
    scanner_id = auth.uid() 
    OR
    (SELECT role FROM users WHERE id = auth.uid()) IN ('supervisor', 'superuser')
  );

-- Supervisors can approve/reject racks
CREATE POLICY "Supervisors can approve racks" ON racks
  FOR UPDATE USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('supervisor', 'superuser')
    AND (
      location_id = ANY((SELECT location_ids FROM users WHERE id = auth.uid())::int[])
      OR
      (SELECT role FROM users WHERE id = auth.uid()) = 'superuser'
    )
  );

-- SCANS TABLE POLICIES
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

-- Users can view scans - scanners see their own, supervisors see location scans
CREATE POLICY "Users can view relevant scans" ON scans
  FOR SELECT USING (
    scanner_id = auth.uid()
    OR
    (
      (SELECT role FROM users WHERE id = auth.uid()) IN ('supervisor', 'superuser')
      AND (
        (SELECT location_id FROM racks WHERE id = scans.rack_id) = ANY((SELECT location_ids FROM users WHERE id = auth.uid())::int[])
        OR
        (SELECT role FROM users WHERE id = auth.uid()) = 'superuser'
      )
    )
  );

-- Scanners can create scans
CREATE POLICY "Scanners can create scans" ON scans
  FOR INSERT WITH CHECK (
    scanner_id = auth.uid()
    AND
    (SELECT role FROM users WHERE id = auth.uid()) IN ('scanner', 'supervisor', 'superuser')
  );

-- NOTIFICATIONS TABLE POLICIES (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notifications') THEN
    ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
    
    -- Users can view their own notifications
    EXECUTE 'CREATE POLICY "Users can view own notifications" ON notifications
      FOR SELECT USING (user_id = auth.uid())';
      
    -- System can create notifications for users
    EXECUTE 'CREATE POLICY "System can create notifications" ON notifications
      FOR INSERT WITH CHECK (true)';
      
    -- Users can mark their notifications as read
    EXECUTE 'CREATE POLICY "Users can update own notifications" ON notifications
      FOR UPDATE USING (user_id = auth.uid())';
  END IF;
END $$;

-- Verify RLS policies were created
SELECT 'RLS Policies Updated for Supabase Auth' as status;

-- Show all policies that were created
SELECT 
  'Created RLS Policies' as info,
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  cmd,
  roles
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;

-- Test policy by showing what current auth.uid() would see
-- (This will show null since no user is authenticated in SQL context)
SELECT 
  'Current auth.uid() Test' as info,
  auth.uid() as current_user_id,
  CASE 
    WHEN auth.uid() IS NULL THEN 'No authenticated user (expected in SQL context)'
    ELSE 'User authenticated: ' || auth.uid()::text
  END as auth_status;

SELECT 'RLS setup complete - ready for application testing' as next_step;