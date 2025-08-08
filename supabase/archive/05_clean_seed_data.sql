-- 05. Clean Seed Data - Handles duplicates gracefully
-- This version prevents duplicate key errors

-- Clear existing seed data first
DELETE FROM notifications WHERE created_at > NOW() - INTERVAL '1 day';
DELETE FROM scans WHERE created_at > NOW() - INTERVAL '1 day';
DELETE FROM racks WHERE created_at > NOW() - INTERVAL '1 day';
DELETE FROM audit_sessions WHERE created_at > NOW() - INTERVAL '1 day';
DELETE FROM users WHERE created_at > NOW() - INTERVAL '1 day';
DELETE FROM locations WHERE created_at > NOW() - INTERVAL '1 day';

-- Insert test locations (with conflict handling)
INSERT INTO locations (name, address, city, state, active) VALUES
('Downtown Store', '123 Main St', 'Dallas', 'TX', true),
('Warehouse A', '456 Industrial Blvd', 'Irving', 'TX', true),
('North Branch', '789 Commerce Way', 'Plano', 'TX', true),
('South Branch', '321 Retail Ave', 'Grand Prairie', 'TX', true)
ON CONFLICT (name) DO NOTHING;

-- Insert test users (with conflict handling)
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
 ])
ON CONFLICT (email) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    location_ids = EXCLUDED.location_ids,
    updated_at = NOW();

-- Insert test audit session
INSERT INTO audit_sessions (location_id, total_rack_count, status, started_by)
VALUES (
    (SELECT id FROM locations WHERE name = 'Downtown Store'),
    20,
    'active', 
    (SELECT id FROM users WHERE email = 'saleem@poppatjamals.com')
)
ON CONFLICT DO NOTHING;

-- Get the audit session ID
DO $$
DECLARE
    session_id UUID;
BEGIN
    SELECT id INTO session_id FROM audit_sessions 
    WHERE location_id = (SELECT id FROM locations WHERE name = 'Downtown Store')
    AND status = 'active'
    LIMIT 1;

    -- Insert test racks for the audit session (prevent duplicates)
    INSERT INTO racks (audit_session_id, rack_number, shelf_number, location_id, status)
    SELECT 
        session_id,
        'R' || LPAD(generate_series(1,20)::text, 3, '0'),
        'S' || LPAD((generate_series(1,20) % 5 + 1)::text, 2, '0'),
        (SELECT id FROM locations WHERE name = 'Downtown Store'),
        'available'
    FROM generate_series(1,20)
    ON CONFLICT (audit_session_id, rack_number) DO NOTHING;

    -- Assign a few racks to test scanner
    UPDATE racks 
    SET 
        status = 'assigned',
        scanner_id = (SELECT id FROM users WHERE email = 'scanner1@poppatjamals.com'),
        assigned_at = NOW() - INTERVAL '1 hour'
    WHERE audit_session_id = session_id 
    AND rack_number IN ('R001', 'R002', 'R003')
    AND status = 'available';

    -- Add some test scans
    INSERT INTO scans (audit_session_id, rack_id, barcode, scanner_id, quantity, scanned_at)
    SELECT 
        r.audit_session_id,
        r.id,
        '123456789' || LPAD((row_number() OVER())::text, 4, '0'),
        r.scanner_id,
        1,
        NOW() - INTERVAL '30 minutes' + (row_number() OVER() * INTERVAL '5 minutes')
    FROM racks r 
    WHERE r.audit_session_id = session_id
    AND r.scanner_id IS NOT NULL
    AND generate_series(1, 3) <= 3 -- 3 scans per assigned rack
    ON CONFLICT DO NOTHING;

    -- Mark one rack as ready for approval
    UPDATE racks 
    SET 
        status = 'ready_for_approval',
        ready_for_approval = true,
        ready_at = NOW() - INTERVAL '15 minutes',
        completed_at = NOW() - INTERVAL '15 minutes'
    WHERE audit_session_id = session_id
    AND rack_number = 'R001'
    AND scanner_id IS NOT NULL;
END $$;

-- Add test notifications (prevent duplicates)
INSERT INTO notifications (user_id, title, message, type, created_by)
SELECT 
    u.id,
    title,
    message,
    type,
    created_by_id
FROM (
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
     NULL)
) AS data(user_id, title, message, type, created_by_id)
JOIN users u ON u.id = data.user_id
WHERE NOT EXISTS (
    SELECT 1 FROM notifications n 
    WHERE n.user_id = data.user_id AND n.title = data.title
);

-- Display summary of created data
SELECT '=== CLEAN SEED DATA SUMMARY ===' as section;

SELECT 'Locations:' as item, COUNT(*) as count FROM locations;
SELECT 'Users:' as item, COUNT(*) as count FROM users;
SELECT 'Audit sessions:' as item, COUNT(*) as count FROM audit_sessions;
SELECT 'Racks:' as item, COUNT(*) as count FROM racks;
SELECT 'Scans:' as item, COUNT(*) as count FROM scans;
SELECT 'Notifications:' as item, COUNT(*) as count FROM notifications;

-- Show test users and their access
SELECT '=== TEST USERS FOR GOOGLE SSO ===' as section;
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

SELECT '✅ CLEAN SEED DATA CREATED - Ready for Google SSO!' as final_status;