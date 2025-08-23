-- Update DC Items table to store selected barcode
-- This allows specific barcode selection when multiple barcodes exist for an item code

-- Add selected_barcode column to dc_items
ALTER TABLE dc_items 
ADD COLUMN IF NOT EXISTS selected_barcode TEXT;

-- Function to get DC items as individual barcodes for reporting
CREATE OR REPLACE FUNCTION get_dc_items_as_barcodes(p_session_id UUID)
RETURNS TABLE (
  barcode TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH dc_barcodes AS (
    SELECT 
      di.selected_barcode as barcode,
      di.quantity
    FROM delivery_challans dc
    JOIN dc_items di ON dc.id = di.dc_id
    WHERE dc.audit_session_id = p_session_id
      AND di.selected_barcode IS NOT NULL
  ),
  expanded_barcodes AS (
    SELECT 
      barcode,
      generate_series(1, quantity) as seq
    FROM dc_barcodes
  )
  SELECT barcode
  FROM expanded_barcodes
  ORDER BY barcode;
END;
$$ LANGUAGE plpgsql;

-- Function to get DC items report with details
CREATE OR REPLACE FUNCTION get_dc_items_report(p_session_id UUID)
RETURNS TABLE (
  dc_number TEXT,
  item_code TEXT,
  item_name TEXT,
  brand TEXT,
  quantity INTEGER,
  selected_barcode TEXT,
  total_barcodes INTEGER
) AS $$
  SELECT 
    dc.dc_number,
    di.item_code,
    di.item_name,
    di.brand,
    di.quantity,
    di.selected_barcode,
    di.quantity as total_barcodes
  FROM delivery_challans dc
  JOIN dc_items di ON dc.id = di.dc_id
  WHERE dc.audit_session_id = p_session_id
  ORDER BY dc.dc_number, di.item_code;
$$ LANGUAGE SQL;

-- Function to get DC summary with barcode counts
CREATE OR REPLACE FUNCTION get_dc_barcode_summary(p_session_id UUID)
RETURNS TABLE (
  total_dcs INTEGER,
  total_items INTEGER,
  total_quantity INTEGER,
  total_barcodes_to_add INTEGER,
  items_with_barcode INTEGER,
  items_without_barcode INTEGER
) AS $$
  SELECT 
    COUNT(DISTINCT dc.id)::INTEGER as total_dcs,
    COUNT(DISTINCT di.id)::INTEGER as total_items,
    COALESCE(SUM(di.quantity), 0)::INTEGER as total_quantity,
    COALESCE(SUM(CASE WHEN di.selected_barcode IS NOT NULL THEN di.quantity ELSE 0 END), 0)::INTEGER as total_barcodes_to_add,
    COUNT(DISTINCT CASE WHEN di.selected_barcode IS NOT NULL THEN di.id END)::INTEGER as items_with_barcode,
    COUNT(DISTINCT CASE WHEN di.selected_barcode IS NULL THEN di.id END)::INTEGER as items_without_barcode
  FROM delivery_challans dc
  LEFT JOIN dc_items di ON dc.id = di.dc_id
  WHERE dc.audit_session_id = p_session_id;
$$ LANGUAGE SQL;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_dc_items_as_barcodes(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dc_items_report(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dc_barcode_summary(UUID) TO authenticated;

-- Comments for documentation
COMMENT ON COLUMN dc_items.selected_barcode IS 'The specific barcode selected for this DC item when multiple barcodes exist for the item code';
COMMENT ON FUNCTION get_dc_items_as_barcodes IS 'Returns a single column of barcodes from DC items, repeated by quantity for audit report inclusion';
COMMENT ON FUNCTION get_dc_items_report IS 'Returns detailed DC items report with selected barcodes';
COMMENT ON FUNCTION get_dc_barcode_summary IS 'Returns summary statistics for DC items and their barcode assignments';