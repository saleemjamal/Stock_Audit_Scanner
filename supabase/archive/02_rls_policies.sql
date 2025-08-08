-- Row Level Security Policies
-- Execute this after running 01_schema.sql

-- Enable RLS on all tables
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE racks ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

-- Locations policies
CREATE POLICY "Users can view locations they have access to" ON locations
    FOR SELECT USING (
        auth.uid() IN (
            SELECT id FROM users 
            WHERE id = auth.uid() 
            AND (location_ids @> ARRAY[id] OR role IN ('admin'))
        )
    );

CREATE POLICY "Admins can manage locations" ON locations
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
    );

-- Users policies
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Supervisors can view users in their locations" ON users
    FOR SELECT USING (
        auth.uid() IN (
            SELECT u.id FROM users u
            WHERE u.id = auth.uid() 
            AND u.role IN ('supervisor', 'admin')
            AND (u.location_ids && location_ids OR u.role = 'admin')
        )
    );

CREATE POLICY "Admins can manage all users" ON users
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
    );

-- Audit sessions policies
CREATE POLICY "Users can view audit sessions for their locations" ON audit_sessions
    FOR SELECT USING (
        auth.uid() IN (
            SELECT u.id FROM users u
            WHERE u.id = auth.uid() 
            AND (u.location_ids @> ARRAY[location_id] OR u.role = 'admin')
        )
    );

CREATE POLICY "Supervisors and admins can manage audit sessions" ON audit_sessions
    FOR ALL USING (
        auth.uid() IN (
            SELECT u.id FROM users u
            WHERE u.id = auth.uid() 
            AND u.role IN ('supervisor', 'admin')
            AND (u.location_ids @> ARRAY[location_id] OR u.role = 'admin')
        )
    );

-- Racks policies
CREATE POLICY "Users can view racks for their locations" ON racks
    FOR SELECT USING (
        auth.uid() IN (
            SELECT u.id FROM users u
            WHERE u.id = auth.uid() 
            AND (u.location_ids @> ARRAY[location_id] OR u.role = 'admin')
        )
    );

CREATE POLICY "Scanners can update their assigned racks" ON racks
    FOR UPDATE USING (
        scanner_id = auth.uid() OR
        auth.uid() IN (
            SELECT u.id FROM users u
            WHERE u.id = auth.uid() 
            AND u.role IN ('supervisor', 'admin')
            AND (u.location_ids @> ARRAY[location_id] OR u.role = 'admin')
        )
    );

CREATE POLICY "Supervisors can approve/reject racks" ON racks
    FOR UPDATE USING (
        auth.uid() IN (
            SELECT u.id FROM users u
            WHERE u.id = auth.uid() 
            AND u.role IN ('supervisor', 'admin')
            AND (u.location_ids @> ARRAY[location_id] OR u.role = 'admin')
        )
    );

-- Scans policies
CREATE POLICY "Users can view scans for their locations" ON scans
    FOR SELECT USING (
        auth.uid() IN (
            SELECT u.id FROM users u
            JOIN racks r ON r.location_id = ANY(u.location_ids) OR u.role = 'admin'
            WHERE u.id = auth.uid() AND r.id = rack_id
        )
    );

CREATE POLICY "Scanners can insert scans" ON scans
    FOR INSERT WITH CHECK (
        scanner_id = auth.uid() AND
        rack_id IN (
            SELECT r.id FROM racks r
            JOIN users u ON u.id = auth.uid()
            WHERE (u.location_ids @> ARRAY[r.location_id] OR u.role = 'admin')
        )
    );

CREATE POLICY "Users can view their own scans" ON scans
    FOR SELECT USING (scanner_id = auth.uid());

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
        auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
    );

CREATE POLICY "System can create audit logs" ON audit_log
    FOR INSERT WITH CHECK (true);

-- Sync queue policies
CREATE POLICY "Users can view their device sync queue" ON sync_queue
    FOR SELECT USING (
        device_id IN (SELECT device_id FROM users WHERE id = auth.uid())
    );

CREATE POLICY "Users can insert to sync queue" ON sync_queue
    FOR INSERT WITH CHECK (
        device_id IN (SELECT device_id FROM users WHERE id = auth.uid())
    );

CREATE POLICY "System can process sync queue" ON sync_queue
    FOR UPDATE WITH CHECK (true);