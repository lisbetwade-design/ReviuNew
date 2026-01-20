/*
  # Optimize RLS Policies - Feedback and Board Items

  ## Overview
  Optimizes RLS policies for feedback and board_items tables

  ## Changes
  Updates RLS policies to use (select auth.uid()) for better performance
*/

-- Feedback Table
DROP POLICY IF EXISTS "Users can view feedback on own designs" ON feedback;
DROP POLICY IF EXISTS "Users can update feedback on own designs" ON feedback;

CREATE POLICY "Users can view feedback on own designs"
  ON feedback FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designs
      JOIN projects ON designs.project_id = projects.id
      WHERE designs.id = feedback.design_id
      AND projects.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update feedback on own designs"
  ON feedback FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designs
      JOIN projects ON designs.project_id = projects.id
      WHERE designs.id = feedback.design_id
      AND projects.user_id = (select auth.uid())
    )
  );

-- Board Items Table
DROP POLICY IF EXISTS "Users can view own board items" ON board_items;
DROP POLICY IF EXISTS "Users can create board items" ON board_items;
DROP POLICY IF EXISTS "Users can update own board items" ON board_items;
DROP POLICY IF EXISTS "Users can delete own board items" ON board_items;

CREATE POLICY "Users can view own board items"
  ON board_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = board_items.project_id
      AND projects.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can create board items"
  ON board_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = board_items.project_id
      AND projects.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update own board items"
  ON board_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = board_items.project_id
      AND projects.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = board_items.project_id
      AND projects.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete own board items"
  ON board_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = board_items.project_id
      AND projects.user_id = (select auth.uid())
    )
  );
