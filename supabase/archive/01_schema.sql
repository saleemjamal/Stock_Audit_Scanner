-- Stock Audit Scanner System - Database Schema
-- Execute this in Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Locations table
CREATE TABLE locations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  address TEXT,
  city VARCHAR(50),
  state VARCHAR(20),
  zip_code VARCHAR(10),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(100),
  role VARCHAR(20) DEFAULT 'scanner' CHECK (role IN ('scanner', 'supervisor', 'admin')),
  location_ids INTEGER[] DEFAULT '{}', -- Array of location IDs user can access
  device_id VARCHAR(50), -- For scanner users
  active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Audit sessions table
CREATE TABLE audit_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id INTEGER REFERENCES locations(id),
  total_rack_count INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'setup' CHECK (status IN ('setup', 'active', 'completed', 'cancelled')),
  started_at TIMESTAMP,
  started_by UUID REFERENCES users(id),
  completed_at TIMESTAMP,
  completed_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Racks table (auto-generated when audit starts)
CREATE TABLE racks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_session_id UUID REFERENCES audit_sessions(id) ON DELETE CASCADE,
  location_id INTEGER REFERENCES locations(id),
  rack_number VARCHAR(50) NOT NULL,
  shelf_number VARCHAR(50),
  status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'scanning', 'ready_for_approval', 'approved', 'rejected')),
  scanner_id UUID REFERENCES users(id),
  assigned_at TIMESTAMP,
  ready_for_approval BOOLEAN DEFAULT FALSE,
  ready_at TIMESTAMP,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  rejected_by UUID REFERENCES users(id),
  rejected_at TIMESTAMP,
  rejection_reason TEXT,
  total_scans INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Scans table (individual barcode scans)
CREATE TABLE scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode VARCHAR(50) NOT NULL,
  rack_id UUID REFERENCES racks(id) ON DELETE CASCADE,
  audit_session_id UUID REFERENCES audit_sessions(id) ON DELETE CASCADE,
  scanner_id UUID REFERENCES users(id),
  device_id VARCHAR(50),
  quantity INTEGER DEFAULT 1,
  is_recount BOOLEAN DEFAULT FALSE,
  recount_of UUID REFERENCES scans(id), -- Links to original scan if this is a recount
  manual_entry BOOLEAN DEFAULT FALSE, -- True if manually entered vs scanned
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('approval_needed', 'rack_approved', 'rack_rejected', 'audit_completed')),
  title VARCHAR(200) NOT NULL,
  message TEXT,
  rack_id UUID REFERENCES racks(id),
  audit_session_id UUID REFERENCES audit_sessions(id),
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Audit log table (for tracking all actions)
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Sync queue table (for offline mobile app)
CREATE TABLE sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id VARCHAR(50) NOT NULL,
  data_type VARCHAR(50) NOT NULL CHECK (data_type IN ('scan', 'rack_update', 'user_action')),
  payload JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_location_ids ON users USING GIN(location_ids);
CREATE INDEX idx_audit_sessions_location ON audit_sessions(location_id);
CREATE INDEX idx_audit_sessions_status ON audit_sessions(status);
CREATE INDEX idx_racks_audit_session ON racks(audit_session_id);
CREATE INDEX idx_racks_status ON racks(status);
CREATE INDEX idx_racks_scanner ON racks(scanner_id);
CREATE INDEX idx_scans_rack ON scans(rack_id);
CREATE INDEX idx_scans_barcode ON scans(barcode);
CREATE INDEX idx_scans_created_at ON scans(created_at);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_sync_queue_device ON sync_queue(device_id);
CREATE INDEX idx_sync_queue_status ON sync_queue(status);

-- Add updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_audit_sessions_updated_at BEFORE UPDATE ON audit_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_racks_updated_at BEFORE UPDATE ON racks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();