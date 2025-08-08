-- Database Functions and Triggers
-- Execute this after running 01_schema.sql and 02_rls_policies.sql

-- Function to auto-generate racks when audit session starts
CREATE OR REPLACE FUNCTION generate_racks_for_audit()
RETURNS TRIGGER AS $$
BEGIN
    -- Only generate racks when status changes to 'active'
    IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
        -- Generate numbered racks
        FOR i IN 1..NEW.total_rack_count LOOP
            INSERT INTO racks (
                audit_session_id, 
                location_id, 
                rack_number,
                status
            )
            VALUES (
                NEW.id, 
                NEW.location_id, 
                'R-' || LPAD(i::TEXT, 3, '0'), -- R-001, R-002, etc.
                'available'
            );
        END LOOP;
        
        -- Update started_at timestamp
        NEW.started_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to generate racks when audit starts
CREATE TRIGGER generate_racks_on_audit_start
    BEFORE UPDATE ON audit_sessions
    FOR EACH ROW
    EXECUTE FUNCTION generate_racks_for_audit();

-- Function to notify supervisors when rack is ready for approval
CREATE OR REPLACE FUNCTION notify_supervisors_rack_ready()
RETURNS TRIGGER AS $$
DECLARE
    supervisor_id UUID;
    audit_location_id INTEGER;
BEGIN
    -- Only create notification when ready_for_approval changes to true
    IF NEW.ready_for_approval = true AND (OLD.ready_for_approval IS NULL OR OLD.ready_for_approval = false) THEN
        -- Get the location for this rack
        SELECT location_id INTO audit_location_id FROM racks WHERE id = NEW.id;
        
        -- Notify all supervisors and admins who have access to this location
        FOR supervisor_id IN 
            SELECT id FROM users 
            WHERE role IN ('supervisor', 'admin')
            AND (location_ids @> ARRAY[audit_location_id] OR role = 'admin')
            AND active = true
        LOOP
            INSERT INTO notifications (
                user_id,
                type,
                title,
                message,
                rack_id,
                audit_session_id
            ) VALUES (
                supervisor_id,
                'approval_needed',
                'Rack Ready for Approval',
                'Rack ' || NEW.rack_number || ' is ready for approval with ' || NEW.total_scans || ' scans',
                NEW.id,
                NEW.audit_session_id
            );
        END LOOP;
        
        -- Update ready_at timestamp
        NEW.ready_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to notify supervisors
CREATE TRIGGER notify_supervisors_on_rack_ready
    BEFORE UPDATE ON racks
    FOR EACH ROW
    EXECUTE FUNCTION notify_supervisors_rack_ready();

-- Function to update rack scan count
CREATE OR REPLACE FUNCTION update_rack_scan_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Update total_scans count for the rack
    UPDATE racks 
    SET total_scans = (
        SELECT COUNT(*) 
        FROM scans 
        WHERE rack_id = NEW.rack_id
    )
    WHERE id = NEW.rack_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update scan count when new scan is added
CREATE TRIGGER update_rack_count_on_scan
    AFTER INSERT ON scans
    FOR EACH ROW
    EXECUTE FUNCTION update_rack_scan_count();

-- Function to create audit log entries
CREATE OR REPLACE FUNCTION create_audit_log_entry()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_log (
        user_id,
        action,
        entity_type,
        entity_id,
        old_values,
        new_values
    ) VALUES (
        auth.uid(),
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(OLD) END,
        CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Add audit logging to key tables
CREATE TRIGGER audit_log_racks
    AFTER INSERT OR UPDATE OR DELETE ON racks
    FOR EACH ROW
    EXECUTE FUNCTION create_audit_log_entry();

CREATE TRIGGER audit_log_audit_sessions
    AFTER INSERT OR UPDATE OR DELETE ON audit_sessions
    FOR EACH ROW
    EXECUTE FUNCTION create_audit_log_entry();

-- Function to handle user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO users (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'scanner')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for new user registration
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Function to get rack assignment for scanner
CREATE OR REPLACE FUNCTION assign_available_rack(
    p_audit_session_id UUID,
    p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
    available_rack_id UUID;
BEGIN
    -- Find first available rack in the audit session
    SELECT id INTO available_rack_id
    FROM racks
    WHERE audit_session_id = p_audit_session_id
    AND status = 'available'
    ORDER BY rack_number
    LIMIT 1;
    
    -- If found, assign it to the user
    IF available_rack_id IS NOT NULL THEN
        UPDATE racks
        SET 
            status = 'assigned',
            scanner_id = p_user_id,
            assigned_at = NOW()
        WHERE id = available_rack_id;
    END IF;
    
    RETURN available_rack_id;
END;
$$ LANGUAGE plpgsql;

-- Function to complete audit session
CREATE OR REPLACE FUNCTION complete_audit_session(p_audit_session_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    pending_racks INTEGER;
BEGIN
    -- Check if all racks are approved
    SELECT COUNT(*) INTO pending_racks
    FROM racks
    WHERE audit_session_id = p_audit_session_id
    AND status != 'approved';
    
    -- If no pending racks, complete the audit
    IF pending_racks = 0 THEN
        UPDATE audit_sessions
        SET 
            status = 'completed',
            completed_at = NOW(),
            completed_by = auth.uid()
        WHERE id = p_audit_session_id;
        
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to get audit session stats
CREATE OR REPLACE FUNCTION get_audit_session_stats(p_audit_session_id UUID)
RETURNS TABLE (
    total_racks INTEGER,
    available_racks INTEGER,
    assigned_racks INTEGER,
    ready_racks INTEGER,
    approved_racks INTEGER,
    rejected_racks INTEGER,
    total_scans BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_racks,
        COUNT(CASE WHEN r.status = 'available' THEN 1 END)::INTEGER as available_racks,
        COUNT(CASE WHEN r.status = 'assigned' THEN 1 END)::INTEGER as assigned_racks,
        COUNT(CASE WHEN r.status = 'ready_for_approval' THEN 1 END)::INTEGER as ready_racks,
        COUNT(CASE WHEN r.status = 'approved' THEN 1 END)::INTEGER as approved_racks,
        COUNT(CASE WHEN r.status = 'rejected' THEN 1 END)::INTEGER as rejected_racks,
        COALESCE(SUM(r.total_scans), 0) as total_scans
    FROM racks r
    WHERE r.audit_session_id = p_audit_session_id;
END;
$$ LANGUAGE plpgsql;