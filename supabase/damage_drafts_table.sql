-- Create damage_drafts table for CSV import workflow
-- This table stores damage reports imported from CSV before photos are added

CREATE TABLE damage_drafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audit_session_id UUID NOT NULL REFERENCES audit_sessions(id),
    barcode VARCHAR(50) NOT NULL,
    damage_severity damage_severity_enum DEFAULT 'medium',
    damage_description TEXT,
    photos_completed BOOLEAN DEFAULT false,
    imported_by UUID REFERENCES users(id),
    imported_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    converted_to_damage_id UUID REFERENCES damaged_items(id)
);

-- Create indexes for performance
CREATE INDEX idx_damage_drafts_session ON damage_drafts(audit_session_id);
CREATE INDEX idx_damage_drafts_photos ON damage_drafts(photos_completed);
CREATE INDEX idx_damage_drafts_imported_by ON damage_drafts(imported_by);

-- Enable RLS
ALTER TABLE damage_drafts ENABLE ROW LEVEL SECURITY;

-- RLS policies
-- Users can see their own drafts
CREATE POLICY "Users can view own damage drafts" 
ON damage_drafts FOR SELECT 
TO authenticated 
USING (imported_by = auth.uid());

-- Supervisors can see drafts in their locations
CREATE POLICY "Supervisors can view location damage drafts" 
ON damage_drafts FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM users u 
        INNER JOIN audit_sessions a ON a.id = damage_drafts.audit_session_id
        WHERE u.id = auth.uid() 
        AND u.role IN ('supervisor', 'superuser')
        AND (
            u.role = 'superuser' 
            OR a.location_id = ANY(u.location_ids::integer[])
        )
    )
);

-- Only authenticated users can insert damage drafts
CREATE POLICY "Authenticated users can create damage drafts" 
ON damage_drafts FOR INSERT 
TO authenticated 
WITH CHECK (imported_by = auth.uid());

-- Users can update their own drafts
CREATE POLICY "Users can update own damage drafts" 
ON damage_drafts FOR UPDATE 
TO authenticated 
USING (imported_by = auth.uid());

-- Grant permissions
GRANT ALL ON damage_drafts TO authenticated;

-- Comments for documentation
COMMENT ON TABLE damage_drafts IS 'Temporary storage for damage reports imported from CSV before photos are added';
COMMENT ON COLUMN damage_drafts.photos_completed IS 'True when all required photos have been added and converted to final damage report';
COMMENT ON COLUMN damage_drafts.converted_to_damage_id IS 'Reference to the final damage report created from this draft';