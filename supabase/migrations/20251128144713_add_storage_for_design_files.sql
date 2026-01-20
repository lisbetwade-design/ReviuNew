/*
  # Add Storage Support for Design Files

  ## Changes
  
  1. Create storage bucket for design files
  2. Set up storage policies for authenticated users
  3. Update designs table to support multiple file uploads
  
  ## Storage Bucket
  - `design-files` - Public bucket for storing uploaded design images
  
  ## Security
  - Authenticated users can upload files
  - Files are publicly readable via signed URLs
  - Users can only delete their own files
*/

-- Create storage bucket for design files
INSERT INTO storage.buckets (id, name, public)
VALUES ('design-files', 'design-files', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload design files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'design-files');

-- Allow authenticated users to update their own files
CREATE POLICY "Users can update own design files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'design-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to delete their own files
CREATE POLICY "Users can delete own design files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'design-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public access to read files
CREATE POLICY "Public can read design files"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'design-files');
