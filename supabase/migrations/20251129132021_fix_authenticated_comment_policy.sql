/*
  # Fix Authenticated User Comment Insertion Policy

  ## Changes
  
  1. Policy Updates
    - Drop and recreate the authenticated user comment insertion policy
    - Verify user_id matches auth.uid()
    - Verify user has access to the design (design belongs to their project)
  
  ## Purpose
  - Fix issue where authenticated users cannot create comments
  - Ensure users can only comment on designs in their own projects
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Authenticated users can create comments" ON comments;

-- Recreate with proper access checks
CREATE POLICY "Authenticated users can create comments"
  ON comments FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User must be creating comment as themselves
    auth.uid() = user_id
    -- User must have access to the design (design belongs to their project)
    AND EXISTS (
      SELECT 1 FROM designs
      JOIN projects ON designs.project_id = projects.id
      WHERE designs.id = design_id
      AND projects.user_id = auth.uid()
    )
  );

