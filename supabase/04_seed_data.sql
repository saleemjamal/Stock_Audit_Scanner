-- 04. Seed Data - Test data with Google emails
-- Clean test data for Google SSO system

-- Clear all seed data completely first
TRUNCATE notifications, scans, racks, audit_sessions, users, locations RESTART IDENTITY CASCADE;

-- Insert test locations
INSERT INTO locations (name, address, city, state, active) VALUES
('Downtown Store', '123 Main St', 'Dallas', 'TX', true),
('Warehouse A', '456 Industrial Blvd', 'Irving', 'TX', true),
('North Branch', '789 Commerce Way', 'Plano', 'TX', true),
('South Branch', '321 Retail Ave', 'Grand Prairie', 'TX', true);

-- Insert test users (these will be linked to Google OAuth via email)
-- NOTE: These users will be created automatically when they first sign in with Google
-- But we're pre-creating them here with proper roles and location access
INSERT INTO users (email, full_name, role, location_ids) VALUES
-- Superuser - full access to all locations
('saleem@poppatjamals.com', 'Saleem Jamal', 'superuser', 
 ARRAY(SELECT id FROM locations WHERE active = true)),

-- Supervisors - access to specific locations  
('supervisor1@poppatjamals.com', 'Supervisor One', 'supervisor', 
 ARRAY[
   (SELECT id FROM locations WHERE name = 'Downtown Store'),
   (SELECT id FROM locations WHERE name = 'North Branch')
 ]),
 
('supervisor2@poppatjamals.com', 'Supervisor Two', 'supervisor',
 ARRAY[
   (SELECT id FROM locations WHERE name = 'Warehouse A'),
   (SELECT id FROM locations WHERE name = 'South Branch')
 ]),

-- Scanners - access to specific locations
('scanner1@poppatjamals.com', 'Scanner One', 'scanner',
 ARRAY[
   (SELECT id FROM locations WHERE name = 'Downtown Store')
 ]),
 
('scanner2@poppatjamals.com', 'Scanner Two', 'scanner', 
 ARRAY[
   (SELECT id FROM locations WHERE name = 'Warehouse A')
 ]),
 
('scanner3@poppatjamals.com', 'Scanner Three', 'scanner',
 ARRAY[
   (SELECT id FROM locations WHERE name = 'North Branch')
 ]);

-- Insert test audit session
INSERT INTO audit_sessions (location_id, total_rack_count, status, started_by)
VALUES (
    (SELECT id FROM locations WHERE name = 'Downtown Store'),
    20,
    'active', 
    (SELECT id FROM users WHERE email = 'saleem@poppatjamals.com')
);

-- Insert test racks for the audit session
INSERT INTO racks (audit_session_id, rack_number, shelf_number, location_id, status)
SELECT 
    (SELECT id FROM audit_sessions WHERE status = 'active' LIMIT 1),
    'R' || LPAD(n::text, 3, '0'),
    'S' || LPAD(((n-1) % 5 + 1)::text, 2, '0'),
    (SELECT id FROM locations WHERE name = 'Downtown Store'),
    'available'
FROM generate_series(1,20) AS n;

-- Assign a few racks to test scanner
UPDATE racks 
SET 
    status = 'assigned',
    scanner_id = (SELECT id FROM users WHERE email = 'scanner1@poppatjamals.com'),
    assigned_at = NOW() - INTERVAL '1 hour'
WHERE rack_number IN ('R001', 'R002', 'R003');

-- Add some test scans
INSERT INTO scans (audit_session_id, rack_id, barcode, scanner_id, quantity, scanned_at)
SELECT 
    r.audit_session_id,
    r.id,
    '123456789' || LPAD((row_number() OVER(ORDER BY r.id, s.scan_num))::text, 4, '0'),
    r.scanner_id,
    1,
    NOW() - INTERVAL '30 minutes' + (row_number() OVER(ORDER BY r.id, s.scan_num) * INTERVAL '2 minutes')
FROM racks r 
CROSS JOIN (SELECT generate_series(1, 3) AS scan_num) s
WHERE r.scanner_id IS NOT NULL;

-- Mark one rack as ready for approval
UPDATE racks 
SET 
    status = 'ready_for_approval',
    ready_for_approval = true,
    ready_at = NOW() - INTERVAL '15 minutes',
    completed_at = NOW() - INTERVAL '15 minutes'
WHERE rack_number = 'R001';

-- Add test notifications
INSERT INTO notifications (user_id, title, message, type, created_by)
VALUES 
-- Notification for supervisor about ready rack
((SELECT id FROM users WHERE email = 'supervisor1@poppatjamals.com'),
 'Rack Ready for Approval',
 'Rack R001 at Downtown Store is ready for approval',
 'approval_request',
 (SELECT id FROM users WHERE email = 'scanner1@poppatjamals.com')),

-- Welcome notification for each user
((SELECT id FROM users WHERE email = 'saleem@poppatjamals.com'),
 'Welcome to Stock Audit System',
 'You have superuser access to all locations and features.',
 'welcome',
 NULL),

((SELECT id FROM users WHERE email = 'supervisor1@poppatjamals.com'),
 'Welcome to Stock Audit System', 
 'You have supervisor access to Downtown Store and North Branch.',
 'welcome',
 NULL),

((SELECT id FROM users WHERE email = 'scanner1@poppatjamals.com'),
 'Welcome to Stock Audit System',
 'You have scanner access to Downtown Store. Use the mobile app to scan items.',
 'welcome',
 NULL);

-- Display summary of created data
SELECT '=== SEED DATA SUMMARY ===' as section;

SELECT 'Locations created:' as item, COUNT(*) as count FROM locations;
SELECT 'Users created:' as item, COUNT(*) as count FROM users;
SELECT 'Audit sessions created:' as item, COUNT(*) as count FROM audit_sessions;
SELECT 'Racks created:' as item, COUNT(*) as count FROM racks;
SELECT 'Scans created:' as item, COUNT(*) as count FROM scans;
SELECT 'Notifications created:' as item, COUNT(*) as count FROM notifications;

-- Show test users and their access
SELECT '=== TEST USERS ===' as section;
SELECT 
    email,
    full_name,
    role,
    array_length(location_ids, 1) as location_count,
    CASE 
        WHEN role = 'superuser' THEN 'Full system access'
        WHEN role = 'supervisor' THEN 'Dashboard + Mobile access'
        WHEN role = 'scanner' THEN 'Mobile app only'
    END as access_level
FROM users
ORDER BY role DESC, email;

-- Show Google OAuth setup instructions
SELECT '=== GOOGLE OAUTH SETUP NEEDED ===' as section;
SELECT 'Go to Supabase Dashboard → Authentication → Providers' as step_1;
SELECT 'Enable Google provider and add your OAuth credentials' as step_2;
SELECT 'Set redirect URLs for mobile and dashboard apps' as step_3;
SELECT 'Test login with the email addresses shown above' as step_4;

SELECT '✅ SEED DATA CREATED - Ready for Google SSO!' as final_status;