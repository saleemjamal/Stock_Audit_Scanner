-- Add-Ons System - Database Schema
-- For documenting items without barcodes found during audit
-- Created: August 18, 2025

-- Create add_on_items table
CREATE TABLE add_on_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_session_id UUID NOT NULL REFERENCES audit_sessions(id) ON DELETE CASCADE,
  location_id INTEGER NOT NULL REFERENCES locations(id),
  
  -- Item Details
  brand VARCHAR(255) NOT NULL,
  item_name VARCHAR(500) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reason TEXT NOT NULL, -- Why this item needs to be added
  cost_price DECIMAL(10,2), -- Optional
  selling_price DECIMAL(10,2), -- Optional
  
  -- Image
  image_url TEXT, -- Supabase Storage URL (1 image required)
  
  -- Workflow
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  
  -- Timestamps and User Tracking
  reported_by UUID NOT NULL REFERENCES users(id),
  reported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Approval/Rejection
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT, -- Required if status = 'rejected'
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_add_on_items_audit_session ON add_on_items(audit_session_id);
CREATE INDEX idx_add_on_items_location ON add_on_items(location_id);
CREATE INDEX idx_add_on_items_status ON add_on_items(status);
CREATE INDEX idx_add_on_items_reported_by ON add_on_items(reported_by);
CREATE INDEX idx_add_on_items_reviewed_by ON add_on_items(reviewed_by);

-- Add update trigger for updated_at
CREATE OR REPLACE FUNCTION update_add_on_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_add_on_items_updated_at
    BEFORE UPDATE ON add_on_items
    FOR EACH ROW
    EXECUTE FUNCTION update_add_on_items_updated_at();

-- Grant permissions
GRANT ALL ON add_on_items TO authenticated;

-- Disable RLS for now (using Google OAuth + whitelisting for security)
-- Will follow same approach as damage system
ALTER TABLE add_on_items DISABLE ROW LEVEL SECURITY;