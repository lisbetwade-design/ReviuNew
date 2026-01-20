/*
  # Optimize RLS Policies - Feedback Summaries and Design Folders

  ## Overview
  Optimizes RLS policies for feedback_summaries and design_folders tables

  ## Changes
  Updates RLS policies to use (select auth.uid()) for better performance
*/

-- Feedback Summaries Table
DROP POLICY IF EXISTS "Users can view summaries for own projects" ON feedback_summaries;
DROP POLICY IF EXISTS "Users can create summaries for own projects" ON feedback_summaries;

CREATE POLICY "Users can view summaries for own projects"
  ON feedback_summaries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designs
      JOIN projects ON designs.project_id = projects.id
      WHERE designs.id = feedback_summaries.design_id
      AND projects.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can create summaries for own projects"
  ON feedback_summaries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM designs
      JOIN projects ON designs.project_id = projects.id
      WHERE designs.id = feedback_summaries.design_id
      AND projects.user_id = (select auth.uid())
    )
  );

-- Design Folders Table
DROP POLICY IF EXISTS "Users can read folders in their projects" ON design_folders;
DROP POLICY IF EXISTS "Users can create folders in their projects" ON design_folders;
DROP POLICY IF EXISTS "Users can update folders in their projects" ON design_folders;
DROP POLICY IF EXISTS "Users can delete folders in their projects" ON design_folders;

CREATE POLICY "Users can read folders in their projects"
  ON design_folders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = design_folders.project_id
      AND projects.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can create folders in their projects"
  ON design_folders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = design_folders.project_id
      AND projects.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update folders in their projects"
  ON design_folders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = design_folders.project_id
      AND projects.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = design_folders.project_id
      AND projects.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete folders in their projects"
  ON design_folders FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = design_folders.project_id
      AND projects.user_id = (select auth.uid())
    )
  );
