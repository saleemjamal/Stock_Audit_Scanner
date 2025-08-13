-- Add ready_at column to racks table
-- This tracks when a rack was marked as ready for approval

ALTER TABLE racks 
ADD COLUMN IF NOT EXISTS ready_at TIMESTAMP WITH TIME ZONE;

-- Update existing ready_for_approval racks to have ready_at as their updated_at time
UPDATE racks 
SET ready_at = updated_at 
WHERE status = 'ready_for_approval' AND ready_at IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN racks.ready_at IS 'Timestamp when the rack was marked as ready for approval';