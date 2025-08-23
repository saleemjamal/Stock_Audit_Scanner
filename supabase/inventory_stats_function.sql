-- Function to calculate inventory statistics efficiently in the database
-- This avoids the 20K row limit issue by doing aggregation server-side

CREATE OR REPLACE FUNCTION get_inventory_stats(location_id_param INTEGER)
RETURNS TABLE (
  unique_item_codes BIGINT,
  unique_brands BIGINT,
  total_barcodes BIGINT,
  total_expected_value DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT item_code) AS unique_item_codes,
    COUNT(DISTINCT brand) AS unique_brands,
    COUNT(*) AS total_barcodes,
    COALESCE(SUM(expected_quantity * unit_cost), 0) AS total_expected_value
  FROM inventory_items 
  WHERE location_id = location_id_param;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_inventory_stats(INTEGER) TO authenticated;