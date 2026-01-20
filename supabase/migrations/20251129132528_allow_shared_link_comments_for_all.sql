/*
  # Allow Everyone with Shared Link to Leave Feedback

  ## Changes
  
  1. Policy Updates
    - Update authenticated user comment INSERT policy to allow comments on shareable designs
    - Update authenticated user comment SELECT policy to allow reading comments on shareable designs
    - Users can comment on their own designs OR on any shareable design
    - This ensures both authenticated and anonymous users can leave feedback via shared links
  
  ## Purpose
  - Fix issue where authenticated users accessing via shared link cannot leave feedback
  - Ensure anyone with a shared link (authenticated or not) can leave feedback
  - Maintain security by only allowing comments on shareable designs
*/

-- Drop existing authenticated user policies
DROP POLICY IF EXISTS "Authenticated users can create comments" ON comments;
DROP POLICY IF EXISTS "Users can read comments on their projects" ON comments;

-- Recreate with support for both own designs and shareable designs
CREATE POLICY "Authenticated users can create comments"
  ON comments FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User must be creating comment as themselves
    auth.uid() = user_id
    AND (
      -- User can comment on designs in their own projects
      EXISTS (
        SELECT 1 FROM designs
        JOIN projects ON designs.project_id = projects.id
        WHERE designs.id = design_id
        AND projects.user_id = auth.uid()
      )
      OR
      -- User can also comment on any shareable design (via shared link)
      EXISTS (
        SELECT 1 FROM designs
        WHERE designs.id = design_id
        AND designs.shareable_token IS NOT NULL
      )
      OR
      -- User can comment on designs in shareable folders
      EXISTS (
        SELECT 1 FROM designs
        JOIN design_folders ON designs.folder_id = design_folders.id
        WHERE designs.id = design_id
        AND design_folders.shareable_token IS NOT NULL
      )
    )
  );

-- Update read policy to allow authenticated users to read comments on shareable designs
CREATE POLICY "Users can read comments on their projects or shareable designs"
  ON comments FOR SELECT
  TO authenticated
  USING (
    -- User can read comments on designs in their own projects
    EXISTS (
      SELECT 1 FROM designs
      JOIN projects ON designs.project_id = projects.id
      WHERE designs.id = comments.design_id
      AND projects.user_id = auth.uid()
    )
    OR
    -- User can also read comments on shareable designs (via shared link)
    EXISTS (
      SELECT 1 FROM designs
      WHERE designs.id = comments.design_id
      AND designs.shareable_token IS NOT NULL
    )
    OR
    -- User can read comments on designs in shareable folders
    EXISTS (
      SELECT 1 FROM designs
      JOIN design_folders ON designs.folder_id = design_folders.id
      WHERE designs.id = comments.design_id
      AND design_folders.shareable_token IS NOT NULL
    )
  );

