-- Sample Data for Testing
-- Execute this after running all other SQL files

-- Insert sample locations
INSERT INTO locations (name, address, city, state, zip_code) VALUES
('Downtown Store', '123 Main St', 'Anytown', 'CA', '90210'),
('Mall Location', '456 Shopping Center Dr', 'Suburb', 'CA', '90211'),
('Warehouse A', '789 Industrial Blvd', 'Industrial City', 'CA', '90212');

-- Note: Users will be created automatically when they first sign in
-- But we can create some sample users if needed for testing

-- Example of inserting a test admin user (replace with actual user ID from auth.users)
-- INSERT INTO users (id, email, full_name, role, location_ids) VALUES
-- ('00000000-0000-0000-0000-000000000001', 'admin@company.com', 'System Admin', 'admin', '{1,2,3}');

-- Sample audit session (for testing)
-- INSERT INTO audit_sessions (location_id, total_rack_count, status, started_by) VALUES
-- (1, 10, 'setup', '00000000-0000-0000-0000-000000000001');

-- The system will automatically generate racks when audit status changes to 'active'