-- Simple test for date-based barcodes
-- Just update one session to test the syntax

-- Clear existing barcodes first
UPDATE racks SET barcode = NULL WHERE audit_session_id = '95fe6eaf-3cd6-4337-907e-f9c20f13afea';

-- Test date-based barcode generation for one session
WITH numbered_racks AS (
  SELECT 
    id,
    TO_CHAR(NOW(), 'DDMM') || '-' || LPAD(
      ROW_NUMBER() OVER (ORDER BY rack_number)::text, 
      3, 
      '0'
    ) as new_barcode
  FROM racks
  WHERE audit_session_id = '95fe6eaf-3cd6-4337-907e-f9c20f13afea'
)
UPDATE racks 
SET barcode = nr.new_barcode
FROM numbered_racks nr
WHERE racks.id = nr.id;