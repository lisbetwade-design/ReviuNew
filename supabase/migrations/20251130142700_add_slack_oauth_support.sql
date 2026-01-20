/*
  # Add Slack OAuth Support

  ## Changes

  1. Schema Updates
    - Add `slack_access_token` (text) - OAuth access token for Slack API
    - Add `slack_team_id` (text) - Slack workspace ID
    - Add `slack_team_name` (text) - Slack workspace name
    - Add `slack_connected_at` (timestamptz) - When Slack was connected
    
  ## Purpose
  - Enable easy Slack integration via OAuth
  - Store OAuth tokens securely in user profiles
  - Support multiple Slack workspaces per user
  
  ## Notes
  - Existing webhook fields remain for backward compatibility
  - OAuth tokens provide more secure access than webhooks
*/

-- Add Slack OAuth columns to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'slack_access_token'
  ) THEN
    ALTER TABLE profiles ADD COLUMN slack_access_token text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'slack_team_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN slack_team_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'slack_team_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN slack_team_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'slack_connected_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN slack_connected_at timestamptz;
  END IF;
END $$;
