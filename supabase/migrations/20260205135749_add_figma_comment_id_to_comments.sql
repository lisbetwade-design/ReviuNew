/*
  # Add Figma Comment ID to Comments Table

  1. Changes
    - Add `figma_comment_id` column to track Figma comment IDs
    - This prevents duplicate syncing of the same Figma comments
    - Add index for faster lookups when syncing

  2. Notes
    - Column is nullable since not all comments come from Figma
    - Index on (source_channel, figma_comment_id) for efficient duplicate checking
*/

-- Add figma_comment_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comments' AND column_name = 'figma_comment_id'
  ) THEN
    ALTER TABLE comments ADD COLUMN figma_comment_id text;
  END IF;
END $$;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_comments_figma_id 
  ON comments(source_channel, figma_comment_id) 
  WHERE figma_comment_id IS NOT NULL;
