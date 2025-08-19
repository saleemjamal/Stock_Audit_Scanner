-- Brand Variance Reporting - Database Schema
-- Phase 1: Create inventory_items table and variance calculation functions

-- Create inventory items table
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  item_code TEXT NOT NULL,  -- 5-digit code extracted from barcode
  brand TEXT NOT NULL,
  item_name TEXT NOT NULL,
  expected_quantity INTEGER NOT NULL DEFAULT 0,
  unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, item_code)
);

-- Indexes for performance
CREATE INDEX idx_inventory_items_location ON inventory_items(location_id);
CREATE INDEX idx_inventory_items_item_code ON inventory_items(item_code);
CREATE INDEX idx_inventory_items_brand ON inventory_items(brand);

-- Disable RLS (following existing system patterns)
ALTER TABLE inventory_items DISABLE ROW LEVEL SECURITY;

-- Function to get live brand variance for a session
CREATE OR REPLACE FUNCTION get_live_brand_variance(session_id UUID)
RETURNS TABLE (
  brand TEXT,
  expected_value DECIMAL,
  actual_value DECIMAL,
  variance_value DECIMAL,
  variance_percent DECIMAL,
  item_count INTEGER,
  scanned_count INTEGER
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
  (SELECT COALESCE(SUM(scan_counts.scan_count * i.unit_cost), 0)::DECIMAL
   FROM inventory_items i
   JOIN (
     SELECT SUBSTRING(barcode, 1, 5) as item_code, COUNT(*) as scan_count
     FROM scans 
     WHERE audit_session_id = session_id 
     GROUP BY SUBSTRING(barcode, 1, 5)
   ) scan_counts ON i.item_code = scan_counts.item_code
   WHERE i.brand = brands.brand
   AND i.location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
  ) as actual_value,
  
  -- Variance value
  ((SELECT COALESCE(SUM(scan_counts.scan_count * i.unit_cost), 0)::DECIMAL
    FROM inventory_items i
    JOIN (
      SELECT SUBSTRING(barcode, 1, 5) as item_code, COUNT(*) as scan_count
      FROM scans 
      WHERE audit_session_id = session_id 
      GROUP BY SUBSTRING(barcode, 1, 5)
    ) scan_counts ON i.item_code = scan_counts.item_code
    WHERE i.brand = brands.brand
    AND i.location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
   ) - 
   (SELECT COALESCE(SUM(expected_quantity * unit_cost), 0)::DECIMAL
    FROM inventory_items 
    WHERE brand = brands.brand 
    AND location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
   ))::DECIMAL as variance_value,
  
  -- Variance percent
  ROUND((
    ((SELECT COALESCE(SUM(scan_counts.scan_count * i.unit_cost), 0)::DECIMAL
      FROM inventory_items i
      JOIN (
        SELECT SUBSTRING(barcode, 1, 5) as item_code, COUNT(*) as scan_count
        FROM scans 
        WHERE audit_session_id = session_id 
        GROUP BY SUBSTRING(barcode, 1, 5)
      ) scan_counts ON i.item_code = scan_counts.item_code
      WHERE i.brand = brands.brand
      AND i.location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
     ) - 
     (SELECT COALESCE(SUM(expected_quantity * unit_cost), 0)::DECIMAL
      FROM inventory_items 
      WHERE brand = brands.brand 
      AND location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
     )) / 
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
  (SELECT COUNT(DISTINCT i.item_code)::INTEGER
   FROM inventory_items i
   JOIN (
     SELECT SUBSTRING(barcode, 1, 5) as item_code
     FROM scans 
     WHERE audit_session_id = session_id 
     GROUP BY SUBSTRING(barcode, 1, 5)
   ) scan_counts ON i.item_code = scan_counts.item_code
   WHERE i.brand = brands.brand
   AND i.location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
  ) as scanned_count

FROM (
  SELECT DISTINCT brand 
  FROM inventory_items 
  WHERE location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
) brands

ORDER BY ABS(
  (SELECT COALESCE(SUM(scan_counts.scan_count * i.unit_cost), 0)::DECIMAL
   FROM inventory_items i
   JOIN (
     SELECT SUBSTRING(barcode, 1, 5) as item_code, COUNT(*) as scan_count
     FROM scans 
     WHERE audit_session_id = session_id 
     GROUP BY SUBSTRING(barcode, 1, 5)
   ) scan_counts ON i.item_code = scan_counts.item_code
   WHERE i.brand = brands.brand
   AND i.location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
  ) - 
  (SELECT COALESCE(SUM(expected_quantity * unit_cost), 0)::DECIMAL
   FROM inventory_items 
   WHERE brand = brands.brand 
   AND location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
  )
) DESC
LIMIT 20;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Function to get live brand variance for dashboard widget (limited to 5 brands)
CREATE OR REPLACE FUNCTION get_live_brand_variance_widget(session_id UUID)
RETURNS TABLE (
  brand TEXT,
  expected_value DECIMAL,
  actual_value DECIMAL,
  variance_value DECIMAL,
  variance_percent DECIMAL,
  item_count INTEGER,
  scanned_count INTEGER
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
  (SELECT COALESCE(SUM(scan_counts.scan_count * i.unit_cost), 0)::DECIMAL
   FROM inventory_items i
   JOIN (
     SELECT SUBSTRING(barcode, 1, 5) as item_code, COUNT(*) as scan_count
     FROM scans 
     WHERE audit_session_id = session_id 
     GROUP BY SUBSTRING(barcode, 1, 5)
   ) scan_counts ON i.item_code = scan_counts.item_code
   WHERE i.brand = brands.brand
   AND i.location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
  ) as actual_value,
  
  -- Variance value
  ((SELECT COALESCE(SUM(scan_counts.scan_count * i.unit_cost), 0)::DECIMAL
    FROM inventory_items i
    JOIN (
      SELECT SUBSTRING(barcode, 1, 5) as item_code, COUNT(*) as scan_count
      FROM scans 
      WHERE audit_session_id = session_id 
      GROUP BY SUBSTRING(barcode, 1, 5)
    ) scan_counts ON i.item_code = scan_counts.item_code
    WHERE i.brand = brands.brand
    AND i.location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
   ) - 
   (SELECT COALESCE(SUM(expected_quantity * unit_cost), 0)::DECIMAL
    FROM inventory_items 
    WHERE brand = brands.brand 
    AND location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
   ))::DECIMAL as variance_value,
  
  -- Variance percent
  ROUND((
    ((SELECT COALESCE(SUM(scan_counts.scan_count * i.unit_cost), 0)::DECIMAL
      FROM inventory_items i
      JOIN (
        SELECT SUBSTRING(barcode, 1, 5) as item_code, COUNT(*) as scan_count
        FROM scans 
        WHERE audit_session_id = session_id 
        GROUP BY SUBSTRING(barcode, 1, 5)
      ) scan_counts ON i.item_code = scan_counts.item_code
      WHERE i.brand = brands.brand
      AND i.location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
     ) - 
     (SELECT COALESCE(SUM(expected_quantity * unit_cost), 0)::DECIMAL
      FROM inventory_items 
      WHERE brand = brands.brand 
      AND location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
     )) / 
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
  (SELECT COUNT(DISTINCT i.item_code)::INTEGER
   FROM inventory_items i
   JOIN (
     SELECT SUBSTRING(barcode, 1, 5) as item_code
     FROM scans 
     WHERE audit_session_id = session_id 
     GROUP BY SUBSTRING(barcode, 1, 5)
   ) scan_counts ON i.item_code = scan_counts.item_code
   WHERE i.brand = brands.brand
   AND i.location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
  ) as scanned_count

FROM (
  SELECT DISTINCT brand 
  FROM inventory_items 
  WHERE location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
) brands

ORDER BY ABS(
  (SELECT COALESCE(SUM(scan_counts.scan_count * i.unit_cost), 0)::DECIMAL
   FROM inventory_items i
   JOIN (
     SELECT SUBSTRING(barcode, 1, 5) as item_code, COUNT(*) as scan_count
     FROM scans 
     WHERE audit_session_id = session_id 
     GROUP BY SUBSTRING(barcode, 1, 5)
   ) scan_counts ON i.item_code = scan_counts.item_code
   WHERE i.brand = brands.brand
   AND i.location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
  ) - 
  (SELECT COALESCE(SUM(expected_quantity * unit_cost), 0)::DECIMAL
   FROM inventory_items 
   WHERE brand = brands.brand 
   AND location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
  )
) DESC
LIMIT 5;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Function to get detailed variance for a specific brand
CREATE OR REPLACE FUNCTION get_brand_detail_variance(session_id UUID, brand_name TEXT)
RETURNS TABLE (
  item_code TEXT,
  item_name TEXT,
  expected_quantity INTEGER,
  actual_quantity INTEGER,
  variance_quantity INTEGER,
  unit_cost DECIMAL,
  variance_value DECIMAL,
  status TEXT
) AS $$
SELECT 
  i.item_code,
  i.item_name,
  i.expected_quantity,
  COALESCE(s.scan_count, 0)::INTEGER as actual_quantity,
  (COALESCE(s.scan_count, 0) - i.expected_quantity)::INTEGER as variance_quantity,
  i.unit_cost,
  ((COALESCE(s.scan_count, 0) - i.expected_quantity) * i.unit_cost)::DECIMAL as variance_value,
  CASE 
    WHEN s.scan_count IS NULL THEN 'Missing'
    WHEN s.scan_count > i.expected_quantity THEN 'Overage'
    WHEN s.scan_count < i.expected_quantity THEN 'Shortage'
    ELSE 'Match'
  END as status
FROM inventory_items i
LEFT JOIN (
  SELECT 
    SUBSTRING(barcode, 1, 5) as item_code,
    COUNT(*) as scan_count
  FROM scans
  WHERE audit_session_id = session_id
  GROUP BY SUBSTRING(barcode, 1, 5)
) s ON i.item_code = s.item_code
WHERE i.location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
  AND i.brand = brand_name
ORDER BY ABS((COALESCE(s.scan_count, 0) - i.expected_quantity) * i.unit_cost) DESC;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_live_brand_variance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_live_brand_variance_widget(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_brand_detail_variance(UUID, TEXT) TO authenticated;

-- Comments for documentation
COMMENT ON TABLE inventory_items IS 'Expected inventory items for variance reporting by brand';
COMMENT ON COLUMN inventory_items.item_code IS '5-digit item code extracted from barcode prefix';
COMMENT ON COLUMN inventory_items.brand IS 'Brand name for grouping variance calculations';
COMMENT ON COLUMN inventory_items.expected_quantity IS 'Expected quantity for this item at this location';
COMMENT ON COLUMN inventory_items.unit_cost IS 'Unit cost in INR for variance value calculations';
COMMENT ON FUNCTION get_live_brand_variance(UUID) IS 'Returns brand-level variance summary for active audit session';
COMMENT ON FUNCTION get_brand_detail_variance(UUID, TEXT) IS 'Returns item-level variance details for specific brand';