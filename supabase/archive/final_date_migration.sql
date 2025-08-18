-- Final date-based barcode migration - Remove unique constraint
-- Format: DDMM-### (e.g., 1808-001, 1808-002, 1808-003)

-- 1. Drop unique constraint if it exists
ALTER TABLE racks DROP CONSTRAINT IF EXISTS racks_barcode_unique;

-- 2. Clear existing barcodes
UPDATE racks SET barcode = NULL;

-- 3. Create temporary table with numbered rows
CREATE TEMP TABLE rack_numbers AS
SELECT 
  id,
  TO_CHAR(NOW(), 'DDMM') || '-' || LPAD(
    ROW_NUMBER() OVER (PARTITION BY audit_session_id ORDER BY rack_number)::text, 
    3, 
    '0'
  ) as new_barcode
FROM racks;

-- 4. Update racks table from temporary table
UPDATE racks 
SET barcode = rn.new_barcode
FROM rack_numbers rn
WHERE racks.id = rn.id;

-- 5. Drop temporary table
DROP TABLE rack_numbers;

-- 6. Create index for fast barcode lookups (non-unique)
CREATE INDEX IF NOT EXISTS idx_racks_barcode ON racks(barcode);

-- Rest of functions remain the same...
-- (copying from working_date_migration.sql)

-- 7. Update validation function for new barcode format
CREATE OR REPLACE FUNCTION validate_rack_barcode(
  p_barcode VARCHAR,
  p_audit_session_id UUID,
  p_scanner_id UUID
) RETURNS JSON AS $$
DECLARE
  rack_record RECORD;
BEGIN
  -- Check if barcode format is valid (DDMM-### pattern)
  IF p_barcode !~ '^[0-9]{4}-[0-9]{3}$' THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Invalid barcode format. Expected format: DDMM-### (e.g., 1808-001)',
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

  -- Check if rack is available or rejectable by this scanner
  IF rack_record.status NOT IN ('available', 'rejected') THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Rack is currently assigned to another scanner',
      'code', 'RACK_UNAVAILABLE',
      'assigned_to', rack_record.scanner_id
    );
  END IF;
  
  -- If rejected, must be owned by this scanner
  IF rack_record.status = 'rejected' AND rack_record.scanner_id != p_scanner_id THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'This rejected rack belongs to another scanner',
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

-- 8. Create function to assign rack to scanner after successful barcode scan
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

-- 9. Update barcode generation function for new sessions
CREATE OR REPLACE FUNCTION generate_rack_barcodes(p_audit_session_id UUID)
RETURNS INTEGER AS $$
DECLARE
  rack_count INTEGER := 0;
  date_prefix VARCHAR;
  max_sequence INTEGER;
BEGIN
  -- Get today's date prefix
  date_prefix := TO_CHAR(NOW(), 'DDMM');
  
  -- Find the highest sequence number for today's date in this session
  SELECT COALESCE(
    MAX(SUBSTRING(barcode, 6)::INTEGER), 
    0
  ) INTO max_sequence
  FROM racks 
  WHERE audit_session_id = p_audit_session_id 
    AND barcode LIKE date_prefix || '-%';
  
  -- Create temp table for new racks
  CREATE TEMP TABLE new_rack_numbers AS
  SELECT 
    id,
    date_prefix || '-' || LPAD(
      (max_sequence + ROW_NUMBER() OVER (ORDER BY rack_number))::text, 
      3, 
      '0'
    ) as new_barcode
  FROM racks
  WHERE audit_session_id = p_audit_session_id 
    AND (barcode IS NULL OR barcode = '');
  
  -- Update from temp table
  UPDATE racks 
  SET barcode = nrn.new_barcode
  FROM new_rack_numbers nrn
  WHERE racks.id = nrn.id;
  
  -- Get count and cleanup
  GET DIAGNOSTICS rack_count = ROW_COUNT;
  DROP TABLE new_rack_numbers;
  
  RETURN rack_count;
END;
$$ LANGUAGE plpgsql;

-- 10. Grant necessary permissions
GRANT EXECUTE ON FUNCTION validate_rack_barcode(VARCHAR, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_rack_to_scanner(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_rack_barcodes(UUID) TO authenticated;

-- Migration complete!
-- Now allows duplicate barcodes across sessions, sequential per session