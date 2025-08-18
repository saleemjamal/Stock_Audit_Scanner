-- Fix missing client_scan_id column that DirectApiSink expects
-- This resolves SQL errors when scanning

ALTER TABLE scans ADD COLUMN client_scan_id UUID UNIQUE;

-- Add index for better performance on upserts
CREATE INDEX IF NOT EXISTS idx_scans_client_scan_id ON scans(client_scan_id);

-- Add comment for clarity
COMMENT ON COLUMN scans.client_scan_id IS 'Client-generated UUID for idempotency and deduplication during uploads';