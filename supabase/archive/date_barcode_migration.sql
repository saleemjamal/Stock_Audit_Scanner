-- Date-based barcode migration: DDMM-### format
-- Example: 1808-001, 1808-002, 1808-003 (Aug 18th)

-- 1. Clear existing barcodes to avoid conflicts
UPDATE racks SET barcode = NULL;

-- 2. Generate date-based sequential barcodes per session
-- Format: DDMM-001, DDMM-002, etc. (today's date + sequential number)
-- Since only one session per day, this will be naturally unique
WITH numbered_racks AS (
  SELECT 
    id,
    TO_CHAR(NOW(), 'DDMM') || '-' || LPAD(
      ROW_NUMBER() OVER (PARTITION BY audit_session_id ORDER BY rack_number)::text, 
      3, 
      '0'
    ) as new_barcode
  FROM racks
)
UPDATE racks 
SET barcode = nr.new_barcode
FROM numbered_racks nr
WHERE racks.id = nr.id;

-- 3. Create index for fast barcode lookups
CREATE INDEX IF NOT EXISTS idx_racks_barcode ON racks(barcode);

-- 4. Update validation function for new barcode format
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
  -- Allow: available racks, or rejected racks that belong to this scanner
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

-- 6. Update barcode generation function for new sessions
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
  
  -- Update any racks without barcodes in this session
  WITH numbered_racks AS (
    SELECT 
      id,
      date_prefix || '-' || LPAD(
        (max_sequence + ROW_NUMBER() OVER (ORDER BY rack_number))::text, 
        3, 
        '0'
      ) as new_barcode
    FROM racks
    WHERE audit_session_id = p_audit_session_id 
      AND (barcode IS NULL OR barcode = '')
  )
  UPDATE racks 
  SET barcode = nr.new_barcode
  FROM numbered_racks nr
  WHERE racks.id = nr.id;
    
  GET DIAGNOSTICS rack_count = ROW_COUNT;
  
  RETURN rack_count;
END;
$$ LANGUAGE plpgsql;

-- 7. Grant necessary permissions
GRANT EXECUTE ON FUNCTION validate_rack_barcode(VARCHAR, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_rack_to_scanner(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_rack_barcodes(UUID) TO authenticated;

-- Migration complete!
-- Barcodes will now be: 1808-001, 1808-002, 1808-003 (for Aug 18th)
-- Format: DDMM-### where DDMM is today's date and ### is sequential per session