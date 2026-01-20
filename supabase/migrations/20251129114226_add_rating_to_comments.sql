/*
  # Add Rating Field to Comments

  ## Changes
  
  1. Schema Changes
    - Add `rating` column to comments table (integer, 1-5)
    - Add check constraint to ensure rating is between 1 and 5
  
  ## Purpose
  - Store emoji ratings with feedback comments
  - Allow stakeholders to rate designs (1-5 scale)
*/

-- Add rating column to comments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comments' AND column_name = 'rating'
  ) THEN
    ALTER TABLE comments ADD COLUMN rating integer CHECK (rating >= 1 AND rating <= 5);
  END IF;
END $$;

-- Create index for rating queries
CREATE INDEX IF NOT EXISTS comments_rating_idx ON comments(rating) WHERE rating IS NOT NULL;
