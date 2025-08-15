-- Add barcode column to racks table and create validation function
-- Migration: Add Rack Barcode Support

-- 1. Add barcode column to racks table
ALTER TABLE racks ADD COLUMN IF NOT EXISTS barcode VARCHAR(20) UNIQUE;

-- 2. Generate barcodes for existing racks (RACK001, RACK002, etc.)
UPDATE racks 
SET barcode = 'RACK' || LPAD(rack_number::text, 3, '0')
WHERE barcode IS NULL;

-- 3. Create index for fast barcode lookups
CREATE INDEX IF NOT EXISTS idx_racks_barcode ON racks(barcode);

-- 4. Create validation function for rack barcode scanning
CREATE OR REPLACE FUNCTION validate_rack_barcode(
  p_barcode VARCHAR,
  p_audit_session_id UUID,
  p_scanner_id UUID
) RETURNS JSON AS $$
DECLARE
  rack_record RECORD;
  result JSON;
BEGIN
  -- Check if barcode format is valid (RACK### pattern)
  IF p_barcode !~ '^RACK[0-9]{3}$' THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Invalid barcode format. Expected format: RACK001',
      'code', 'INVALID_FORMAT'
    );
  END IF;

  -- Find rack with this barcode in the specified session
  SELECT r.*, l.name as location_name
  INTO rack_record
  FROM racks r
  JOIN audit_sessions a ON r.audit_session_id = a.id
  JOIN locations l ON a.location_id = l.id
  WHERE r.barcode = p_barcode 
    AND r.audit_session_id = p_audit_session_id;

  -- Check if rack exists in this session
  IF NOT FOUND THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Rack not found in current audit session',
      'code', 'RACK_NOT_FOUND'
    );
  END IF;

  -- Check if rack is available (not assigned to another scanner)
  IF rack_record.status != 'available' AND rack_record.scanner_id != p_scanner_id THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Rack is already assigned to another scanner',
      'code', 'RACK_UNAVAILABLE',
      'assigned_to', rack_record.scanner_id
    );
  END IF;

  -- Return success with rack information
  RETURN json_build_object(
    'valid', true,
    'rack', json_build_object(
      'id', rack_record.id,
      'rack_number', rack_record.rack_number,
      'barcode', rack_record.barcode,
      'status', rack_record.status,
      'location_name', rack_record.location_name,
      'audit_session_id', rack_record.audit_session_id
    )
  );
END;
$$ LANGUAGE plpgsql;

-- 5. Create function to assign rack to scanner after successful barcode scan
CREATE OR REPLACE FUNCTION assign_rack_to_scanner(
  p_rack_id UUID,
  p_scanner_id UUID
) RETURNS JSON AS $$
DECLARE
  updated_rack RECORD;
BEGIN
  -- Update rack status and assign to scanner
  UPDATE racks 
  SET 
    status = 'assigned',
    scanner_id = p_scanner_id,
    assigned_at = NOW()
  WHERE id = p_rack_id
    AND (status = 'available' OR scanner_id = p_scanner_id)
  RETURNING * INTO updated_rack;

  -- Check if update was successful
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Failed to assign rack - may already be assigned to another scanner'
    );
  END IF;

  -- Return success with updated rack info
  RETURN json_build_object(
    'success', true,
    'rack', json_build_object(
      'id', updated_rack.id,
      'rack_number', updated_rack.rack_number,
      'barcode', updated_rack.barcode,
      'status', updated_rack.status,
      'assigned_at', updated_rack.assigned_at
    )
  );
END;
$$ LANGUAGE plpgsql;

-- 6. Add barcode generation function for new sessions
CREATE OR REPLACE FUNCTION generate_rack_barcodes(p_audit_session_id UUID)
RETURNS INTEGER AS $$
DECLARE
  rack_count INTEGER := 0;
BEGIN
  -- Update any racks without barcodes in this session
  UPDATE racks 
  SET barcode = 'RACK' || LPAD(rack_number::text, 3, '0')
  WHERE audit_session_id = p_audit_session_id 
    AND barcode IS NULL;
    
  GET DIAGNOSTICS rack_count = ROW_COUNT;
  
  RETURN rack_count;
END;
$$ LANGUAGE plpgsql;

-- 7. Create view for barcode printing/export
CREATE OR REPLACE VIEW rack_barcodes_for_printing AS
SELECT 
  a.id as session_id,
  l.name as location_name,
  a.shortname as session_shortname,
  r.id as rack_id,
  r.rack_number,
  r.barcode,
  CONCAT(a.shortname, '-', LPAD(r.rack_number::text, 3, '0')) as display_name
FROM racks r
JOIN audit_sessions a ON r.audit_session_id = a.id
JOIN locations l ON a.location_id = l.id
WHERE a.status = 'active'
  AND r.barcode IS NOT NULL
ORDER BY l.name, r.rack_number;

-- 8. Grant necessary permissions
-- Note: Adjust these based on your RLS policies
GRANT EXECUTE ON FUNCTION validate_rack_barcode(VARCHAR, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_rack_to_scanner(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_rack_barcodes(UUID) TO authenticated;
GRANT SELECT ON rack_barcodes_for_printing TO authenticated;

-- Migration complete
-- Next steps:
-- 1. Run this migration in Supabase SQL Editor
-- 2. Test barcode validation function
-- 3. Generate physical barcode labels
-- 4. Update mobile app to use barcode scanning