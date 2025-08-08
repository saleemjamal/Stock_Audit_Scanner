-- Row Level Security Update for Username/Password Authentication
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
    (SELECT role FROM users WHERE auth.uid() = id) = 'superuser'
  );

-- Supervisors can view users in their locations
CREATE POLICY "supervisor_view_location_users" ON users
  FOR SELECT USING (
    (SELECT role FROM users WHERE auth.uid() = id) IN ('supervisor', 'superuser')
    AND (
      (SELECT role FROM users WHERE auth.uid() = id) = 'superuser' OR
      (SELECT location_ids FROM users WHERE auth.uid() = id) && location_ids
    )
  );

-- LOCATIONS TABLE POLICIES  
-- Users can view locations they're assigned to
CREATE POLICY "users_view_assigned_locations" ON locations
  FOR SELECT USING (
    (SELECT role FROM users WHERE auth.uid() = id) = 'superuser' OR
    id = ANY((SELECT location_ids FROM users WHERE auth.uid() = id))
  );

-- Only superusers can manage locations
CREATE POLICY "superuser_manage_locations" ON locations
  FOR ALL USING (
    (SELECT role FROM users WHERE auth.uid() = id) = 'superuser'
  );

-- AUDIT SESSIONS TABLE POLICIES
-- Users can view audit sessions for their assigned locations
CREATE POLICY "users_view_location_audit_sessions" ON audit_sessions
  FOR SELECT USING (
    (SELECT role FROM users WHERE auth.uid() = id) = 'superuser' OR
    location_id = ANY((SELECT location_ids FROM users WHERE auth.uid() = id))
  );

-- Supervisors and superusers can manage audit sessions for their locations
CREATE POLICY "supervisors_manage_audit_sessions" ON audit_sessions
  FOR ALL USING (
    (SELECT role FROM users WHERE auth.uid() = id) IN ('supervisor', 'superuser')
    AND (
      (SELECT role FROM users WHERE auth.uid() = id) = 'superuser' OR
      location_id = ANY((SELECT location_ids FROM users WHERE auth.uid() = id))
    )
  );

-- RACKS TABLE POLICIES
-- Users can view racks for audit sessions in their locations
CREATE POLICY "users_view_location_racks" ON racks
  FOR SELECT USING (
    (SELECT role FROM users WHERE auth.uid() = id) = 'superuser' OR
    (SELECT location_id FROM audit_sessions WHERE id = audit_session_id) = 
    ANY((SELECT location_ids FROM users WHERE auth.uid() = id))
  );

-- Scanners can update racks assigned to them
CREATE POLICY "scanners_update_assigned_racks" ON racks
  FOR UPDATE USING (
    scanner_id = auth.uid() OR
    (SELECT role FROM users WHERE auth.uid() = id) IN ('supervisor', 'superuser')
  ) WITH CHECK (
    scanner_id = auth.uid() OR
    (SELECT role FROM users WHERE auth.uid() = id) IN ('supervisor', 'superuser')
  );

-- Scanners can create/assign themselves to available racks
CREATE POLICY "scanners_assign_racks" ON racks
  FOR UPDATE USING (
    status = 'available' AND
    (SELECT location_id FROM audit_sessions WHERE id = audit_session_id) = 
    ANY((SELECT location_ids FROM users WHERE auth.uid() = id))
  );

-- Supervisors can approve/reject racks
CREATE POLICY "supervisors_manage_racks" ON racks
  FOR ALL USING (
    (SELECT role FROM users WHERE auth.uid() = id) IN ('supervisor', 'superuser')
    AND (
      (SELECT role FROM users WHERE auth.uid() = id) = 'superuser' OR
      (SELECT location_id FROM audit_sessions WHERE id = audit_session_id) = 
      ANY((SELECT location_ids FROM users WHERE auth.uid() = id))
    )
  );

-- SCANS TABLE POLICIES
-- Users can view scans for racks in their locations
CREATE POLICY "users_view_location_scans" ON scans
  FOR SELECT USING (
    (SELECT role FROM users WHERE auth.uid() = id) = 'superuser' OR
    scanner_id = auth.uid() OR
    (
      (SELECT role FROM users WHERE auth.uid() = id) IN ('supervisor') AND
      (SELECT location_id FROM audit_sessions WHERE id = audit_session_id) = 
      ANY((SELECT location_ids FROM users WHERE auth.uid() = id))
    )
  );

-- Scanners can create scans for racks assigned to them
CREATE POLICY "scanners_create_scans" ON scans
  FOR INSERT WITH CHECK (
    scanner_id = auth.uid() AND
    (SELECT scanner_id FROM racks WHERE id = rack_id) = auth.uid()
  );

-- Scanners can update their own scans
CREATE POLICY "scanners_update_own_scans" ON scans
  FOR UPDATE USING (scanner_id = auth.uid())
  WITH CHECK (scanner_id = auth.uid());

-- Supervisors can view/edit scans in their locations
CREATE POLICY "supervisors_manage_scans" ON scans
  FOR ALL USING (
    (SELECT role FROM users WHERE auth.uid() = id) IN ('supervisor', 'superuser')
    AND (
      (SELECT role FROM users WHERE auth.uid() = id) = 'superuser' OR
      (SELECT location_id FROM audit_sessions WHERE id = audit_session_id) = 
      ANY((SELECT location_ids FROM users WHERE auth.uid() = id))
    )
  );

-- Add helpful comments
COMMENT ON POLICY "users_select_own" ON users IS 'Users can view their own profile';
COMMENT ON POLICY "superuser_manage_users" ON users IS 'Superusers have full user management access';
COMMENT ON POLICY "users_view_assigned_locations" ON locations IS 'Users can only see locations they are assigned to';
COMMENT ON POLICY "supervisors_manage_audit_sessions" ON audit_sessions IS 'Supervisors can manage audit sessions in their locations';

-- Verification queries (uncomment to test policies)
-- SELECT 'RLS policies created successfully' as status;
-- SELECT schemaname, tablename, policyname, cmd, qual FROM pg_policies WHERE schemaname = 'public';