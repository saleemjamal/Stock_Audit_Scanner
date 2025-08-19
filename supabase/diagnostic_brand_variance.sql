-- Diagnostic Queries for Brand Variance Issues
-- Run these queries to understand the data discrepancies

-- 1. Basic session info
SELECT 'SESSION INFO' as query_type;
SELECT 
  id,
  shortname,
  location_id,
  status,
  total_rack_count,
  started_at
FROM audit_sessions 
WHERE status = 'active'  -- or use specific session_id
ORDER BY started_at DESC 
LIMIT 3;

-- 2. Total inventory items for the session location
SELECT 'TOTAL INVENTORY' as query_type;
SELECT 
  location_id,
  COUNT(*) as total_inventory_items,
  SUM(expected_quantity) as total_expected_quantity,
  SUM(expected_quantity * unit_cost) as total_expected_value,
  COUNT(DISTINCT brand) as total_brands
FROM inventory_items 
WHERE location_id = (
  SELECT location_id FROM audit_sessions 
  WHERE status = 'active'  -- Replace with your session_id
  LIMIT 1
)
GROUP BY location_id;

-- 3. Total scans for the session
SELECT 'TOTAL SCANS' as query_type;
SELECT 
  audit_session_id,
  COUNT(*) as total_scans,
  COUNT(DISTINCT barcode) as unique_barcodes,
  COUNT(DISTINCT SUBSTRING(barcode, 1, 5)) as unique_item_codes
FROM scans 
WHERE audit_session_id = (
  SELECT id FROM audit_sessions 
  WHERE status = 'active'  -- Replace with your session_id
  LIMIT 1
)
GROUP BY audit_session_id;

-- 4. Sample barcodes and their item codes
SELECT 'BARCODE SAMPLES' as query_type;
SELECT 
  barcode,
  SUBSTRING(barcode, 1, 5) as extracted_item_code,
  LENGTH(barcode) as barcode_length,
  COUNT(*) as scan_count
FROM scans 
WHERE audit_session_id = (
  SELECT id FROM audit_sessions 
  WHERE status = 'active'  -- Replace with your session_id
  LIMIT 1
)
GROUP BY barcode, SUBSTRING(barcode, 1, 5), LENGTH(barcode)
ORDER BY scan_count DESC
LIMIT 10;

-- 5. Check for inventory items that match scanned item codes
SELECT 'MATCHING INVENTORY' as query_type;
SELECT 
  'scanned_but_not_in_inventory' as category,
  COUNT(*) as count
FROM (
  SELECT DISTINCT SUBSTRING(barcode, 1, 5) as item_code
  FROM scans 
  WHERE audit_session_id = (
    SELECT id FROM audit_sessions 
    WHERE status = 'active'  -- Replace with your session_id
    LIMIT 1
  )
) scanned
WHERE item_code NOT IN (
  SELECT item_code FROM inventory_items 
  WHERE location_id = (
    SELECT location_id FROM audit_sessions 
    WHERE status = 'active'  -- Replace with your session_id
    LIMIT 1
  )
);

-- 6. Check for inventory items that were never scanned
SELECT 'UNSCANNED INVENTORY' as query_type;
SELECT 
  'inventory_not_scanned' as category,
  COUNT(*) as count
FROM inventory_items i
WHERE i.location_id = (
  SELECT location_id FROM audit_sessions 
  WHERE status = 'active'  -- Replace with your session_id
  LIMIT 1
)
AND i.item_code NOT IN (
  SELECT DISTINCT SUBSTRING(barcode, 1, 5) 
  FROM scans 
  WHERE audit_session_id = (
    SELECT id FROM audit_sessions 
    WHERE status = 'active'  -- Replace with your session_id
    LIMIT 1
  )
);

-- 7. Brand breakdown comparison
SELECT 'BRAND BREAKDOWN' as query_type;
SELECT 
  i.brand,
  COUNT(i.*) as inventory_items,
  SUM(i.expected_quantity) as expected_qty,
  SUM(i.expected_quantity * i.unit_cost) as expected_value,
  COUNT(DISTINCT s.item_code) as unique_scanned_items,
  SUM(COALESCE(s.scan_count, 0)) as total_scanned_qty,
  SUM(COALESCE(s.scan_count, 0) * i.unit_cost) as actual_value
FROM inventory_items i
LEFT JOIN (
  SELECT 
    SUBSTRING(barcode, 1, 5) as item_code,
    COUNT(*) as scan_count
  FROM scans 
  WHERE audit_session_id = (
    SELECT id FROM audit_sessions 
    WHERE status = 'active'  -- Replace with your session_id
    LIMIT 1
  )
  GROUP BY SUBSTRING(barcode, 1, 5)
) s ON i.item_code = s.item_code
WHERE i.location_id = (
  SELECT location_id FROM audit_sessions 
  WHERE status = 'active'  -- Replace with your session_id
  LIMIT 1
)
GROUP BY i.brand
ORDER BY expected_value DESC
LIMIT 10;

-- Instructions:
-- 1. Replace 'WHERE status = active' with 'WHERE id = your_session_id'
-- 2. Run each query section separately
-- 3. Compare results with what you see in the frontend