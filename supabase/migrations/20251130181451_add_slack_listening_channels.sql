/*
  # Add Slack Listening Channels

  ## Changes

  1. Schema Updates
    - Add `slack_listening_channels` (text) - JSON array of channel IDs to listen for feedback
    
  ## Purpose
  - Enable users to select Slack channels to monitor for feedback
  - Store channel selections as JSON array for easy parsing
  - Support receiving feedback FROM Slack without webhook setup
  
  ## Notes
  - Stores channel IDs as JSON array ["C123", "C456"]
  - Used by slack-events edge function to filter incoming messages
*/

-- Add Slack listening channels column to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'slack_listening_channels'
  ) THEN
    ALTER TABLE profiles ADD COLUMN slack_listening_channels text;
  END IF;
END $$;
