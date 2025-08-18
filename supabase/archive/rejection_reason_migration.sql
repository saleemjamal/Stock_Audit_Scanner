-- Migration: Optimize racks table for rejection workflow
-- Run this in Supabase SQL Editor

-- The rejection columns already exist:
-- - rejection_reason TEXT
-- - rejected_by TEXT  
-- - rejected_at TIMESTAMPTZ

-- Add index for better query performance on status and scanner_id
CREATE INDEX IF NOT EXISTS idx_racks_status_scanner ON racks(status, scanner_id);

-- Verify the existing columns
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'racks' AND column_name IN ('rejection_reason', 'rejected_by', 'rejected_at')
ORDER BY column_name;

-- Show any existing rejected racks
SELECT id, rack_number, status, rejection_reason, rejected_by, scanner_id
FROM racks 
WHERE status = 'rejected';