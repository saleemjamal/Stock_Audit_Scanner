-- Damaged Goods System - Database Schema
-- Production deployment script for Stock Audit Scanner System
-- Created: August 18, 2025

-- STEP 1: Create enum types first
CREATE TYPE damage_status_enum AS ENUM (
    'pending',
    'approved', 
    'rejected',
    'removed_from_stock'
);

CREATE TYPE damage_severity_enum AS ENUM (
    'minor',     -- Cosmetic damage
    'medium',    -- Functional impact  
    'severe',    -- Unusable/safety hazard
    'total_loss' -- Complete destruction
);

-- STEP 2: Create damaged_items table
CREATE TABLE damaged_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audit_session_id UUID NOT NULL REFERENCES audit_sessions(id) ON DELETE CASCADE,
    barcode VARCHAR(50) NOT NULL,
    reported_by UUID NOT NULL REFERENCES users(id),
    reported_at TIMESTAMPTZ DEFAULT NOW(),
    damage_description TEXT,
    damage_severity damage_severity_enum DEFAULT 'medium',
    status damage_status_enum DEFAULT 'pending',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    removed_from_stock BOOLEAN DEFAULT false,
    removed_at TIMESTAMPTZ,
    removed_by UUID REFERENCES users(id),
    estimated_loss_value DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- STEP 3: Create damage_images table
CREATE TABLE damage_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    damaged_item_id UUID NOT NULL REFERENCES damaged_items(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    image_filename VARCHAR(255) NOT NULL,
    image_order INTEGER NOT NULL CHECK (image_order BETWEEN 1 AND 3),
    file_size_bytes INTEGER,
    mime_type VARCHAR(50) DEFAULT 'image/jpeg',
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(damaged_item_id, image_order)
);

-- STEP 4: Create performance indexes
CREATE INDEX idx_damaged_items_session ON damaged_items(audit_session_id);
CREATE INDEX idx_damaged_items_status ON damaged_items(status);
CREATE INDEX idx_damaged_items_reported_by ON damaged_items(reported_by);
CREATE INDEX idx_damaged_items_barcode ON damaged_items(barcode);
CREATE INDEX idx_damage_images_item ON damage_images(damaged_item_id);

-- STEP 5: Create database functions

