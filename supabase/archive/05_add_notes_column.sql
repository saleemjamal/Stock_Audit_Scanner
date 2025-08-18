-- Add notes column to audit_sessions table
-- This allows supervisors to add instructions for scanners when creating a session

ALTER TABLE audit_sessions 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN audit_sessions.notes IS 'Optional instructions or notes for scanners working on this audit session';