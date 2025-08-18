-- 01. Clean Schema - Google SSO Ready Design
-- Simple, clean database schema designed for Google OAuth from the start

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User roles enum
CREATE TYPE user_role AS ENUM ('scanner', 'supervisor', 'superuser');

-- Audit status enum  
CREATE TYPE audit_status AS ENUM ('active', 'completed', 'cancelled');

-- Rack status enum
CREATE TYPE rack_status AS ENUM ('available', 'assigned', 'in_progress', 'ready_for_approval', 'approved', 'rejected');

-- Locations table
CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address TEXT,
    city VARCHAR(50),
    state VARCHAR(10),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table (linked to auth.users via email for Google SSO)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL, -- Links to auth.users.email
    full_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL DEFAULT 'scanner',
    location_ids INTEGER[] DEFAULT '{}', -- Array of location IDs user can access
    active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit sessions table
CREATE TABLE audit_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id INTEGER NOT NULL REFERENCES locations(id),
    total_rack_count INTEGER NOT NULL DEFAULT 0,
    status audit_status DEFAULT 'active',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_by UUID REFERENCES users(id),
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Racks table  
CREATE TABLE racks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audit_session_id UUID NOT NULL REFERENCES audit_sessions(id) ON DELETE CASCADE,
    rack_number VARCHAR(50) NOT NULL,
    shelf_number VARCHAR(50),
    location_id INTEGER NOT NULL REFERENCES locations(id),
    status rack_status DEFAULT 'available',
    scanner_id UUID REFERENCES users(id),
    assigned_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    ready_for_approval BOOLEAN DEFAULT false,
    ready_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejected_by UUID REFERENCES users(id), 
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(audit_session_id, rack_number)
);

-- Scans table
CREATE TABLE scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audit_session_id UUID NOT NULL REFERENCES audit_sessions(id) ON DELETE CASCADE,
    rack_id UUID NOT NULL REFERENCES racks(id) ON DELETE CASCADE,
    barcode VARCHAR(200) NOT NULL,
    scanner_id UUID NOT NULL REFERENCES users(id),
    quantity INTEGER DEFAULT 1,
    manual_entry BOOLEAN DEFAULT false,
    notes TEXT,
    device_id VARCHAR(100),
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info',
    read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_audit_sessions_location ON audit_sessions(location_id);
CREATE INDEX idx_audit_sessions_status ON audit_sessions(status);
CREATE INDEX idx_racks_audit_session ON racks(audit_session_id);
CREATE INDEX idx_racks_scanner ON racks(scanner_id);
CREATE INDEX idx_racks_status ON racks(status);
CREATE INDEX idx_scans_rack ON scans(rack_id);
CREATE INDEX idx_scans_barcode ON scans(barcode);
CREATE INDEX idx_notifications_user ON notifications(user_id);

-- Updated at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_audit_sessions_updated_at BEFORE UPDATE ON audit_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_racks_updated_at BEFORE UPDATE ON racks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Google SSO user creation function
-- This automatically creates a user profile when someone signs in with Google
CREATE OR REPLACE FUNCTION handle_google_auth_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create profile if this is a new Google OAuth user
    IF NEW.email IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users WHERE email = NEW.email) THEN
        INSERT INTO users (
            id,
            email, 
            full_name,
            role,
            location_ids
        ) VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
            'scanner', -- Default role, admins can change this
            ARRAY[]::INTEGER[] -- No locations by default, admins assign
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create user profiles for Google OAuth users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_google_auth_user();

SELECT '✅ CLEAN SCHEMA CREATED - Google SSO ready!' as status;
SELECT 'Next: Run 02_rls_policies.sql' as next_step;