-- Function 1: Get pending damage reports for approval
CREATE OR REPLACE FUNCTION get_pending_damage_reports(p_user_id UUID)
RETURNS TABLE (
    damage_id UUID,
    barcode VARCHAR,
    damage_description TEXT,
    damage_severity damage_severity_enum,
    reported_by_name VARCHAR,
    reported_at TIMESTAMPTZ,
    session_shortname VARCHAR,
    location_name VARCHAR,
    image_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only super users can access this function
    IF NOT EXISTS (
        SELECT 1 FROM users 
        WHERE id = p_user_id AND role = 'superuser'
    ) THEN
        RAISE EXCEPTION 'Access denied: Super user role required';
    END IF;

    RETURN QUERY
    SELECT 
        d.id as damage_id,
        d.barcode,
        d.damage_description,
        d.damage_severity,
        COALESCE(u.full_name, u.username) as reported_by_name,
        d.reported_at,
        a.shortname as session_shortname,
        l.name as location_name,
        COUNT(i.id) as image_count
    FROM damaged_items d
    INNER JOIN users u ON u.id = d.reported_by
    INNER JOIN audit_sessions a ON a.id = d.audit_session_id
    INNER JOIN locations l ON l.id = a.location_id
    LEFT JOIN damage_images i ON i.damaged_item_id = d.id
    WHERE d.status = 'pending'
    GROUP BY d.id, d.barcode, d.damage_description, d.damage_severity,
             u.full_name, u.username, d.reported_at, a.shortname, l.name
    ORDER BY d.reported_at ASC;
END;
$$;

-- Function 2: Approve damage report
CREATE OR REPLACE FUNCTION approve_damage_report(
    p_damage_id UUID,
    p_approved_by UUID,
    p_remove_from_stock BOOLEAN DEFAULT false
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verify super user permission
    IF NOT EXISTS (
        SELECT 1 FROM users 
        WHERE id = p_approved_by AND role = 'superuser'
    ) THEN
        RAISE EXCEPTION 'Access denied: Super user role required';
    END IF;

    -- Update damage report
    UPDATE damaged_items 
    SET 
        status = CASE 
            WHEN p_remove_from_stock THEN 'removed_from_stock'::damage_status_enum 
            ELSE 'approved'::damage_status_enum 
        END,
        approved_by = p_approved_by,
        approved_at = NOW(),
        removed_from_stock = p_remove_from_stock,
        removed_at = CASE WHEN p_remove_from_stock THEN NOW() ELSE NULL END,
        removed_by = CASE WHEN p_remove_from_stock THEN p_approved_by ELSE NULL END,
        updated_at = NOW()
    WHERE id = p_damage_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Damage report not found: %', p_damage_id;
    END IF;
END;
$$;

-- Function 3: Get damage summary by audit session
CREATE OR REPLACE FUNCTION get_session_damage_summary(p_session_id UUID)
RETURNS TABLE (
    total_damage_reports BIGINT,
    pending_reports BIGINT,
    approved_reports BIGINT,
    rejected_reports BIGINT,
    removed_from_stock BIGINT,
    estimated_total_loss DECIMAL
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_damage_reports,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_reports,
        COUNT(*) FILTER (WHERE status = 'approved') as approved_reports,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_reports,
        COUNT(*) FILTER (WHERE removed_from_stock = true) as removed_from_stock,
        COALESCE(SUM(estimated_loss_value), 0) as estimated_total_loss
    FROM damaged_items
    WHERE audit_session_id = p_session_id;
END;
$$;

-- STEP 6: Enable RLS and create policies
ALTER TABLE damaged_items ENABLE ROW LEVEL SECURITY;

-- Users can see their own reports
CREATE POLICY "Users can view own damage reports" 
ON damaged_items FOR SELECT 
TO authenticated 
USING (reported_by = auth.uid());

-- Supervisors can see reports in their locations
CREATE POLICY "Supervisors can view location damage reports" 
ON damaged_items FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM users u 
        INNER JOIN audit_sessions a ON a.id = damaged_items.audit_session_id
        WHERE u.id = auth.uid() 
        AND u.role IN ('supervisor', 'superuser')
        AND (
            u.role = 'superuser' 
            OR a.location_id = ANY(u.location_ids::integer[])
        )
    )
);

-- Only authenticated users can insert damage reports
CREATE POLICY "Authenticated users can create damage reports" 
ON damaged_items FOR INSERT 
TO authenticated 
WITH CHECK (reported_by = auth.uid());

-- Only super users can update damage reports (approval/rejection)
CREATE POLICY "Super users can update damage reports" 
ON damaged_items FOR UPDATE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() AND role = 'superuser'
    )
);

-- RLS for damage_images table
ALTER TABLE damage_images ENABLE ROW LEVEL SECURITY;

-- Users can view images for reports they can see
CREATE POLICY "Users can view damage images" 
ON damage_images FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM damaged_items d
        WHERE d.id = damage_images.damaged_item_id
    )
);

-- Users can insert images for their own reports
CREATE POLICY "Users can upload damage images" 
ON damage_images FOR INSERT 
TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM damaged_items d
        WHERE d.id = damage_images.damaged_item_id 
        AND d.reported_by = auth.uid()
    )
);

-- STEP 7: Grant permissions
GRANT ALL ON damaged_items TO authenticated;
GRANT ALL ON damage_images TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_damage_reports(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_damage_report(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION get_session_damage_summary(UUID) TO authenticated;

-- Comments for documentation
COMMENT ON TABLE damaged_items IS 'Damage reports for inventory items during audit sessions';
COMMENT ON TABLE damage_images IS 'Photo documentation for damage reports (3 photos max per report)';
COMMENT ON FUNCTION get_pending_damage_reports(UUID) IS 'Returns pending damage reports for super user approval';
COMMENT ON FUNCTION approve_damage_report(UUID, UUID, BOOLEAN) IS 'Approve or reject damage report with optional stock removal';
COMMENT ON FUNCTION get_session_damage_summary(UUID) IS 'Get damage statistics for an audit session';