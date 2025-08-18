# Production Deployment Guide

## 🚀 Deployment Overview
This guide covers the deployment of the Stock Audit Scanner System to production, including risk mitigation, emergency procedures, and monitoring requirements.

**Last Updated**: August 18, 2025  
**Version**: 1.0

---

## 🔴 Critical Pain Points & Mitigation

### 1. Database Migration Failures
**Risk**: Rack barcode migration (`working_date_migration.sql`) could fail or timeout on large datasets  
**Impact**: System unusable if racks don't have barcodes  

**Mitigation Strategy**:
- Run migration during off-hours
- Test on staging environment first
- Have rollback script ready

**Rollback Script**:
```sql
-- Emergency rollback if migration fails
ALTER TABLE racks DROP COLUMN barcode;

-- If partially migrated, reset
UPDATE racks SET barcode = NULL WHERE barcode IS NOT NULL;
```

**Batch Migration** (if >1000 racks):
```sql
-- Run in batches to avoid timeout
DO $$
DECLARE
    batch_size INTEGER := 100;
    offset_val INTEGER := 0;
    total_rows INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_rows FROM racks WHERE barcode IS NULL;
    
    WHILE offset_val < total_rows LOOP
        UPDATE racks 
        SET barcode = TO_CHAR(NOW(), 'DDMM') || '-' || 
            LPAD((ROW_NUMBER() OVER (ORDER BY rack_number) + offset_val)::text, 3, '0')
        WHERE id IN (
            SELECT id FROM racks 
            WHERE barcode IS NULL 
            ORDER BY rack_number 
            LIMIT batch_size
        );
        offset_val := offset_val + batch_size;
        COMMIT;
    END LOOP;
END $$;
```

### 2. Active Session Interruption
**Risk**: Changes while audit is in progress could break ongoing work  
**Impact**: Lost scans, confused users  

**Pre-deployment Check**:
```sql
-- Check for active sessions
SELECT 
    id,
    shortname,
    (SELECT name FROM locations WHERE id = location_id) as location,
    started_at,
    (SELECT COUNT(*) FROM scans WHERE audit_session_id = audit_sessions.id) as scan_count
FROM audit_sessions 
WHERE status = 'active';

-- Check active scanners
SELECT 
    u.username,
    r.rack_number,
    COUNT(s.id) as scans_in_progress
FROM users u
JOIN racks r ON r.scanner_id = u.id
LEFT JOIN scans s ON s.rack_id = r.id
WHERE r.status = 'assigned'
GROUP BY u.username, r.rack_number;
```

**Safe Deployment Window**:
- Deploy when no active sessions OR
- Schedule 15-minute maintenance window
- Force-flush all pending scans first

### 3. User Access Issues
**Risk**: Scanner Status widget changes might hide users  
**Impact**: Supervisors can't see their scanners  

**Pre-deployment Verification**:
```sql
-- Check users with missing location assignments
SELECT username, role, location_ids 
FROM users 
WHERE (location_ids IS NULL OR location_ids = '{}')
  AND role IN ('scanner', 'supervisor');

-- Fix missing locations
UPDATE users 
SET location_ids = ARRAY[
    (SELECT location_id FROM audit_sessions WHERE status = 'active' LIMIT 1)
] 
WHERE (location_ids IS NULL OR location_ids = '{}')
  AND role IN ('scanner', 'supervisor');
```

---

## ⚠️ Performance Optimization

### Required Database Indexes
```sql
-- Check if indexes exist
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('scans', 'racks', 'users');

-- Create missing indexes for performance
CREATE INDEX IF NOT EXISTS idx_scans_session_scanner 
    ON scans(audit_session_id, scanner_id);
    
CREATE INDEX IF NOT EXISTS idx_scans_created 
    ON scans(created_at DESC);
    
CREATE INDEX IF NOT EXISTS idx_racks_session_scanner 
    ON racks(audit_session_id, scanner_id);
    
CREATE INDEX IF NOT EXISTS idx_racks_status 
    ON racks(status);
    
CREATE INDEX IF NOT EXISTS idx_users_location_ids 
    ON users USING GIN (location_ids);
```

### Query Performance Monitoring
```sql
-- Find slow queries
SELECT 
    query,
    calls,
    mean_exec_time,
    max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check table sizes
SELECT 
    relname AS table_name,
    pg_size_pretty(pg_total_relation_size(relid)) AS size
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```

---

## 📋 Pre-Deployment Checklist

### 1. Backup Procedures
```bash
# Full database backup
pg_dump -h your-db-host -U postgres -d postgres > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup specific tables
pg_dump -h your-db-host -U postgres -d postgres \
    -t users -t racks -t scans -t audit_sessions \
    > critical_tables_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Pre-flight Checks
```sql
-- Verify data integrity
SELECT 'Orphaned racks' as check_name, COUNT(*) as count
FROM racks WHERE audit_session_id NOT IN (SELECT id FROM audit_sessions)
UNION ALL
SELECT 'Orphaned scans', COUNT(*)
FROM scans WHERE rack_id NOT IN (SELECT id FROM racks)
UNION ALL
SELECT 'Users without locations', COUNT(*)
FROM users WHERE location_ids = '{}' OR location_ids IS NULL;

