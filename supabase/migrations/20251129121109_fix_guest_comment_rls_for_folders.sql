/*
  # Fix Guest Comment Policy for Folder Designs

  ## Changes
  
  1. Policy Updates
    - Drop and recreate the guest comment insertion policy
    - Allow comments on designs that are directly shareable
    - Allow comments on designs that belong to shareable folders
  
  ## Purpose
  - Fix issue where guests cannot submit comments on designs in shareable folders
  - Designs can be shareable individually OR as part of a folder
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Guests can create comments on shareable designs" ON comments;

-- Recreate with support for both individual and folder-based sharing
CREATE POLICY "Guests can create comments on shareable designs"
  ON comments FOR INSERT
  TO anon
  WITH CHECK (
    -- User must be anonymous (no user_id)
    user_id IS NULL
    -- Must provide author name
    AND author_name IS NOT NULL
    AND author_name != ''
    -- Design must be shareable (either directly or via folder)
    AND (
      -- Design has its own shareable token
      EXISTS (
        SELECT 1 FROM designs
        WHERE designs.id = design_id
        AND designs.shareable_token IS NOT NULL
      )
      OR
      -- Design is in a folder with a shareable token
      EXISTS (
        SELECT 1 FROM designs
        JOIN design_folders ON designs.folder_id = design_folders.id
        WHERE designs.id = design_id
        AND design_folders.shareable_token IS NOT NULL
      )
    )
  );

-- Also update the read policy for consistency
DROP POLICY IF EXISTS "Public can read comments on shareable designs" ON comments;

CREATE POLICY "Public can read comments on shareable designs"
  ON comments FOR SELECT
  TO anon
  USING (
    -- Comment is on a shareable design (directly or via folder)
    EXISTS (
      SELECT 1 FROM designs
      WHERE designs.id = design_id
      AND designs.shareable_token IS NOT NULL
    )
    OR
    EXISTS (
      SELECT 1 FROM designs
      JOIN design_folders ON designs.folder_id = design_folders.id
      WHERE designs.id = design_id
      AND design_folders.shareable_token IS NOT NULL
    )
  );
