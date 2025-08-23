-- Delivery Challan (DC) Schema Implementation
-- Purpose: Track items temporarily out of stock during audit

-- Step 1: Modify inventory_items to include barcode
ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS barcode TEXT;

-- Add index for barcode lookups
CREATE INDEX IF NOT EXISTS idx_inventory_items_barcode ON inventory_items(barcode);

-- Update unique constraint to use barcode instead of item_code
ALTER TABLE inventory_items 
DROP CONSTRAINT IF EXISTS inventory_items_location_id_item_code_key;

ALTER TABLE inventory_items 
ADD CONSTRAINT inventory_items_location_id_barcode_key 
UNIQUE(location_id, barcode);

-- Step 2: Create delivery_challans table
CREATE TABLE IF NOT EXISTS delivery_challans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_session_id UUID NOT NULL REFERENCES audit_sessions(id) ON DELETE CASCADE,
  dc_number TEXT NOT NULL,
  dc_date DATE,
  image_urls TEXT[],
  total_items INTEGER DEFAULT 0,
  total_quantity INTEGER DEFAULT 0,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(audit_session_id, dc_number)
);

-- Step 3: Create dc_items table
CREATE TABLE IF NOT EXISTS dc_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dc_id UUID NOT NULL REFERENCES delivery_challans(id) ON DELETE CASCADE,
  item_code TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  mapped_barcodes TEXT[], -- Array of barcodes that map to this item_code
  item_name TEXT,
  brand TEXT,
  unit_cost DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_delivery_challans_session ON delivery_challans(audit_session_id);
CREATE INDEX IF NOT EXISTS idx_delivery_challans_dc_number ON delivery_challans(dc_number);
CREATE INDEX IF NOT EXISTS idx_dc_items_dc_id ON dc_items(dc_id);
CREATE INDEX IF NOT EXISTS idx_dc_items_item_code ON dc_items(item_code);

-- Disable RLS (following existing pattern)
ALTER TABLE delivery_challans DISABLE ROW LEVEL SECURITY;
ALTER TABLE dc_items DISABLE ROW LEVEL SECURITY;

-- Function to map item_code to barcodes
CREATE OR REPLACE FUNCTION map_item_code_to_barcodes(
  p_item_code TEXT,
  p_location_id INTEGER
)
RETURNS TEXT[] AS $$
  SELECT ARRAY_AGG(DISTINCT barcode)
  FROM inventory_items
  WHERE item_code = p_item_code
    AND location_id = p_location_id
    AND barcode IS NOT NULL;
$$ LANGUAGE SQL;

-- Function to get DC summary for a session
CREATE OR REPLACE FUNCTION get_dc_summary(p_session_id UUID)
RETURNS TABLE (
  total_dcs INTEGER,
  total_items INTEGER,
  total_quantity INTEGER,
  total_value DECIMAL
) AS $$
  SELECT 
    COUNT(DISTINCT dc.id)::INTEGER as total_dcs,
    COUNT(DISTINCT di.id)::INTEGER as total_items,
    COALESCE(SUM(di.quantity), 0)::INTEGER as total_quantity,
    COALESCE(SUM(di.quantity * di.unit_cost), 0)::DECIMAL as total_value
  FROM delivery_challans dc
  LEFT JOIN dc_items di ON dc.id = di.dc_id
  WHERE dc.audit_session_id = p_session_id;
$$ LANGUAGE SQL;

-- Function to get DC adjustment for variance calculation
CREATE OR REPLACE FUNCTION get_dc_quantity_for_barcode(
  p_session_id UUID,
  p_barcode TEXT
)
RETURNS INTEGER AS $$
  SELECT COALESCE(SUM(di.quantity), 0)::INTEGER
  FROM delivery_challans dc
  JOIN dc_items di ON dc.id = di.dc_id
  WHERE dc.audit_session_id = p_session_id
    AND p_barcode = ANY(di.mapped_barcodes);
$$ LANGUAGE SQL;

-- Grant permissions
GRANT ALL ON delivery_challans TO authenticated;
GRANT ALL ON dc_items TO authenticated;
GRANT EXECUTE ON FUNCTION map_item_code_to_barcodes(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dc_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dc_quantity_for_barcode(UUID, TEXT) TO authenticated;

-- Comments for documentation
COMMENT ON TABLE delivery_challans IS 'Tracks delivery challans (DC) for items temporarily out of stock during audit';
COMMENT ON TABLE dc_items IS 'Individual items on a delivery challan with quantity and barcode mapping';
COMMENT ON COLUMN dc_items.mapped_barcodes IS 'Array of all barcodes that correspond to this item_code';
COMMENT ON FUNCTION get_dc_quantity_for_barcode IS 'Returns total DC quantity for a specific barcode in an audit session';