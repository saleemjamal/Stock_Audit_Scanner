-- Clean up test data for user deletion
-- Replace 'Scanner One' with the actual username or user ID

-- 1. Find the user ID (replace 'Scanner One' with actual username)
-- SELECT id, username FROM users WHERE username = 'Scanner One';

-- 2. Clean up user's assignments (replace USER_ID_HERE with actual UUID)
-- UPDATE racks SET scanner_id = NULL, status = 'available' WHERE scanner_id = 'USER_ID_HERE';

-- 3. Clean up user's scans (optional - keeps audit trail)
-- DELETE FROM scans WHERE scanner_id = 'USER_ID_HERE';

-- 4. Clean up user's notifications
-- DELETE FROM notifications WHERE user_id = 'USER_ID_HERE' OR created_by = 'USER_ID_HERE';

-- 5. Clean up audit session references
-- UPDATE audit_sessions SET started_by = NULL WHERE started_by = 'USER_ID_HERE';
-- UPDATE audit_sessions SET completed_by = NULL WHERE completed_by = 'USER_ID_HERE';

-- 6. Now delete the user
-- DELETE FROM users WHERE id = 'USER_ID_HERE';

-- Example with actual user lookup:
WITH user_to_delete AS (
  SELECT id FROM users WHERE username = 'Scanner One' LIMIT 1
)
UPDATE racks 
SET scanner_id = NULL, 
    status = 'available',
    assigned_at = NULL
FROM user_to_delete 
WHERE racks.scanner_id = user_to_delete.id;

-- Then delete the user
DELETE FROM users WHERE username = 'Scanner One';