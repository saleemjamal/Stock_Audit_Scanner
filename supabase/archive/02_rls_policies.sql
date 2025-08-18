-- 02. Row Level Security Policies - Google SSO Compatible
-- Clean, simple RLS policies that work with Google OAuth

-- Enable RLS on all tables
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY; 
ALTER TABLE audit_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE racks ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user profile
CREATE OR REPLACE FUNCTION get_current_user_profile()
RETURNS users AS $$
    SELECT * FROM users WHERE email = auth.jwt() ->> 'email' LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function to check if user is superuser
CREATE OR REPLACE FUNCTION is_superuser()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM users 
        WHERE email = auth.jwt() ->> 'email' 
        AND role = 'superuser'
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function to check if user is supervisor or above  
CREATE OR REPLACE FUNCTION is_supervisor_or_above()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM users 
        WHERE email = auth.jwt() ->> 'email' 
        AND role IN ('supervisor', 'superuser')
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- LOCATIONS POLICIES
-- Superusers can do everything
CREATE POLICY "Superusers can manage locations" ON locations
    FOR ALL TO authenticated
    USING (is_superuser())
    WITH CHECK (is_superuser());

-- Users can view locations they have access to
CREATE POLICY "Users can view assigned locations" ON locations  
    FOR SELECT TO authenticated
    USING (
        id = ANY((get_current_user_profile()).location_ids) OR 
        is_superuser()
    );

-- USERS POLICIES  
-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT TO authenticated
    USING (email = auth.jwt() ->> 'email');

-- Users can update their own profile (limited fields)
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE TO authenticated
    USING (email = auth.jwt() ->> 'email')
    WITH CHECK (
        email = auth.jwt() ->> 'email' AND
        -- Prevent role/location changes via self-update
        role = (SELECT role FROM users WHERE email = auth.jwt() ->> 'email') AND
        location_ids = (SELECT location_ids FROM users WHERE email = auth.jwt() ->> 'email')
    );

-- Superusers can manage all users
CREATE POLICY "Superusers can manage users" ON users
    FOR ALL TO authenticated  
    USING (is_superuser())
    WITH CHECK (is_superuser());

-- Supervisors can view users in their locations
CREATE POLICY "Supervisors can view location users" ON users
    FOR SELECT TO authenticated
    USING (
        is_supervisor_or_above() AND (
            location_ids && (get_current_user_profile()).location_ids OR
            is_superuser()
        )
    );

-- AUDIT SESSIONS POLICIES
-- Users can view sessions for their locations
CREATE POLICY "Users can view location audit sessions" ON audit_sessions
    FOR SELECT TO authenticated
    USING (
        location_id = ANY((get_current_user_profile()).location_ids) OR
        is_superuser()
    );

-- Supervisors and above can manage sessions for their locations  
CREATE POLICY "Supervisors can manage location audit sessions" ON audit_sessions
    FOR ALL TO authenticated
    USING (
        is_supervisor_or_above() AND (
            location_id = ANY((get_current_user_profile()).location_ids) OR
            is_superuser()
        )
    )
    WITH CHECK (
        is_supervisor_or_above() AND (
            location_id = ANY((get_current_user_profile()).location_ids) OR
            is_superuser()
        )
    );

-- RACKS POLICIES
-- Users can view racks for sessions in their locations
CREATE POLICY "Users can view location racks" ON racks
    FOR SELECT TO authenticated  
    USING (
        location_id = ANY((get_current_user_profile()).location_ids) OR
        is_superuser()
    );

-- Users can update racks assigned to them
CREATE POLICY "Users can update assigned racks" ON racks
    FOR UPDATE TO authenticated
    USING (
        scanner_id = (get_current_user_profile()).id OR
        is_supervisor_or_above()
    )
    WITH CHECK (
        scanner_id = (get_current_user_profile()).id OR
        is_supervisor_or_above()
    );

-- Supervisors can manage racks in their locations
CREATE POLICY "Supervisors can manage location racks" ON racks
    FOR ALL TO authenticated
    USING (
        is_supervisor_or_above() AND (
            location_id = ANY((get_current_user_profile()).location_ids) OR
            is_superuser()
        )
    )
    WITH CHECK (
        is_supervisor_or_above() AND (
            location_id = ANY((get_current_user_profile()).location_ids) OR
            is_superuser()
        )
    );

-- SCANS POLICIES
-- Users can view scans for racks in their locations
CREATE POLICY "Users can view location scans" ON scans
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM racks 
            WHERE racks.id = scans.rack_id 
            AND (
                racks.location_id = ANY((get_current_user_profile()).location_ids) OR
                is_superuser()
            )
        )
    );

-- Users can create scans for racks assigned to them or in their locations
CREATE POLICY "Users can create scans" ON scans
    FOR INSERT TO authenticated
    WITH CHECK (
        scanner_id = (get_current_user_profile()).id AND
        EXISTS (
            SELECT 1 FROM racks 
            WHERE racks.id = scans.rack_id 
            AND (
                racks.scanner_id = (get_current_user_profile()).id OR
                racks.location_id = ANY((get_current_user_profile()).location_ids) OR
                is_superuser()
            )
        )
    );

-- Users can update their own scans
CREATE POLICY "Users can update own scans" ON scans  
    FOR UPDATE TO authenticated
    USING (scanner_id = (get_current_user_profile()).id)
    WITH CHECK (scanner_id = (get_current_user_profile()).id);

-- NOTIFICATIONS POLICIES
-- Users can view their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT TO authenticated
    USING (user_id = (get_current_user_profile()).id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE TO authenticated
    USING (user_id = (get_current_user_profile()).id)
    WITH CHECK (user_id = (get_current_user_profile()).id);

-- Supervisors can create notifications for users in their locations
CREATE POLICY "Supervisors can create notifications" ON notifications
    FOR INSERT TO authenticated
    WITH CHECK (
        is_supervisor_or_above() AND
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = notifications.user_id
            AND (
                users.location_ids && (get_current_user_profile()).location_ids OR
                is_superuser()
            )
        )
    );

SELECT '✅ RLS POLICIES CREATED - Google SSO compatible!' as status;
SELECT 'Next: Run 03_functions.sql' as next_step;