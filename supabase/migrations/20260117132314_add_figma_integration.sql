/*
  # Figma Integration Schema

  ## Overview
  This migration adds support for Figma OAuth integration and comment tracking.

  ## New Tables

  ### 1. `figma_connections`
  Stores Figma OAuth tokens for each user
    - `id` (uuid, primary key)
    - `user_id` (uuid, foreign key to profiles)
    - `access_token` (text, encrypted)
    - `refresh_token` (text, encrypted)
    - `expires_at` (timestamptz)
    - `figma_user_id` (text)
    - `figma_user_email` (text)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ### 2. `figma_tracked_files`
  Stores Figma files that users want to track
    - `id` (uuid, primary key)
    - `user_id` (uuid, foreign key to profiles)
    - `project_id` (uuid, foreign key to projects)
    - `file_key` (text, Figma file identifier)
    - `file_name` (text)
    - `file_url` (text)
    - `last_synced_at` (timestamptz)
    - `sync_enabled` (boolean)
    - `webhook_id` (text, nullable)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ### 3. `figma_sync_preferences`
  Stores user preferences for comment syncing
    - `id` (uuid, primary key)
    - `user_id` (uuid, foreign key to profiles)
    - `tracked_file_id` (uuid, foreign key to figma_tracked_files)
    - `sync_all_comments` (boolean, default true)
    - `sync_only_mentions` (boolean, default false)
    - `sync_unresolved_only` (boolean, default false)
    - `notification_channels` (jsonb, array of channels)
    - `sync_frequency` (text, real-time/hourly/daily)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
*/

-- Create figma_connections table
CREATE TABLE IF NOT EXISTS figma_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  figma_user_id text NOT NULL,
  figma_user_email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE figma_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own Figma connection"
  ON figma_connections FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own Figma connection"
  ON figma_connections FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own Figma connection"
  ON figma_connections FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own Figma connection"
  ON figma_connections FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create figma_tracked_files table
CREATE TABLE IF NOT EXISTS figma_tracked_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  file_key text NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  last_synced_at timestamptz,
  sync_enabled boolean DEFAULT true,
  webhook_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, file_key)
);

ALTER TABLE figma_tracked_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tracked files"
  ON figma_tracked_files FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tracked files"
  ON figma_tracked_files FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tracked files"
  ON figma_tracked_files FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tracked files"
  ON figma_tracked_files FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create figma_sync_preferences table
CREATE TABLE IF NOT EXISTS figma_sync_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tracked_file_id uuid NOT NULL REFERENCES figma_tracked_files(id) ON DELETE CASCADE,
  sync_all_comments boolean DEFAULT true,
  sync_only_mentions boolean DEFAULT false,
  sync_unresolved_only boolean DEFAULT false,
  notification_channels jsonb DEFAULT '["in-app"]'::jsonb,
  sync_frequency text DEFAULT 'real-time',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tracked_file_id)
);

ALTER TABLE figma_sync_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync preferences"
  ON figma_sync_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sync preferences"
  ON figma_sync_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sync preferences"
  ON figma_sync_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sync preferences"
  ON figma_sync_preferences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_figma_connections_user_id ON figma_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_figma_tracked_files_user_id ON figma_tracked_files(user_id);
CREATE INDEX IF NOT EXISTS idx_figma_tracked_files_project_id ON figma_tracked_files(project_id);
CREATE INDEX IF NOT EXISTS idx_figma_sync_preferences_user_id ON figma_sync_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_figma_sync_preferences_tracked_file_id ON figma_sync_preferences(tracked_file_id);

-- Add update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_figma_connections_updated_at') THEN
    CREATE TRIGGER update_figma_connections_updated_at
      BEFORE UPDATE ON figma_connections
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_figma_tracked_files_updated_at') THEN
    CREATE TRIGGER update_figma_tracked_files_updated_at
      BEFORE UPDATE ON figma_tracked_files
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_figma_sync_preferences_updated_at') THEN
    CREATE TRIGGER update_figma_sync_preferences_updated_at
      BEFORE UPDATE ON figma_sync_preferences
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
