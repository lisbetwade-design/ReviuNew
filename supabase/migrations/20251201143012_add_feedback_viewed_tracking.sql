/*
  # Add Feedback Viewed Tracking

  ## Changes
  
  1. Modifications to comments table
    - `viewed_at` (timestamptz, nullable) - tracks when the project owner viewed this feedback
  
  2. Purpose
    - Track which feedback items are new/unread
    - Enable visual indicators for new feedback
    - Allow marking feedback as "viewed"
*/

-- Add viewed_at column to comments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comments' AND column_name = 'viewed_at'
  ) THEN
    ALTER TABLE comments ADD COLUMN viewed_at timestamptz;
  END IF;
END $$;

-- Create index for faster queries on viewed status
CREATE INDEX IF NOT EXISTS comments_viewed_at_idx ON comments(viewed_at);