-- Add shortname column to audit_sessions table
ALTER TABLE audit_sessions ADD COLUMN shortname VARCHAR(20);

-- Create function to generate shortname based on location and date
CREATE OR REPLACE FUNCTION generate_audit_shortname(location_id_param INTEGER, session_date TIMESTAMP WITH TIME ZONE)
RETURNS VARCHAR(20) AS $$
DECLARE
    location_code VARCHAR(5);
    date_suffix VARCHAR(10);
    shortname VARCHAR(20);
BEGIN
    -- Get location code (first 2 chars of location name, uppercase)
    SELECT UPPER(LEFT(REGEXP_REPLACE(name, '[^A-Za-z0-9]', '', 'g'), 2))
    INTO location_code
    FROM locations 
    WHERE id = location_id_param;
    
    -- Generate date suffix (YYMMDD format)
    date_suffix := TO_CHAR(session_date, 'YYMMDD');
    
    -- Combine location code and date
    shortname := location_code || date_suffix;
    
    RETURN shortname;
END;
$$ LANGUAGE plpgsql;

-- Update existing audit sessions with shortnames
UPDATE audit_sessions 
SET shortname = generate_audit_shortname(location_id, started_at)
WHERE shortname IS NULL;

-- Add constraint to make shortname required for new sessions
ALTER TABLE audit_sessions ALTER COLUMN shortname SET NOT NULL;