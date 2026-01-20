/*
  # Optimize RLS Policies - Designs

  ## Overview
  Optimizes RLS policies for designs table

  ## Changes
  Updates RLS policies to use (select auth.uid()) for better performance
*/

DROP POLICY IF EXISTS "Users can view designs in own projects" ON designs;
DROP POLICY IF EXISTS "Users can create designs in own projects" ON designs;
DROP POLICY IF EXISTS "Users can update designs in own projects" ON designs;
DROP POLICY IF EXISTS "Users can delete designs in own projects" ON designs;

CREATE POLICY "Users can view designs in own projects"
  ON designs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = designs.project_id
      AND projects.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can create designs in own projects"
  ON designs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = designs.project_id
      AND projects.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update designs in own projects"
  ON designs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = designs.project_id
      AND projects.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = designs.project_id
      AND projects.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete designs in own projects"
  ON designs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = designs.project_id
      AND projects.user_id = (select auth.uid())
    )
  );
