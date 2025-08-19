-- Migration: Create partial_damages table
-- Purpose: Track items that are partially damaged but still sellable (for discount)

CREATE TABLE partial_damages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID REFERENCES scans(id) ON DELETE CASCADE,
  audit_session_id UUID NOT NULL REFERENCES audit_sessions(id) ON DELETE CASCADE,
  rack_id UUID REFERENCES racks(id) ON DELETE CASCADE,
  barcode TEXT NOT NULL,
  damage_type TEXT NOT NULL CHECK (damage_type IN ('incomplete_set', 'partial_damage', 'quality_issue', 'packaging_issue', 'other')),
  affected_units INTEGER, -- How many units affected (optional)
  total_units INTEGER, -- Total units in package/set (optional)
  severity TEXT NOT NULL CHECK (severity IN ('minor', 'moderate', 'severe')),
  remarks TEXT NOT NULL, -- Required description
  photo_urls TEXT[], -- Array of photo URLs from Supabase Storage
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_partial_damages_session ON partial_damages(audit_session_id);
CREATE INDEX idx_partial_damages_barcode ON partial_damages(barcode);
CREATE INDEX idx_partial_damages_rack ON partial_damages(rack_id);
CREATE INDEX idx_partial_damages_type ON partial_damages(damage_type);
CREATE INDEX idx_partial_damages_severity ON partial_damages(severity);
CREATE INDEX idx_partial_damages_created_by ON partial_damages(created_by);

-- Disable RLS (following existing system patterns)
ALTER TABLE partial_damages DISABLE ROW LEVEL SECURITY;

-- Create storage bucket for partial damage photos (if not exists)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('partial-damage-photos', 'partial-damage-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for partial damage photos
CREATE POLICY "Users can upload partial damage photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'partial-damage-photos' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can view partial damage photos from their locations" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'partial-damage-photos'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete their own partial damage photos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'partial-damage-photos' 
    AND owner = auth.uid()
  );

-- Function to get partial damage summary for a session
CREATE OR REPLACE FUNCTION get_partial_damages_summary(session_id UUID)
RETURNS TABLE (
  id UUID,
  barcode TEXT,
  damage_type TEXT,
  severity TEXT,
  unit_ratio TEXT,
  remarks TEXT,
  photo_count INTEGER,
  created_by_name TEXT,
  created_at TIMESTAMPTZ
) AS $$
SELECT 
  pd.id,
  pd.barcode,
  pd.damage_type,
  pd.severity,
  CASE 
    WHEN pd.total_units > 0 THEN 
      COALESCE(pd.affected_units::TEXT, '?') || '/' || pd.total_units::TEXT
    ELSE 
      'N/A'
  END as unit_ratio,
  pd.remarks,
  COALESCE(array_length(pd.photo_urls, 1), 0) as photo_count,
  u.username as created_by_name,
  pd.created_at
FROM partial_damages pd
LEFT JOIN users u ON pd.created_by = u.id
WHERE pd.audit_session_id = session_id
ORDER BY 
  CASE pd.severity 
    WHEN 'severe' THEN 1
    WHEN 'moderate' THEN 2
    WHEN 'minor' THEN 3
  END,
  pd.created_at DESC;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_partial_damages_summary(UUID) TO authenticated;

COMMENT ON TABLE partial_damages IS 'Tracks items that are partially damaged but still sellable with discount';
COMMENT ON COLUMN partial_damages.scan_id IS 'Links to the scan record';
COMMENT ON COLUMN partial_damages.damage_type IS 'Type of partial damage observed';
COMMENT ON COLUMN partial_damages.affected_units IS 'Number of damaged units (optional)';
COMMENT ON COLUMN partial_damages.total_units IS 'Total units in set/package (optional)';
COMMENT ON COLUMN partial_damages.severity IS 'Severity level for prioritization';
COMMENT ON COLUMN partial_damages.photo_urls IS 'Array of photo URLs for documentation';