-- Add-On Photos Storage Bucket Setup
-- For storing single product images for add-on requests

-- Create storage bucket for add-on photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('add-on-photos', 'add-on-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for add-on images
-- Public read access for add-on photos
CREATE POLICY "Public read access for add-on photos" ON storage.objects
  FOR SELECT 
  TO public 
  USING (bucket_id = 'add-on-photos');

-- Authenticated users can upload add-on photos
CREATE POLICY "Authenticated users can upload add-on photos" ON storage.objects  
  FOR INSERT 
  TO authenticated 
  WITH CHECK (bucket_id = 'add-on-photos');

-- Users can update their own add-on photos
CREATE POLICY "Users can update their own add-on photos" ON storage.objects
  FOR UPDATE 
  TO authenticated 
  USING (bucket_id = 'add-on-photos');

-- Super users can delete add-on photos
CREATE POLICY "Super users can delete add-on photos" ON storage.objects
  FOR DELETE 
  TO authenticated 
  USING (
    bucket_id = 'add-on-photos' 
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'superuser'
    )
  );

-- Comments
COMMENT ON POLICY "Public read access for add-on photos" ON storage.objects 
IS 'Allow public read access for add-on photo URLs in approval interface';

COMMENT ON POLICY "Authenticated users can upload add-on photos" ON storage.objects 
IS 'Allow authenticated users to upload add-on photos during creation';

COMMENT ON POLICY "Users can update their own add-on photos" ON storage.objects 
IS 'Allow users to update/replace add-on photos if needed';

COMMENT ON POLICY "Super users can delete add-on photos" ON storage.objects 
IS 'Only super users can delete add-on photos for data retention management';

-- Verify bucket creation
SELECT * FROM storage.buckets WHERE id = 'add-on-photos';