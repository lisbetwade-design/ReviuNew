/*
  # Add Source Channel to Comments

  ## Changes

  1. Schema Updates
    - Add `source_channel` (text) to comments table - stores the Slack channel ID or name where the message originated
    - Add `source_channel_name` (text) to comments table - stores the human-readable channel name

  ## Purpose
  - Enable tracking of which Slack channel a comment/message came from
  - Allow users to see channel context in the inbox
  - Support better organization and filtering of Slack messages

  ## Notes
  - `source_channel` stores the channel ID (e.g., "C123456")
  - `source_channel_name` stores the display name (e.g., "design-feedback")
  - Both fields are nullable to support non-Slack comments
*/

-- Add source channel fields to comments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comments' AND column_name = 'source_channel'
  ) THEN
    ALTER TABLE comments ADD COLUMN source_channel text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comments' AND column_name = 'source_channel_name'
  ) THEN
    ALTER TABLE comments ADD COLUMN source_channel_name text;
  END IF;
END $$;

-- Create index for faster filtering by channel
CREATE INDEX IF NOT EXISTS comments_source_channel_idx ON comments(source_channel);
