-- Row Level Security Policies - SIMPLIFIED VERSION
-- Execute this after running 01_schema.sql
-- This version uses simpler logic to avoid operator issues

-- Enable RLS on all tables
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE racks ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user can access location
CREATE OR REPLACE FUNCTION user_can_access_location(user_id UUID, location_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users 
        WHERE id = user_id 
        AND (role = 'admin' OR location_id = ANY(location_ids))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Locations policies
CREATE POLICY "Users can view accessible locations" ON locations
    FOR SELECT USING (
        user_can_access_location(auth.uid(), id)
    );

CREATE POLICY "Admins can manage locations" ON locations
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Users policies
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Supervisors can view users in their locations" ON users
    FOR SELECT USING (
        auth.uid() = id OR
        EXISTS (
            SELECT 1 FROM users supervisor
            WHERE supervisor.id = auth.uid() 
            AND supervisor.role IN ('supervisor', 'admin')
            AND (
                supervisor.role = 'admin' OR 
                supervisor.location_ids && users.location_ids
            )
        )
    );

CREATE POLICY "Admins can manage all users" ON users
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Audit sessions policies
CREATE POLICY "Users can view audit sessions for their locations" ON audit_sessions
    FOR SELECT USING (
        user_can_access_location(auth.uid(), location_id)
    );

CREATE POLICY "Supervisors and admins can manage audit sessions" ON audit_sessions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('supervisor', 'admin')
            AND (role = 'admin' OR location_id = ANY(location_ids))
        )
    );

-- Racks policies
CREATE POLICY "Users can view racks for their locations" ON racks
    FOR SELECT USING (
        user_can_access_location(auth.uid(), location_id)
    );

CREATE POLICY "Scanners can update their assigned racks" ON racks
    FOR UPDATE USING (
        scanner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('supervisor', 'admin')
            AND (role = 'admin' OR location_id = ANY(location_ids))
        )
    );

-- Scans policies  
CREATE POLICY "Users can view scans for accessible racks" ON scans
    FOR SELECT USING (
        scanner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM racks r
            JOIN users u ON u.id = auth.uid()
            WHERE r.id = scans.rack_id
            AND (u.role = 'admin' OR r.location_id = ANY(u.location_ids))
        )
    );

CREATE POLICY "Scanners can insert scans to accessible racks" ON scans
    FOR INSERT WITH CHECK (
        scanner_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM racks r
            JOIN users u ON u.id = auth.uid()
            WHERE r.id = rack_id
            AND (u.role = 'admin' OR r.location_id = ANY(u.location_ids))
        )
    );

-- Notifications policies
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "System can create notifications" ON notifications
    FOR INSERT WITH CHECK (true);

-- Audit log policies
CREATE POLICY "Admins can view audit logs" ON audit_log
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "System can create audit logs" ON audit_log
    FOR INSERT WITH CHECK (true);

-- Sync queue policies
CREATE POLICY "Users can manage their device sync queue" ON sync_queue
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND device_id = sync_queue.device_id
        )
    );