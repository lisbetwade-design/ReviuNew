/*
  # Add Theme Field to Comments

  ## Changes
  
  1. Schema Changes
    - Add `theme` column to comments table (text)
    - Add check constraint to ensure theme is one of: 'usability', 'visuals', 'copy', 'development', 'other'
    - Set default value to 'other'
  
  ## Purpose
  - Categorize feedback by theme/topic
  - Enable analytics by feedback category
  - Support filtering and grouping feedback by theme
*/

-- Add theme column to comments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comments' AND column_name = 'theme'
  ) THEN
    ALTER TABLE comments ADD COLUMN theme text DEFAULT 'other' CHECK (theme IN ('usability', 'visuals', 'copy', 'development', 'other'));
  END IF;
END $$;

-- Create index for theme queries
CREATE INDEX IF NOT EXISTS comments_theme_idx ON comments(theme);