-- Check for duplicate active sessions
SELECT location_id, COUNT(*) as active_count
FROM audit_sessions
WHERE status = 'active'
GROUP BY location_id
HAVING COUNT(*) > 1;
```

### 3. Test Barcode Generation
```sql
-- Test barcode format
SELECT 
    id,
    rack_number,
    TO_CHAR(NOW(), 'DDMM') || '-' || LPAD(rack_number, 3, '0') as proposed_barcode
FROM racks
WHERE audit_session_id = (SELECT id FROM audit_sessions WHERE status = 'active' LIMIT 1)
LIMIT 5;
```

---

## 🚨 Emergency Response Procedures

### Issue: "Can't see scanners in dashboard"
```sql
-- Quick fix: Ensure users have location assignments
UPDATE users 
SET location_ids = (
    SELECT ARRAY[location_id] 
    FROM audit_sessions 
    WHERE status = 'active' 
    LIMIT 1
) 
WHERE role IN ('scanner', 'supervisor')
  AND (location_ids IS NULL OR location_ids = '{}');

-- Verify fix
SELECT username, role, location_ids 
FROM users 
WHERE role IN ('scanner', 'supervisor');
```

### Issue: "Personal stats showing wrong numbers"
```sql
-- Verify session isolation
SELECT 
    u.username,
    COUNT(DISTINCT s.id) as scan_count,
    COUNT(DISTINCT r.id) as rack_count
FROM users u
LEFT JOIN scans s ON s.scanner_id = u.id 
    AND s.audit_session_id = 'current_session_id_here'
LEFT JOIN racks r ON r.scanner_id = u.id 
    AND r.audit_session_id = 'current_session_id_here'
GROUP BY u.username;

-- Reset stats cache (if using views)
REFRESH MATERIALIZED VIEW IF EXISTS user_personal_stats;
```

### Issue: "Rack barcodes not scanning"
```sql
-- Generate barcodes manually if migration failed
UPDATE racks 
SET barcode = TO_CHAR(NOW(), 'DDMM') || '-' || 
    LPAD(ROW_NUMBER() OVER (
        PARTITION BY audit_session_id 
        ORDER BY rack_number
    )::text, 3, '0')
WHERE audit_session_id = (
    SELECT id FROM audit_sessions WHERE status = 'active' LIMIT 1
) 
AND barcode IS NULL;

-- Verify barcodes
SELECT rack_number, barcode 
FROM racks 
WHERE audit_session_id = (
    SELECT id FROM audit_sessions WHERE status = 'active' LIMIT 1
)
ORDER BY rack_number
LIMIT 10;
```

### Issue: "Users can't login"
```sql
-- Check user status
SELECT 
    username,
    email,
    active,
    last_login_at
FROM users
WHERE email = 'problem_user@email.com';

-- Reactivate user
UPDATE users 
SET active = true 
WHERE email = 'problem_user@email.com';

-- Check Google OAuth whitelist
SELECT email, role, active 
FROM users 
ORDER BY created_at DESC 
LIMIT 10;
```

### Issue: "Scans not syncing"
```sql
-- Check for stuck scans
SELECT 
    COUNT(*) as pending_scans,
    MIN(created_at) as oldest_scan,
    MAX(created_at) as newest_scan
FROM scans
WHERE synced_at IS NULL;

-- Force sync (if using sync queue)
UPDATE scans 
SET synced_at = NOW() 
WHERE synced_at IS NULL 
  AND created_at < NOW() - INTERVAL '5 minutes';

-- Clear sync queue if blocked
DELETE FROM sync_queue 
WHERE status = 'failed' 
  AND retry_count > 3;
```

---

## 📊 Monitoring & Health Checks

### Key Metrics to Monitor
```sql
-- System health dashboard
WITH metrics AS (
    SELECT 
        (SELECT COUNT(*) FROM users WHERE last_login_at > NOW() - INTERVAL '1 hour') as active_users,
        (SELECT COUNT(*) FROM audit_sessions WHERE status = 'active') as active_sessions,
        (SELECT COUNT(*) FROM racks WHERE status = 'assigned') as racks_in_progress,
        (SELECT COUNT(*) FROM scans WHERE created_at > NOW() - INTERVAL '1 hour') as recent_scans,
        (SELECT COUNT(*) FROM racks WHERE status = 'ready_for_approval') as pending_approvals
)
SELECT * FROM metrics;

-- Scanning velocity
SELECT 
    DATE_TRUNC('hour', created_at) as hour,
    COUNT(*) as scans,
    COUNT(DISTINCT scanner_id) as active_scanners
FROM scans
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

