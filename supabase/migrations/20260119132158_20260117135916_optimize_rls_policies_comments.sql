/*
  # Optimize RLS Policies - Comments

  ## Overview
  Optimizes RLS policies for comments table

  ## Changes
  Updates RLS policies to use (select auth.uid()) for better performance
*/

DROP POLICY IF EXISTS "Users can read comments on their projects or shareable designs" ON comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON comments;
DROP POLICY IF EXISTS "Users can update own comments" ON comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON comments;

CREATE POLICY "Users can read comments on their projects or shareable designs"
  ON comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designs
      JOIN projects ON designs.project_id = projects.id
      WHERE designs.id = comments.design_id
      AND (
        projects.user_id = (select auth.uid())
        OR designs.shareable_token IS NOT NULL
      )
    )
  );

CREATE POLICY "Authenticated users can create comments"
  ON comments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM designs
      WHERE designs.id = comments.design_id
    )
  );

CREATE POLICY "Users can update own comments"
  ON comments FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own comments"
  ON comments FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);