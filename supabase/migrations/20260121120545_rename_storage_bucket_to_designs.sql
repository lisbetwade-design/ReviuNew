/*
  # Rename Storage Bucket from design-files to designs

  ## Changes
  
  1. Update bucket name from 'design-files' to 'designs'
  2. Update all storage policies to reference the new bucket name
  
  ## Security
  - All existing RLS policies are maintained with the new bucket name
  - Authenticated users can upload files
  - Files are publicly readable
  - Users can only update/delete their own files
*/

-- Drop existing policies first
DROP POLICY IF EXISTS "Authenticated users can upload design files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own design files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own design files" ON storage.objects;
DROP POLICY IF EXISTS "Public can read design files" ON storage.objects;

-- Update the bucket name
UPDATE storage.buckets 
SET id = 'designs', name = 'designs'
WHERE id = 'design-files';

-- Recreate policies with new bucket name
CREATE POLICY "Authenticated users can upload design files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'designs');

CREATE POLICY "Users can update own design files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'designs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own design files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'designs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public can read design files"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'designs');
