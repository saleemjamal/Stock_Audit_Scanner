-- 16. Create Test Locations
-- This script creates test locations for the Stock Audit Scanner System
-- Run this after the main schema and authentication setup is complete

-- Create test locations for different store types
INSERT INTO locations (name, address, city, state, active) VALUES
('Downtown Store', '123 Main St', 'Dallas', 'TX', true),
('Warehouse A', '456 Industrial Blvd', 'Irving', 'TX', true),
('North Branch', '789 Commerce Way', 'Plano', 'TX', true),
('Distribution Center', '321 Logistics Dr', 'Fort Worth', 'TX', true);

-- Verify locations were created successfully
SELECT 
  'Locations Created Successfully' as status,
  COUNT(*) as location_count,
  array_agg(name ORDER BY name) as location_names
FROM locations WHERE active = true;

-- Show individual location details
SELECT id, name, city, state, active, created_at 
FROM locations 
ORDER BY name;