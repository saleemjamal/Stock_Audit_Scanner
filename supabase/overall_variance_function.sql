-- Overall Variance Report Function
-- Returns comprehensive item-level variance data for all inventory items in an audit session
-- Brand-agnostic and includes all items (not limited like brand variance functions)

CREATE OR REPLACE FUNCTION get_overall_variance_report(session_id UUID)
RETURNS TABLE (
  item_code TEXT,
  item_name TEXT,
  brand TEXT,
  expected_quantity INTEGER,
  actual_quantity INTEGER,
  variance_quantity INTEGER,
  unit_cost DECIMAL,
  expected_value DECIMAL,
  actual_value DECIMAL,
  variance_value DECIMAL,
  status TEXT
) AS $$
WITH session_location AS (
  SELECT location_id FROM audit_sessions WHERE id = session_id
),
scan_data AS (
  SELECT 
    SUBSTRING(barcode, 1, 5) as item_code, 
    SUM(COALESCE(quantity, 1)) as total_quantity
  FROM scans 
  WHERE audit_session_id = session_id 
  GROUP BY SUBSTRING(barcode, 1, 5)
)
SELECT 
  i.item_code,
  i.item_name,
  i.brand,
  i.expected_quantity,
  COALESCE(s.total_quantity, 0)::INTEGER as actual_quantity,
  (COALESCE(s.total_quantity, 0) - i.expected_quantity)::INTEGER as variance_quantity,
  i.unit_cost,
  (i.expected_quantity * i.unit_cost)::DECIMAL as expected_value,
  (COALESCE(s.total_quantity, 0) * i.unit_cost)::DECIMAL as actual_value,
  ((COALESCE(s.total_quantity, 0) - i.expected_quantity) * i.unit_cost)::DECIMAL as variance_value,
  CASE 
    WHEN s.total_quantity IS NULL THEN 'Missing'
    WHEN s.total_quantity > i.expected_quantity THEN 'Overage'
    WHEN s.total_quantity < i.expected_quantity THEN 'Shortage'
    ELSE 'Match'
  END as status
FROM inventory_items i
CROSS JOIN session_location sl
LEFT JOIN scan_data s ON i.item_code = s.item_code
WHERE i.location_id = sl.location_id
ORDER BY ABS((COALESCE(s.total_quantity, 0) - i.expected_quantity) * i.unit_cost) DESC;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_overall_variance_report(UUID) TO authenticated;

-- Comments for documentation
COMMENT ON FUNCTION get_overall_variance_report(UUID) IS 'Returns comprehensive item-level variance report for all inventory items in an audit session, sorted by absolute variance value';

-- Additional helper function for variance report metadata
CREATE OR REPLACE FUNCTION get_variance_report_metadata(session_id UUID)
RETURNS TABLE (
  session_shortname TEXT,
  location_name TEXT,
  session_status TEXT,
  total_inventory_items INTEGER,
  total_expected_quantity INTEGER,
  total_actual_quantity INTEGER,
  total_expected_value DECIMAL,
  total_actual_value DECIMAL,
  total_variance_value DECIMAL,
  total_variance_percent DECIMAL,
  missing_items INTEGER,
  overage_items INTEGER,
  shortage_items INTEGER,
  match_items INTEGER,
  generated_at TIMESTAMPTZ
) AS $$
WITH session_info AS (
  SELECT 
    s.shortname,
    s.status,
    l.name as location_name
  FROM audit_sessions s
  JOIN locations l ON s.location_id = l.id
  WHERE s.id = session_id
),
variance_data AS (
  SELECT * FROM get_overall_variance_report(session_id)
)
SELECT 
  si.shortname as session_shortname,
  si.location_name,
  si.status as session_status,
  COUNT(*)::INTEGER as total_inventory_items,
  SUM(vd.expected_quantity)::INTEGER as total_expected_quantity,
  SUM(vd.actual_quantity)::INTEGER as total_actual_quantity,
  SUM(vd.expected_value)::DECIMAL as total_expected_value,
  SUM(vd.actual_value)::DECIMAL as total_actual_value,
  SUM(vd.variance_value)::DECIMAL as total_variance_value,
  CASE 
    WHEN SUM(vd.expected_value) = 0 THEN 0::DECIMAL
    ELSE ROUND((SUM(vd.variance_value) / SUM(vd.expected_value)) * 100, 2)::DECIMAL
  END as total_variance_percent,
  COUNT(CASE WHEN vd.status = 'Missing' THEN 1 END)::INTEGER as missing_items,
  COUNT(CASE WHEN vd.status = 'Overage' THEN 1 END)::INTEGER as overage_items,
  COUNT(CASE WHEN vd.status = 'Shortage' THEN 1 END)::INTEGER as shortage_items,
  COUNT(CASE WHEN vd.status = 'Match' THEN 1 END)::INTEGER as match_items,
  NOW() as generated_at
FROM session_info si, variance_data vd
GROUP BY si.shortname, si.location_name, si.status;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_variance_report_metadata(UUID) TO authenticated;

-- Comments
COMMENT ON FUNCTION get_variance_report_metadata(UUID) IS 'Returns metadata and summary statistics for variance reports including totals and status counts';