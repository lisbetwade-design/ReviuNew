/*
  # Optimize RLS Policies - Figma Tables

  ## Overview
  Optimizes RLS policies for figma_connections, figma_tracked_files, and figma_sync_preferences tables

  ## Changes
  Updates RLS policies to use (select auth.uid()) for better performance
*/

-- Figma Connections Table
DROP POLICY IF EXISTS "Users can view own Figma connection" ON figma_connections;
DROP POLICY IF EXISTS "Users can create own Figma connection" ON figma_connections;
DROP POLICY IF EXISTS "Users can update own Figma connection" ON figma_connections;
DROP POLICY IF EXISTS "Users can delete own Figma connection" ON figma_connections;

CREATE POLICY "Users can view own Figma connection"
  ON figma_connections FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create own Figma connection"
  ON figma_connections FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own Figma connection"
  ON figma_connections FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own Figma connection"
  ON figma_connections FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Figma Tracked Files Table
DROP POLICY IF EXISTS "Users can view own tracked files" ON figma_tracked_files;
DROP POLICY IF EXISTS "Users can create own tracked files" ON figma_tracked_files;
DROP POLICY IF EXISTS "Users can update own tracked files" ON figma_tracked_files;
DROP POLICY IF EXISTS "Users can delete own tracked files" ON figma_tracked_files;

CREATE POLICY "Users can view own tracked files"
  ON figma_tracked_files FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create own tracked files"
  ON figma_tracked_files FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own tracked files"
  ON figma_tracked_files FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own tracked files"
  ON figma_tracked_files FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Figma Sync Preferences Table
DROP POLICY IF EXISTS "Users can view own sync preferences" ON figma_sync_preferences;
DROP POLICY IF EXISTS "Users can create own sync preferences" ON figma_sync_preferences;
DROP POLICY IF EXISTS "Users can update own sync preferences" ON figma_sync_preferences;
DROP POLICY IF EXISTS "Users can delete own sync preferences" ON figma_sync_preferences;

CREATE POLICY "Users can view own sync preferences"
  ON figma_sync_preferences FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create own sync preferences"
  ON figma_sync_preferences FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own sync preferences"
  ON figma_sync_preferences FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own sync preferences"
  ON figma_sync_preferences FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);