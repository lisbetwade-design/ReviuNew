/*
  # Add Integration Settings to Profiles

  ## Changes
  
  1. Add integration columns to profiles table
    - `figma_token` (text, encrypted token for Figma API)
    - `slack_webhook_url` (text, webhook URL for Slack notifications)
    - `slack_channel` (text, Slack channel name)
  
  ## Purpose
  - Store user integration settings for Figma and Slack
  - Enable automated imports and notifications
  
  ## Security
  - All integration fields are nullable
  - Only profile owners can read/write their integration settings
*/

-- Add integration columns to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'figma_token'
  ) THEN
    ALTER TABLE profiles ADD COLUMN figma_token text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'slack_webhook_url'
  ) THEN
    ALTER TABLE profiles ADD COLUMN slack_webhook_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'slack_channel'
  ) THEN
    ALTER TABLE profiles ADD COLUMN slack_channel text;
  END IF;
END $$;
