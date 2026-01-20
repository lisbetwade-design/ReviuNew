/*
  # Fix Authenticated Users Commenting as Guests on Shareable Designs

  ## Changes
  
  1. Policy Updates
    - Allow authenticated users to create comments with user_id IS NULL on shareable designs
    - This allows logged-in users to leave anonymous feedback via shared links
    - Maintains security by only allowing this on shareable designs
  
  ## Purpose
  - Fix issue where authenticated users cannot leave feedback on public feedback pages
  - Public feedback pages set user_id to null for guest-style comments
  - Authenticated users should be able to comment as guests on shareable designs
*/

-- Drop existing authenticated user INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create comments" ON comments;

-- Recreate with support for guest-style comments (user_id IS NULL) on shareable designs
CREATE POLICY "Authenticated users can create comments"
  ON comments FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      -- Option 1: User is creating comment as themselves on their own designs
      auth.uid() = user_id
      AND EXISTS (
        SELECT 1 FROM designs
        JOIN projects ON designs.project_id = projects.id
        WHERE designs.id = design_id
        AND projects.user_id = auth.uid()
      )
    )
    OR
    (
      -- Option 2: User is creating comment as themselves on shareable designs
      auth.uid() = user_id
      AND (
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
      )
    )
    OR
    (
      -- Option 3: User is creating guest-style comment (user_id IS NULL) on shareable designs
      -- This allows authenticated users to leave anonymous feedback via shared links
      user_id IS NULL
      AND author_name IS NOT NULL
      AND author_name != ''
      AND (
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
      )
    )
  );




