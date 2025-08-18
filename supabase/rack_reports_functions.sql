-- Rack Reports Functions
-- Functions to support rack-specific reporting in the dashboard
-- Created: August 18, 2025

-- Function 1: Get Sessions for Report Dropdown
-- Returns all audit sessions (active + completed) with summary stats
CREATE OR REPLACE FUNCTION get_sessions_for_reports()
RETURNS TABLE (
  session_id uuid,
  shortname varchar,
  location_name varchar,
  status audit_status,
  started_at timestamptz,
  completed_at timestamptz,
  total_racks bigint,
  total_scans bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id as session_id,
    a.shortname,
    l.name as location_name,
    a.status,
    a.started_at,
    a.completed_at,
    COALESCE(rack_counts.total_racks, 0) as total_racks,
    COALESCE(scan_counts.total_scans, 0) as total_scans
  FROM audit_sessions a
  INNER JOIN locations l ON l.id = a.location_id
  LEFT JOIN (
    SELECT 
      r.audit_session_id,
      COUNT(*) as total_racks
    FROM racks r
    GROUP BY r.audit_session_id
  ) rack_counts ON rack_counts.audit_session_id = a.id
  LEFT JOIN (
    SELECT 
      s.audit_session_id,
      COUNT(*) as total_scans
    FROM scans s
    GROUP BY s.audit_session_id
  ) scan_counts ON scan_counts.audit_session_id = a.id
  ORDER BY 
    CASE WHEN a.status = 'active' THEN 0 ELSE 1 END,
    a.started_at DESC;
END;
$$;

-- Function 2: Get Racks by Session with Status Filtering
-- Returns racks in a session with optional active rack inclusion
CREATE OR REPLACE FUNCTION get_racks_by_session(
  p_session_id uuid,
  p_include_active boolean DEFAULT false
)
RETURNS TABLE (
  rack_id uuid,
  rack_number varchar,
  barcode varchar,
  status rack_status,
  scanner_name varchar,
  scanner_username varchar,
  scan_count bigint,
  assigned_at timestamptz,
  completed_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id as rack_id,
    r.rack_number,
    r.barcode,
    r.status,
    COALESCE(u.full_name, u.username) as scanner_name,
    u.username as scanner_username,
    COALESCE(scan_counts.scan_count, 0) as scan_count,
    r.assigned_at,
    r.completed_at,
    r.approved_at,
    r.rejected_at,
    r.rejection_reason
  FROM racks r
  LEFT JOIN users u ON u.id = r.scanner_id
  LEFT JOIN (
    SELECT 
      s.rack_id,
      COUNT(*) as scan_count
    FROM scans s
    GROUP BY s.rack_id
  ) scan_counts ON scan_counts.rack_id = r.id
  WHERE r.audit_session_id = p_session_id
    AND (p_include_active = true OR r.status != 'assigned')
  ORDER BY r.rack_number::integer;
END;
$$;

-- Function 3: Get Complete Rack Export Data
-- Returns all data needed for rack CSV export
CREATE OR REPLACE FUNCTION get_rack_export_data(p_rack_id uuid)
RETURNS TABLE (
  -- Rack header info
  rack_number varchar,
  barcode varchar,
  location_name varchar,
  session_shortname varchar,
  scanner_name varchar,
  scanner_username varchar,
  status rack_status,
  assigned_at timestamptz,
  completed_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  scan_count bigint,
  -- Individual scans
  scan_barcode varchar,
  scanned_at timestamptz,
  manual_entry boolean,
  scan_notes text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.rack_number,
    r.barcode,
    l.name as location_name,
    a.shortname as session_shortname,
    COALESCE(u.full_name, u.username) as scanner_name,
    u.username as scanner_username,
    r.status,
    r.assigned_at,
    r.completed_at,
    r.approved_at,
    r.rejected_at,
    r.rejection_reason,
    COUNT(s.id) OVER() as scan_count,
    s.barcode as scan_barcode,
    s.scanned_at,
    s.manual_entry,
    s.notes as scan_notes
  FROM racks r
  INNER JOIN audit_sessions a ON a.id = r.audit_session_id
  INNER JOIN locations l ON l.id = r.location_id
  LEFT JOIN users u ON u.id = r.scanner_id
  LEFT JOIN scans s ON s.rack_id = r.id
  WHERE r.id = p_rack_id
  ORDER BY s.scanned_at;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_sessions_for_reports() TO authenticated;
GRANT EXECUTE ON FUNCTION get_racks_by_session(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION get_rack_export_data(uuid) TO authenticated;

-- Comments for documentation
COMMENT ON FUNCTION get_sessions_for_reports() IS 'Returns all audit sessions with summary stats for report selection dropdown';
COMMENT ON FUNCTION get_racks_by_session(uuid, boolean) IS 'Returns racks in a session with optional active rack filtering for selection table';
COMMENT ON FUNCTION get_rack_export_data(uuid) IS 'Returns complete rack and scan data for CSV export generation';