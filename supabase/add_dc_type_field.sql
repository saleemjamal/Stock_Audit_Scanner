-- Add DC type field to support different types of delivery challans
-- Sample: Items sent to customers for evaluation
-- Replacement: Items sent back to vendors for replacement/repair

-- Add dc_type column to delivery_challans table
ALTER TABLE delivery_challans 
ADD COLUMN IF NOT EXISTS dc_type TEXT NOT NULL DEFAULT 'sample' 
CHECK (dc_type IN ('sample', 'replacement'));

-- Create index for filtering by dc_type
CREATE INDEX IF NOT EXISTS idx_delivery_challans_dc_type ON delivery_challans(dc_type);

-- Drop and recreate the get_dc_summary function to include type breakdown
DROP FUNCTION IF EXISTS get_dc_summary(UUID);
CREATE OR REPLACE FUNCTION get_dc_summary(p_session_id UUID)
RETURNS TABLE (
  total_dcs INTEGER,
  total_items INTEGER,
  total_quantity INTEGER,
  total_value DECIMAL,
  sample_dcs INTEGER,
  replacement_dcs INTEGER,
  sample_quantity INTEGER,
  replacement_quantity INTEGER
) AS $$
  SELECT 
    COUNT(DISTINCT dc.id)::INTEGER as total_dcs,
    COUNT(DISTINCT di.id)::INTEGER as total_items,
    COALESCE(SUM(di.quantity), 0)::INTEGER as total_quantity,
    COALESCE(SUM(di.quantity * di.unit_cost), 0)::DECIMAL as total_value,
    COUNT(DISTINCT CASE WHEN dc.dc_type = 'sample' THEN dc.id END)::INTEGER as sample_dcs,
    COUNT(DISTINCT CASE WHEN dc.dc_type = 'replacement' THEN dc.id END)::INTEGER as replacement_dcs,
    COALESCE(SUM(CASE WHEN dc.dc_type = 'sample' THEN di.quantity ELSE 0 END), 0)::INTEGER as sample_quantity,
    COALESCE(SUM(CASE WHEN dc.dc_type = 'replacement' THEN di.quantity ELSE 0 END), 0)::INTEGER as replacement_quantity
  FROM delivery_challans dc
  LEFT JOIN dc_items di ON dc.id = di.dc_id
  WHERE dc.audit_session_id = p_session_id;
$$ LANGUAGE SQL;

-- Add comment for documentation
COMMENT ON COLUMN delivery_challans.dc_type IS 'Type of DC: sample (sent to customers) or replacement (sent to vendors)';

-- Grant permissions (though table already has permissions)
GRANT EXECUTE ON FUNCTION get_dc_summary(UUID) TO authenticated;