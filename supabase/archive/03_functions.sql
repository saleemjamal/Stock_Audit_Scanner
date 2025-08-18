-- 03. Essential Functions - Google SSO Compatible
-- Only the essential functions we actually need

-- Get audit session statistics
CREATE OR REPLACE FUNCTION get_audit_session_stats(p_audit_session_id UUID)
RETURNS TABLE (
    total_racks INTEGER,
    assigned_racks INTEGER,
    completed_racks INTEGER,
    approved_racks INTEGER,
    rejected_racks INTEGER,
    pending_approval INTEGER,
    total_scans BIGINT,
    completion_percentage NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_racks,
        COUNT(CASE WHEN r.status != 'available' THEN 1 END)::INTEGER as assigned_racks,
        COUNT(CASE WHEN r.status IN ('ready_for_approval', 'approved', 'rejected') THEN 1 END)::INTEGER as completed_racks,
        COUNT(CASE WHEN r.status = 'approved' THEN 1 END)::INTEGER as approved_racks,
        COUNT(CASE WHEN r.status = 'rejected' THEN 1 END)::INTEGER as rejected_racks,
        COUNT(CASE WHEN r.ready_for_approval = true AND r.status = 'ready_for_approval' THEN 1 END)::INTEGER as pending_approval,
        COALESCE(scan_stats.total_scans, 0) as total_scans,
        CASE 
            WHEN COUNT(*) > 0 THEN 
                ROUND((COUNT(CASE WHEN r.status = 'approved' THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
            ELSE 0 
        END as completion_percentage
    FROM racks r
    LEFT JOIN (
        SELECT 
            audit_session_id,
            COUNT(*) as total_scans
        FROM scans 
        WHERE audit_session_id = p_audit_session_id
        GROUP BY audit_session_id
    ) scan_stats ON scan_stats.audit_session_id = p_audit_session_id
    WHERE r.audit_session_id = p_audit_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Assign rack to user
CREATE OR REPLACE FUNCTION assign_rack_to_user(p_rack_id UUID, p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    rack_record RECORD;
    user_record RECORD;
BEGIN
    -- Check if user exists and get their info
    SELECT * INTO user_record FROM users WHERE id = p_user_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;
    
    -- Check if rack exists and is available
    SELECT * INTO rack_record FROM racks WHERE id = p_rack_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Rack not found');
    END IF;
    
    IF rack_record.status != 'available' THEN
        RETURN json_build_object('success', false, 'error', 'Rack is not available');
    END IF;
    
    -- Check if user has access to this location
    IF NOT (rack_record.location_id = ANY(user_record.location_ids) OR user_record.role = 'superuser') THEN
        RETURN json_build_object('success', false, 'error', 'User does not have access to this location');
    END IF;
    
    -- Assign the rack
    UPDATE racks 
    SET 
        status = 'assigned',
        scanner_id = p_user_id,
        assigned_at = NOW(),
        updated_at = NOW()
    WHERE id = p_rack_id;
    
    RETURN json_build_object('success', true, 'message', 'Rack assigned successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark rack as ready for approval
CREATE OR REPLACE FUNCTION mark_rack_ready(p_rack_id UUID)
RETURNS JSON AS $$
DECLARE
    rack_record RECORD;
    scan_count INTEGER;
BEGIN
    -- Get rack info
    SELECT * INTO rack_record FROM racks WHERE id = p_rack_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Rack not found');
    END IF;
    
    -- Check if rack belongs to current user
    IF rack_record.scanner_id != (get_current_user_profile()).id AND NOT is_supervisor_or_above() THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized');
    END IF;
    
    -- Check if rack has any scans
    SELECT COUNT(*) INTO scan_count FROM scans WHERE rack_id = p_rack_id;
    IF scan_count = 0 THEN
        RETURN json_build_object('success', false, 'error', 'Cannot mark empty rack as ready');
    END IF;
    
    -- Mark as ready for approval
    UPDATE racks 
    SET 
        status = 'ready_for_approval',
        ready_for_approval = true,
        ready_at = NOW(),
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_rack_id;
    
    -- Create notification for supervisors
    INSERT INTO notifications (user_id, title, message, type, created_by)
    SELECT 
        u.id,
        'Rack Ready for Approval',
        format('Rack %s at %s is ready for approval', rack_record.rack_number, l.name),
        'approval_request',
        rack_record.scanner_id
    FROM users u
    JOIN locations l ON l.id = rack_record.location_id
    WHERE u.role IN ('supervisor', 'superuser')
      AND (rack_record.location_id = ANY(u.location_ids) OR u.role = 'superuser');
    
    RETURN json_build_object('success', true, 'message', 'Rack marked as ready for approval');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Approve or reject rack
CREATE OR REPLACE FUNCTION approve_reject_rack(
    p_rack_id UUID, 
    p_approved BOOLEAN, 
    p_reason TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    rack_record RECORD;
    current_user_id UUID;
BEGIN
    -- Get current user
    SELECT id INTO current_user_id FROM get_current_user_profile();
    IF current_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User not authenticated');
    END IF;
    
    -- Check if user is supervisor or above
    IF NOT is_supervisor_or_above() THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized - supervisor role required');
    END IF;
    
    -- Get rack info
    SELECT * INTO rack_record FROM racks WHERE id = p_rack_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Rack not found');
    END IF;
    
    -- Check if rack is ready for approval
    IF NOT rack_record.ready_for_approval THEN
        RETURN json_build_object('success', false, 'error', 'Rack is not ready for approval');
    END IF;
    
    -- Update rack status
    IF p_approved THEN
        UPDATE racks 
        SET 
            status = 'approved',
            ready_for_approval = false,
            approved_by = current_user_id,
            approved_at = NOW(),
            updated_at = NOW()
        WHERE id = p_rack_id;
    ELSE
        UPDATE racks 
        SET 
            status = 'rejected',
            ready_for_approval = false,
            rejected_by = current_user_id,
            rejected_at = NOW(),
            rejection_reason = COALESCE(p_reason, 'No reason provided'),
            updated_at = NOW()
        WHERE id = p_rack_id;
    END IF;
    
    -- Create notification for scanner
    INSERT INTO notifications (user_id, title, message, type, created_by)
    VALUES (
        rack_record.scanner_id,
        CASE WHEN p_approved THEN 'Rack Approved' ELSE 'Rack Rejected' END,
        format('Rack %s has been %s', 
               rack_record.rack_number, 
               CASE WHEN p_approved THEN 'approved' ELSE 'rejected' || COALESCE(': ' || p_reason, '') END),
        CASE WHEN p_approved THEN 'approval' ELSE 'rejection' END,
        current_user_id
    );
    
    RETURN json_build_object(
        'success', true, 
        'message', format('Rack %s successfully', CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update user last login
CREATE OR REPLACE FUNCTION update_user_last_login(p_email TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE users 
    SET last_login_at = NOW() 
    WHERE email = p_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT '✅ ESSENTIAL FUNCTIONS CREATED!' as status;
SELECT 'Next: Run 04_seed_data.sql' as next_step;