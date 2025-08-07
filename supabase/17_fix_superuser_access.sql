-- 17. Fix Superuser Location Access
-- This script ensures the superuser (saleem) has access to all locations
-- Run this after creating test locations

-- Give saleem access to all locations (superuser should see everything)
UPDATE users 
SET location_ids = ARRAY(SELECT id FROM locations WHERE active = true)
WHERE username = 'saleem';

-- Also update other test users to have specific location access
-- Give supervisor1 access to Downtown Store and Warehouse A
UPDATE users 
SET location_ids = ARRAY(
  SELECT id FROM locations 
  WHERE name IN ('Downtown Store', 'Warehouse A') 
  AND active = true
)
WHERE username = 'supervisor1';

-- Give scanner1 access to Downtown Store only
UPDATE users 
SET location_ids = ARRAY(
  SELECT id FROM locations 
  WHERE name = 'Downtown Store' 
  AND active = true
)
WHERE username = 'scanner1';

-- Verify user location assignments
SELECT 
  'User Location Access Updated' as status;

SELECT 
  username,
  role,
  location_ids,
  (SELECT array_agg(name) FROM locations WHERE id = ANY(users.location_ids)) as location_names
FROM users 
WHERE username IN ('saleem', 'supervisor1', 'scanner1')
ORDER BY 
  CASE role 
    WHEN 'superuser' THEN 1 
    WHEN 'supervisor' THEN 2 
    WHEN 'scanner' THEN 3 
  END;