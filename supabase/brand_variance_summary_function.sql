-- Brand Variance Overall Summary Function
-- This function returns the overall totals for all inventory and scans in a session

CREATE OR REPLACE FUNCTION get_brand_variance_summary(session_id UUID)
RETURNS TABLE (
  total_expected_quantity INTEGER,
  total_scanned_quantity INTEGER,
  total_expected_value DECIMAL,
  total_actual_value DECIMAL,
  total_variance_value DECIMAL,
  total_variance_percent DECIMAL,
  total_inventory_items INTEGER,
  unique_scanned_items INTEGER
) AS $$
WITH session_location AS (
  SELECT location_id FROM audit_sessions WHERE id = session_id
),
scan_data AS (
  SELECT 
    SUBSTRING(barcode, 1, 5) as item_code, 
    COUNT(*) as scan_count
  FROM scans 
  WHERE audit_session_id = session_id 
  GROUP BY SUBSTRING(barcode, 1, 5)
),
summary_data AS (
  SELECT 
    -- Total expected quantities and values
    SUM(i.expected_quantity) as total_expected_quantity,
    SUM(i.expected_quantity * i.unit_cost) as total_expected_value,
    -- Total actual quantities and values
    SUM(COALESCE(s.scan_count, 0)) as total_scanned_quantity,
    SUM(COALESCE(s.scan_count, 0) * i.unit_cost) as total_actual_value,
    -- Total inventory items
    COUNT(*) as total_inventory_items,
    -- Unique scanned items
    COUNT(CASE WHEN s.scan_count > 0 THEN 1 END) as unique_scanned_items
  FROM inventory_items i
  CROSS JOIN session_location sl
  LEFT JOIN scan_data s ON i.item_code = s.item_code
  WHERE i.location_id = sl.location_id
)
SELECT 
  sd.total_expected_quantity::INTEGER,
  sd.total_scanned_quantity::INTEGER,
  sd.total_expected_value::DECIMAL,
  sd.total_actual_value::DECIMAL,
  (sd.total_actual_value - sd.total_expected_value)::DECIMAL as total_variance_value,
  CASE 
    WHEN sd.total_expected_value = 0 THEN 0::DECIMAL
    ELSE ROUND(((sd.total_actual_value - sd.total_expected_value) / sd.total_expected_value) * 100, 2)::DECIMAL
  END as total_variance_percent,
  sd.total_inventory_items::INTEGER,
  sd.unique_scanned_items::INTEGER
FROM summary_data sd;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_brand_variance_summary(UUID) TO authenticated;

-- Comments
COMMENT ON FUNCTION get_brand_variance_summary(UUID) IS 'Returns overall variance summary totals for all inventory items in a session, not limited by brand filtering';