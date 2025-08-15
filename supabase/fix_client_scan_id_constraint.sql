-- Fix client_scan_id unique constraint to prevent duplicate scan entries
-- This ensures the upsert deduplication works properly

-- First, check if constraint already exists
DO $$
BEGIN
    -- Remove any existing constraint with this name
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'scans_client_scan_id_unique' 
        AND table_name = 'scans'
    ) THEN
        ALTER TABLE scans DROP CONSTRAINT scans_client_scan_id_unique;
    END IF;
END $$;

-- Clean up any null client_scan_id values first
UPDATE scans 
SET client_scan_id = 'legacy-' || id::text 
WHERE client_scan_id IS NULL OR client_scan_id = '';

-- Now add the unique constraint
ALTER TABLE scans ADD CONSTRAINT scans_client_scan_id_unique UNIQUE (client_scan_id);

-- Verify the constraint was added
SELECT 
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint 
WHERE conname = 'scans_client_scan_id_unique';

-- Show any existing duplicates that need manual cleanup
SELECT 
    client_scan_id, 
    COUNT(*) as duplicate_count,
    array_agg(id) as scan_ids
FROM scans 
WHERE client_scan_id IS NOT NULL
GROUP BY client_scan_id 
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;