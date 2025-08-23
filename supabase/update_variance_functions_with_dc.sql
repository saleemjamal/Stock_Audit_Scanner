-- Updated Variance Functions with DC Support and Barcode Join
-- This replaces the SUBSTRING approach with direct barcode join

-- Drop existing functions first
DROP FUNCTION IF EXISTS get_live_brand_variance(UUID);
DROP FUNCTION IF EXISTS get_live_brand_variance_widget(UUID);
DROP FUNCTION IF EXISTS get_brand_detail_variance(UUID, TEXT);

-- Updated function to get live brand variance with DC adjustments
CREATE OR REPLACE FUNCTION get_live_brand_variance(session_id UUID)
RETURNS TABLE (
  brand TEXT,
  expected_value DECIMAL,
  actual_value DECIMAL,
  dc_value DECIMAL,
  variance_value DECIMAL,
  variance_percent DECIMAL,
  item_count INTEGER,
  scanned_count INTEGER,
  dc_count INTEGER
) AS $$
SELECT 
  brands.brand,
  
  -- Expected value: sum of all inventory for this brand
  (SELECT COALESCE(SUM(expected_quantity * unit_cost), 0)::DECIMAL
   FROM inventory_items 
   WHERE brand = brands.brand 
   AND location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
  ) as expected_value,
  
  -- Actual value: sum of scanned items for this brand
  (SELECT COALESCE(SUM(s.scan_count * i.unit_cost), 0)::DECIMAL
   FROM inventory_items i
   JOIN (
     SELECT barcode, COUNT(*) as scan_count
     FROM scans 
     WHERE audit_session_id = session_id 
     GROUP BY barcode
   ) s ON i.barcode = s.barcode
   WHERE i.brand = brands.brand
   AND i.location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
  ) as actual_value,
  
  -- DC value: sum of items on delivery challans
  (SELECT COALESCE(SUM(di.quantity * i.unit_cost), 0)::DECIMAL
   FROM delivery_challans dc
   JOIN dc_items di ON dc.id = di.dc_id
   JOIN inventory_items i ON i.item_code = di.item_code 
     AND i.location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
   WHERE dc.audit_session_id = session_id
   AND i.brand = brands.brand
  ) as dc_value,
  
  -- Variance value: (Actual + DC) - Expected
  (
    (SELECT COALESCE(SUM(s.scan_count * i.unit_cost), 0)::DECIMAL
     FROM inventory_items i
     JOIN (
       SELECT barcode, COUNT(*) as scan_count
       FROM scans 
       WHERE audit_session_id = session_id 
       GROUP BY barcode
     ) s ON i.barcode = s.barcode
     WHERE i.brand = brands.brand
     AND i.location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
    ) +
    (SELECT COALESCE(SUM(di.quantity * i.unit_cost), 0)::DECIMAL
     FROM delivery_challans dc
     JOIN dc_items di ON dc.id = di.dc_id
     JOIN inventory_items i ON i.item_code = di.item_code 
       AND i.location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
     WHERE dc.audit_session_id = session_id
     AND i.brand = brands.brand
    ) -
    (SELECT COALESCE(SUM(expected_quantity * unit_cost), 0)::DECIMAL
     FROM inventory_items 
     WHERE brand = brands.brand 
     AND location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
    )
  )::DECIMAL as variance_value,
  
  -- Variance percent
  ROUND((
    (
      (SELECT COALESCE(SUM(s.scan_count * i.unit_cost), 0)::DECIMAL
       FROM inventory_items i
       JOIN (
         SELECT barcode, COUNT(*) as scan_count
         FROM scans 
         WHERE audit_session_id = session_id 
         GROUP BY barcode
       ) s ON i.barcode = s.barcode
       WHERE i.brand = brands.brand
       AND i.location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
      ) +
      (SELECT COALESCE(SUM(di.quantity * i.unit_cost), 0)::DECIMAL
       FROM delivery_challans dc
       JOIN dc_items di ON dc.id = di.dc_id
       JOIN inventory_items i ON i.item_code = di.item_code 
         AND i.location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
       WHERE dc.audit_session_id = session_id
       AND i.brand = brands.brand
      ) -
      (SELECT COALESCE(SUM(expected_quantity * unit_cost), 0)::DECIMAL
       FROM inventory_items 
       WHERE brand = brands.brand 
       AND location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
      )
    ) / 
    NULLIF((SELECT COALESCE(SUM(expected_quantity * unit_cost), 0)::DECIMAL
            FROM inventory_items 
            WHERE brand = brands.brand 
            AND location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
           ), 0)
  ) * 100, 2) as variance_percent,
  
  -- Item count: total items for this brand
  (SELECT COUNT(*)::INTEGER
   FROM inventory_items 
   WHERE brand = brands.brand 
   AND location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
  ) as item_count,
  
  -- Scanned count: unique items scanned for this brand
  (SELECT COUNT(DISTINCT i.barcode)::INTEGER
   FROM inventory_items i
   JOIN (
     SELECT barcode
     FROM scans 
     WHERE audit_session_id = session_id 
     GROUP BY barcode
   ) s ON i.barcode = s.barcode
   WHERE i.brand = brands.brand
   AND i.location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
  ) as scanned_count,
  
  -- DC count: items on delivery challans for this brand
  (SELECT COUNT(DISTINCT di.item_code)::INTEGER
   FROM delivery_challans dc
   JOIN dc_items di ON dc.id = di.dc_id
   JOIN inventory_items i ON i.item_code = di.item_code 
     AND i.location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
   WHERE dc.audit_session_id = session_id
   AND i.brand = brands.brand
  ) as dc_count

