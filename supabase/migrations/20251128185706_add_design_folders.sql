/*
  # Add Design Folders

  ## Changes
  
  1. New Tables
    - `design_folders`
      - `id` (uuid, primary key)
      - `project_id` (uuid, foreign key to projects)
      - `name` (text, folder name)
      - `description` (text, nullable)
      - `shareable_token` (text, unique, for public sharing)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Modifications to `designs` table
    - Add `folder_id` (uuid, nullable, foreign key to design_folders)
    - Designs can now belong to a folder
  
  3. Security
    - Enable RLS on design_folders table
    - Users can manage folders in their own projects
    - Public can view folders via shareable token
  
  ## Purpose
  - Group multiple designs into folders
  - Share entire folders with stakeholders
  - Collect feedback on multiple designs at once
*/

-- Create design_folders table
CREATE TABLE IF NOT EXISTS design_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  shareable_token text UNIQUE DEFAULT encode(gen_random_bytes(32), 'base64'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add folder_id to designs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'designs' AND column_name = 'folder_id'
  ) THEN
    ALTER TABLE designs ADD COLUMN folder_id uuid REFERENCES design_folders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS design_folders_project_id_idx ON design_folders(project_id);
CREATE INDEX IF NOT EXISTS design_folders_shareable_token_idx ON design_folders(shareable_token);
CREATE INDEX IF NOT EXISTS designs_folder_id_idx ON designs(folder_id);

-- Enable RLS
ALTER TABLE design_folders ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read folders in their projects
CREATE POLICY "Users can read folders in their projects"
  ON design_folders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = design_folders.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Policy: Users can create folders in their projects
CREATE POLICY "Users can create folders in their projects"
  ON design_folders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = design_folders.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Policy: Users can update folders in their projects
CREATE POLICY "Users can update folders in their projects"
  ON design_folders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = design_folders.project_id
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = design_folders.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Policy: Users can delete folders in their projects
CREATE POLICY "Users can delete folders in their projects"
  ON design_folders FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = design_folders.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Policy: Public can read folders via shareable token
CREATE POLICY "Public can read folders via shareable token"
  ON design_folders FOR SELECT
  TO anon
  USING (shareable_token IS NOT NULL);

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_design_folders_updated_at ON design_folders;
CREATE TRIGGER update_design_folders_updated_at
  BEFORE UPDATE ON design_folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
