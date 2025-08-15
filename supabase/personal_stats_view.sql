-- Simple personal stats view that definitely works
DROP VIEW IF EXISTS user_personal_stats;
CREATE VIEW user_personal_stats AS
SELECT 
  u.id as scanner_id,
  
  -- Scanning stats - today only
  COALESCE(COUNT(s.id) FILTER (WHERE DATE(s.created_at) = CURRENT_DATE), 0) as today_scans,
  COALESCE(COUNT(s.id) FILTER (WHERE s.created_at >= NOW() - INTERVAL '1 hour'), 0) as last_hour_scans,
  COALESCE(COUNT(s.id), 0) as total_scans,
  
  -- Rack stats from current user's racks
  COALESCE(COUNT(DISTINCT r.id), 0) as racks_worked,
  COALESCE(COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'approved'), 0) as racks_approved,
  COALESCE(COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'ready_for_approval'), 0) as racks_pending,
  COALESCE(COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'rejected'), 0) as racks_rejected,
  
  -- Simple accuracy rate
  CASE 
    WHEN COUNT(DISTINCT r.id) FILTER (WHERE r.status IN ('approved', 'rejected')) > 0 
    THEN ROUND(
      COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'approved')::numeric * 100.0 / 
      COUNT(DISTINCT r.id) FILTER (WHERE r.status IN ('approved', 'rejected'))::numeric, 
      1
    )
    ELSE 0.0 
  END as accuracy_rate,
  
  -- Time stats
  MAX(s.created_at) as last_scan_at,
  
  -- Current session (if any)
  COALESCE((SELECT id FROM audit_sessions WHERE status = 'active' ORDER BY created_at DESC LIMIT 1), NULL) as audit_session_id

FROM users u
LEFT JOIN scans s ON s.scanner_id = u.id
LEFT JOIN racks r ON r.scanner_id = u.id
GROUP BY u.id;

-- Simple indexes
CREATE INDEX IF NOT EXISTS idx_scans_scanner_created ON scans(scanner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_racks_scanner_status ON racks(scanner_id, status);