FROM (
  SELECT DISTINCT brand 
  FROM inventory_items 
  WHERE location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
) brands

ORDER BY 5 DESC -- Order by variance_value column position
LIMIT 20;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Updated widget function (limited to 5 brands)
CREATE OR REPLACE FUNCTION get_live_brand_variance_widget(session_id UUID)
RETURNS TABLE (
  brand TEXT,
  expected_value DECIMAL,
  actual_value DECIMAL,
  dc_value DECIMAL,
  variance_value DECIMAL,
  variance_percent DECIMAL,
  item_count INTEGER,
  scanned_count INTEGER,
  dc_count INTEGER
) AS $$
SELECT * FROM get_live_brand_variance(session_id)
LIMIT 5;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Updated function to get detailed variance with DC support
CREATE OR REPLACE FUNCTION get_brand_detail_variance(session_id UUID, brand_name TEXT)
RETURNS TABLE (
  item_code TEXT,
  barcode TEXT,
  item_name TEXT,
  expected_quantity INTEGER,
  actual_quantity INTEGER,
  dc_quantity INTEGER,
  adjusted_quantity INTEGER,
  variance_quantity INTEGER,
  unit_cost DECIMAL,
  variance_value DECIMAL,
  status TEXT
) AS $$
SELECT 
  i.item_code,
  i.barcode,
  i.item_name,
  i.expected_quantity,
  COALESCE(s.scan_count, 0)::INTEGER as actual_quantity,
  COALESCE(dc.dc_qty, 0)::INTEGER as dc_quantity,
  (COALESCE(s.scan_count, 0) + COALESCE(dc.dc_qty, 0))::INTEGER as adjusted_quantity,
  ((COALESCE(s.scan_count, 0) + COALESCE(dc.dc_qty, 0)) - i.expected_quantity)::INTEGER as variance_quantity,
  i.unit_cost,
  (((COALESCE(s.scan_count, 0) + COALESCE(dc.dc_qty, 0)) - i.expected_quantity) * i.unit_cost)::DECIMAL as variance_value,
  CASE 
    WHEN s.scan_count IS NULL AND dc.dc_qty IS NULL THEN 'Missing'
    WHEN (COALESCE(s.scan_count, 0) + COALESCE(dc.dc_qty, 0)) > i.expected_quantity THEN 'Overage'
    WHEN (COALESCE(s.scan_count, 0) + COALESCE(dc.dc_qty, 0)) < i.expected_quantity THEN 'Shortage'
    ELSE 'Match'
  END as status
FROM inventory_items i
LEFT JOIN (
  SELECT 
    barcode,
    COUNT(*) as scan_count
  FROM scans
  WHERE audit_session_id = session_id
  GROUP BY barcode
) s ON i.barcode = s.barcode
LEFT JOIN (
  SELECT 
    di.item_code,
    SUM(di.quantity) as dc_qty
  FROM delivery_challans dc
  JOIN dc_items di ON dc.id = di.dc_id
  WHERE dc.audit_session_id = session_id
  GROUP BY di.item_code
) dc ON i.item_code = dc.item_code
WHERE i.location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
  AND i.brand = brand_name
ORDER BY ABS(10) DESC; -- Order by variance_value column position
$$ LANGUAGE SQL SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_live_brand_variance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_live_brand_variance_widget(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_brand_detail_variance(UUID, TEXT) TO authenticated;

-- Comments for documentation
COMMENT ON FUNCTION get_live_brand_variance(UUID) IS 'Returns brand-level variance with DC adjustments for active audit session';
COMMENT ON FUNCTION get_brand_detail_variance(UUID, TEXT) IS 'Returns item-level variance details with DC quantities for specific brand';