-- Supabase Storage Bucket Setup for Damage Photos
-- Run in Supabase SQL Editor after creating the bucket manually

-- Create storage bucket (do this manually in Supabase Dashboard first)
-- Navigate to: Storage > Create new bucket
-- Bucket name: damage-photos
-- Public: YES (checked)
-- Then run the policies below:

-- Set up storage policies for damage photos bucket
CREATE POLICY "Authenticated users can upload damage photos" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'damage-photos');

CREATE POLICY "Public read access for damage photos" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'damage-photos');

CREATE POLICY "Users can update their own damage photos" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'damage-photos');

CREATE POLICY "Super users can delete damage photos" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
    bucket_id = 'damage-photos' 
    AND EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role = 'superuser'
    )
);

-- Comments
COMMENT ON POLICY "Authenticated users can upload damage photos" ON storage.objects 
IS 'Allow authenticated users to upload damage photos during reporting';

COMMENT ON POLICY "Public read access for damage photos" ON storage.objects 
IS 'Allow public read access for damage photo URLs in approval interface';

COMMENT ON POLICY "Super users can delete damage photos" ON storage.objects 
IS 'Only super users can delete damage photos for data retention management';