-- Error detection
SELECT 
    COUNT(*) FILTER (WHERE status = 'failed') as failed_syncs,
    COUNT(*) FILTER (WHERE status = 'rejected') as rejected_racks,
    COUNT(*) FILTER (WHERE active = false) as inactive_users
FROM (
    SELECT 'failed' as status FROM sync_queue WHERE status = 'failed'
    UNION ALL
    SELECT status FROM racks WHERE status = 'rejected' AND rejected_at > NOW() - INTERVAL '1 hour'
    UNION ALL
    SELECT CASE WHEN active THEN 'active' ELSE 'inactive' END FROM users
) as combined;
```

### Supabase Dashboard Monitoring
- **Database Connections**: Keep below 80% of limit
- **Average Query Time**: Should be <200ms
- **Error Rate**: Should be <1%
- **Storage Usage**: Monitor for unexpected growth

### Application Health Endpoints
```javascript
// Add to Next.js API routes for monitoring
// /api/health
export async function GET() {
  const checks = {
    database: false,
    auth: false,
    timestamp: new Date().toISOString()
  }
  
  try {
    // Check database
    const { error: dbError } = await supabase.from('users').select('id').limit(1)
    checks.database = !dbError
    
    // Check auth
    const { error: authError } = await supabase.auth.getSession()
    checks.auth = !authError
    
    const status = checks.database && checks.auth ? 200 : 503
    return Response.json(checks, { status })
  } catch (error) {
    return Response.json({ error: 'Health check failed' }, { status: 503 })
  }
}
```

---

## 📱 Communication Templates

### Pre-deployment Notice (1 hour before)
```
Subject: Stock Audit System - Scheduled Maintenance

The Stock Audit Scanner System will undergo maintenance at [TIME].

What to expect:
- 15-minute service interruption
- All pending scans will be saved
- You may need to re-login after update

Action Required:
- Complete and submit any racks in progress
- Save your work before [TIME]

Thank you for your patience.
```

### During Deployment
```
Subject: Stock Audit System - Maintenance In Progress

The system is currently being updated.
Expected completion: [TIME] (15 minutes)

Please do not attempt to scan during this time.
```

### Post-deployment
```
Subject: Stock Audit System - Update Complete

The system update is complete and all services are operational.

New Features:
- Improved dashboard performance
- Enhanced scanner status visibility
- Session-specific personal stats

Please report any issues to: [SUPPORT_EMAIL]
```

---

## ✅ Post-Deployment Verification

### Success Criteria Checklist
- [ ] All users can successfully log in
- [ ] Scanners and supervisors appear in Scanner Status widget
- [ ] Personal stats show current session data only
- [ ] Rack barcodes scan and auto-select correctly
- [ ] No performance degradation (page loads <3 seconds)
- [ ] Zero data loss from pre-deployment
- [ ] All active racks maintain their assignments
- [ ] Pending approvals still visible to supervisors

### Smoke Test Queries
```sql
-- Verify all systems operational
SELECT 
    'Users can login' as test,
    CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END as result
FROM users WHERE last_login_at > NOW() - INTERVAL '10 minutes'
UNION ALL
SELECT 
    'Scans are recording',
    CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END
FROM scans WHERE created_at > NOW() - INTERVAL '10 minutes'
UNION ALL
SELECT 
    'Racks have barcodes',
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM racks 
WHERE audit_session_id IN (SELECT id FROM audit_sessions WHERE status = 'active')
  AND barcode IS NULL;
```

---

## 🔄 Rollback Procedures

If critical issues occur, follow these rollback steps:

1. **Immediate Actions**:
```sql
-- Revert barcode column if causing issues
ALTER TABLE racks DROP COLUMN IF EXISTS barcode;

-- Reset to previous audit session if corrupted
UPDATE audit_sessions 
SET status = 'completed' 
WHERE status = 'active' AND id = 'problematic_session_id';

-- Restore previous active session
UPDATE audit_sessions 
SET status = 'active' 
WHERE id = 'previous_good_session_id';
```

2. **Code Rollback**:
```bash
# Revert to previous deployment
git revert HEAD
vercel rollback

# Or redeploy previous version
vercel deploy --prod --force
```

3. **Data Recovery**:
```bash
# Restore from backup
psql -h your-db-host -U postgres -d postgres < backup_20250818.sql

# Or restore specific tables
psql -h your-db-host -U postgres -d postgres < critical_tables_backup.sql
```

---

## 📞 Emergency Contacts

- **Database Admin**: [DBA_CONTACT]
- **DevOps Lead**: [DEVOPS_CONTACT]
- **Product Owner**: saleem@poppatjamals.com
- **Supabase Support**: support.supabase.com

---

## 📝 Notes

- Always test migrations on a copy of production data first
- Keep this document updated with any new issues encountered
- Document resolution steps for future reference
- Maintain backup retention for at least 7 days

**Last Deployment**: [DATE]  
**Next Scheduled**: [DATE]  
**Document Version**: 1.0