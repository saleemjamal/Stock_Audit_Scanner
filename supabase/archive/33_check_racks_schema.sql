-- 33. Check Racks Table Schema
-- Find the correct column names for the racks table

SELECT 
  'Racks Table Schema' as info,
  column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'racks'
ORDER BY ordinal_position;

-- Also check existing racks if any
SELECT 
  'Existing Racks' as info,
  *
FROM racks
LIMIT 5;