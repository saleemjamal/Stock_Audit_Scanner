-- Fix barcode column to allow any length
-- Remove any length restrictions on inventory_items.barcode

-- Drop existing barcode column if it has length restrictions and recreate as TEXT
-- This is safe because we're going from restricted to unrestricted

-- First check if barcode column exists and its current type
-- If it's VARCHAR with length restriction, we need to alter it

-- Alter the barcode column to TEXT (unlimited length)
ALTER TABLE inventory_items 
ALTER COLUMN barcode TYPE TEXT;

-- Ensure the column allows any length barcode
COMMENT ON COLUMN inventory_items.barcode IS 'Product barcode - any length allowed';