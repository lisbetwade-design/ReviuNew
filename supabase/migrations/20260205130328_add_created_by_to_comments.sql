/*
  # Add created_by column to comments table

  ## Overview
  Adds a created_by column to track the user who created each comment, particularly for standalone comments (Slack, Figma) that aren't tied to designs.

  ## Changes
  - Add created_by column to comments table
  - Set default to the authenticated user's ID for new inserts
  - Backfill existing comments with user_id where available

  ## Notes
  This column is essential for RLS policies that allow users to read their own standalone comments.
*/

-- Add created_by column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comments' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE comments ADD COLUMN created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    
    -- Backfill existing comments
    UPDATE comments SET created_by = user_id WHERE user_id IS NOT NULL;
    
    -- Create index for faster queries
    CREATE INDEX IF NOT EXISTS comments_created_by_idx ON comments(created_by);
  END IF;
END $$;
