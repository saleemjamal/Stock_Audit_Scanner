-- Row Level Security Update for Username/Password Authentication (SIMPLIFIED)
-- Execute this after 05_auth_migration.sql

-- First, drop existing RLS policies to recreate them
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Only superuser can manage users" ON users;
DROP POLICY IF EXISTS "Users can view assigned locations" ON locations;
DROP POLICY IF EXISTS "Only superuser can manage locations" ON locations;
DROP POLICY IF EXISTS "Users can view audit sessions for their locations" ON audit_sessions;
DROP POLICY IF EXISTS "Supervisors and superusers can manage audit sessions" ON audit_sessions;
DROP POLICY IF EXISTS "Users can view racks for their audit sessions" ON racks;
DROP POLICY IF EXISTS "Scanners can update assigned racks" ON racks;
DROP POLICY IF EXISTS "Supervisors can approve racks" ON racks;
DROP POLICY IF EXISTS "Users can view their own scans" ON scans;
DROP POLICY IF EXISTS "Scanners can create scans" ON scans;

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE racks ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

-- USERS TABLE POLICIES
-- Users can view their own profile
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile (limited fields)
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Superusers can manage all users
CREATE POLICY "superuser_manage_users" ON users
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superuser')
  );

-- Supervisors can view users in their locations (simplified - allow all for now)
CREATE POLICY "supervisor_view_users" ON users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('supervisor', 'superuser'))
  );

-- LOCATIONS TABLE POLICIES  
-- Users can view locations they're assigned to
CREATE POLICY "users_view_assigned_locations" ON locations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superuser') OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND locations.id = ANY(location_ids))
  );

-- Only superusers can manage locations
CREATE POLICY "superuser_manage_locations" ON locations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superuser')
  );

-- AUDIT SESSIONS TABLE POLICIES
-- Users can view audit sessions for their assigned locations
CREATE POLICY "users_view_location_audit_sessions" ON audit_sessions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superuser') OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND audit_sessions.location_id = ANY(location_ids))
  );

-- Supervisors and superusers can manage audit sessions for their locations
CREATE POLICY "supervisors_manage_audit_sessions" ON audit_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('supervisor', 'superuser')
      AND (role = 'superuser' OR audit_sessions.location_id = ANY(location_ids))
    )
  );

-- RACKS TABLE POLICIES
-- Users can view racks for audit sessions in their locations
CREATE POLICY "users_view_location_racks" ON racks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superuser') OR
    EXISTS (
      SELECT 1 FROM users u
      JOIN audit_sessions a ON a.id = racks.audit_session_id
      WHERE u.id = auth.uid() 
      AND a.location_id = ANY(u.location_ids)
    )
  );

-- Scanners can update racks assigned to them
CREATE POLICY "scanners_update_assigned_racks" ON racks
  FOR UPDATE USING (
    scanner_id = auth.uid() OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('supervisor', 'superuser'))
  ) WITH CHECK (
    scanner_id = auth.uid() OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('supervisor', 'superuser'))
  );

-- Scanners can assign themselves to available racks in their locations
CREATE POLICY "scanners_assign_racks" ON racks
  FOR UPDATE USING (
    status = 'available' AND
    EXISTS (
      SELECT 1 FROM users u
      JOIN audit_sessions a ON a.id = racks.audit_session_id
      WHERE u.id = auth.uid() 
      AND a.location_id = ANY(u.location_ids)
    )
  );

-- Supervisors can approve/reject racks
CREATE POLICY "supervisors_manage_racks" ON racks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN audit_sessions a ON a.id = racks.audit_session_id
      WHERE u.id = auth.uid() 
      AND u.role IN ('supervisor', 'superuser')
      AND (u.role = 'superuser' OR a.location_id = ANY(u.location_ids))
    )
  );

-- SCANS TABLE POLICIES
-- Users can view scans for racks in their locations
CREATE POLICY "users_view_location_scans" ON scans
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superuser') OR
    scanner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users u
      JOIN audit_sessions a ON a.id = scans.audit_session_id
      WHERE u.id = auth.uid() 
      AND u.role = 'supervisor'
      AND a.location_id = ANY(u.location_ids)
    )
  );

-- Scanners can create scans for racks assigned to them
CREATE POLICY "scanners_create_scans" ON scans
  FOR INSERT WITH CHECK (
    scanner_id = auth.uid() AND
    EXISTS (SELECT 1 FROM racks WHERE id = rack_id AND scanner_id = auth.uid())
  );

-- Scanners can update their own scans
CREATE POLICY "scanners_update_own_scans" ON scans
  FOR UPDATE USING (scanner_id = auth.uid())
  WITH CHECK (scanner_id = auth.uid());

-- Supervisors can view/edit scans in their locations
CREATE POLICY "supervisors_manage_scans" ON scans
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN audit_sessions a ON a.id = scans.audit_session_id
      WHERE u.id = auth.uid() 
      AND u.role IN ('supervisor', 'superuser')
      AND (u.role = 'superuser' OR a.location_id = ANY(u.location_ids))
    )
  );

-- Add helpful comments
COMMENT ON POLICY "users_select_own" ON users IS 'Users can view their own profile';
COMMENT ON POLICY "superuser_manage_users" ON users IS 'Superusers have full user management access';
COMMENT ON POLICY "users_view_assigned_locations" ON locations IS 'Users can only see locations they are assigned to';
COMMENT ON POLICY "supervisors_manage_audit_sessions" ON audit_sessions IS 'Supervisors can manage audit sessions in their locations';

-- Verification query
SELECT 'RLS policies created successfully' as status;