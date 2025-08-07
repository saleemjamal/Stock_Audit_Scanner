-- 32. Diagnose location_ids Column Issue
-- Check current state of users and locations tables

-- Check users table structure
SELECT 
  'Users Table Structure' as info,
  column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'location_ids';

-- Check locations table structure  
SELECT 
  'Locations Table Structure' as info,
  column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'locations' AND column_name = 'id';

-- Check current location_ids values
SELECT 
  'Current Users location_ids' as info,
  username, location_ids, 
  array_length(location_ids, 1) as array_length,
  pg_typeof(location_ids) as column_type
FROM users 
WHERE username IN ('saleem', 'supervisor1', 'scanner1');

-- Check existing locations
SELECT 
  'Existing Locations' as info,
  id, name, pg_typeof(id) as id_type
FROM locations
ORDER BY name;

-- Test if locations exist
SELECT 
  'Location Count' as info,
  COUNT(*) as total_locations
FROM locations;

SELECT 'Diagnosis complete' as status;