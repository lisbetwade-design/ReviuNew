/*
  # Update RLS policies for standalone comments

  ## Overview
  Updates RLS policies to allow users to read and manage their own standalone comments
  (comments without design_id or project_id)

  ## Changes
  - Updates SELECT policy to allow reading comments created by the user
  - Updates INSERT policy to allow creating standalone comments
*/

DROP POLICY IF EXISTS "Users can read comments on their projects" ON comments;

CREATE POLICY "Users can read comments on their projects or own comments"
  ON comments FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) = created_by
    OR EXISTS (
      SELECT 1 FROM designs
      JOIN projects ON designs.project_id = projects.id
      WHERE designs.id = comments.design_id
      AND projects.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Authenticated users can create comments" ON comments;

CREATE POLICY "Authenticated users can create comments"
  ON comments FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = created_by
    OR (
      design_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM designs
        WHERE designs.id = comments.design_id
      )
    )
  );
