-- Final fix: Make barcodes session-specific but globally unique
-- Format: SESSION_ID-RACK001, SESSION_ID-RACK002, etc.

-- 1. Clear existing barcodes to avoid conflicts
UPDATE racks SET barcode = NULL;

-- 2. Generate session-specific sequential barcodes
-- Each session gets: <SESSION_SHORT>-RACK001, <SESSION_SHORT>-RACK002, etc.
WITH numbered_racks AS (
  SELECT 
    r.id,
    COALESCE(a.shortname, 'SES') as session_prefix,
    ROW_NUMBER() OVER (PARTITION BY r.audit_session_id ORDER BY r.rack_number) as row_num
  FROM racks r
  JOIN audit_sessions a ON r.audit_session_id = a.id
)
UPDATE racks 
SET barcode = nr.session_prefix || '-RACK' || LPAD(nr.row_num::text, 3, '0')
FROM numbered_racks nr
WHERE racks.id = nr.id;

-- 3. Update validation function to handle new barcode format
CREATE OR REPLACE FUNCTION validate_rack_barcode(
  p_barcode VARCHAR,
  p_audit_session_id UUID,
  p_scanner_id UUID
) RETURNS JSON AS $$
DECLARE
  rack_record RECORD;
  session_record RECORD;
BEGIN
  -- Get session info for barcode validation
  SELECT shortname INTO session_record
  FROM audit_sessions 
  WHERE id = p_audit_session_id;
  
  -- Check if barcode format is valid for this session
  -- Expected format: SESSION-RACK### (e.g., SES1-RACK001)
  IF p_barcode !~ ('^' || COALESCE(session_record.shortname, 'SES') || '-RACK[0-9]{3}$') THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Invalid barcode format. Expected: ' || COALESCE(session_record.shortname, 'SES') || '-RACK###',
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

-- 4. Update barcode generation function for new sessions
CREATE OR REPLACE FUNCTION generate_rack_barcodes(p_audit_session_id UUID)
RETURNS INTEGER AS $$
DECLARE
  rack_count INTEGER := 0;
  session_prefix VARCHAR;
BEGIN
  -- Get session prefix
  SELECT COALESCE(shortname, 'SES') INTO session_prefix
  FROM audit_sessions 
  WHERE id = p_audit_session_id;
  
  -- Update any racks without barcodes in this session
  WITH numbered_racks AS (
    SELECT 
      id,
      (COALESCE(
        (SELECT MAX(SUBSTRING(barcode, LENGTH(session_prefix || '-RACK') + 1)::INTEGER) 
         FROM racks 
         WHERE audit_session_id = p_audit_session_id 
           AND barcode LIKE session_prefix || '-RACK%'), 
        0
      ) + ROW_NUMBER() OVER (ORDER BY rack_number)) as row_num
    FROM racks
    WHERE audit_session_id = p_audit_session_id 
      AND (barcode IS NULL OR barcode = '')
  )
  UPDATE racks 
  SET barcode = session_prefix || '-RACK' || LPAD(nr.row_num::text, 3, '0')
  FROM numbered_racks nr
  WHERE racks.id = nr.id;
    
  GET DIAGNOSTICS rack_count = ROW_COUNT;
  
  RETURN rack_count;
END;
$$ LANGUAGE plpgsql;

-- 5. Grant necessary permissions
GRANT EXECUTE ON FUNCTION validate_rack_barcode(VARCHAR, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_rack_to_scanner(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_rack_barcodes(UUID) TO authenticated;

-- Migration complete!
-- Barcodes will now be: SESSION-RACK001, SESSION-RACK002, etc.
-- Each session gets sequential numbering but globally unique barcodes