-- Diagnostic Queries for Rack Duplication Issues
-- Replace SESSION_ID_HERE with your actual session ID

-- 1. Check all racks for the problematic session
SELECT 
    rack_number,
    status,
    created_at,
    updated_at,
    scan_count,
    total_scans
FROM racks 
WHERE audit_session_id = '231555e5-55f9-468b-9bbc-bfc8432983b3'
ORDER BY rack_number::integer;

-- 2. Check for duplicate rack numbers (should return no results if no duplicates)
SELECT 
    rack_number,
    COUNT(*) as duplicate_count
FROM racks 
WHERE audit_session_id = '231555e5-55f9-468b-9bbc-bfc8432983b3'
GROUP BY rack_number
HAVING COUNT(*) > 1;

-- 3. Get session info
SELECT 
    id,
    shortname,
    total_rack_count,
    status,
    started_at
FROM audit_sessions 
WHERE id = '231555e5-55f9-468b-9bbc-bfc8432983b3';

-- 4. Count actual racks vs expected
SELECT 
    s.shortname,
    s.total_rack_count as expected_racks,
    COUNT(r.id) as actual_racks,
    s.total_rack_count - COUNT(r.id) as difference
FROM audit_sessions s
LEFT JOIN racks r ON s.id = r.audit_session_id
WHERE s.id = '231555e5-55f9-468b-9bbc-bfc8432983b3'
GROUP BY s.id, s.shortname, s.total_rack_count;

-- 5. Check for gaps in rack numbering
WITH rack_numbers AS (
    SELECT rack_number::integer as num
    FROM racks 
    WHERE audit_session_id = '231555e5-55f9-468b-9bbc-bfc8432983b3'
),
expected_numbers AS (
    SELECT generate_series(1, (
        SELECT total_rack_count 
        FROM audit_sessions 
        WHERE id = '231555e5-55f9-468b-9bbc-bfc8432983b3'
    )) as num
)
SELECT 
    e.num as missing_rack_number
FROM expected_numbers e
LEFT JOIN rack_numbers r ON e.num = r.num
WHERE r.num IS NULL
ORDER BY e.num;

-- 6. Find the highest rack number
SELECT 
    MAX(rack_number::integer) as highest_rack_number
FROM racks 
WHERE audit_session_id = '231555e5-55f9-468b-9bbc-bfc8432983b3';