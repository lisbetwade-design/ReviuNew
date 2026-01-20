/*
  # Add Page URL Tracking to Comments

  1. Changes
    - Add `page_url` column to comments table to track the specific page/URL where feedback was given
    - This allows filtering comments by the current page being viewed in embedded content

  2. Purpose
    - Enable page-specific feedback for embedded URLs with multiple pages
    - Ensure comments only appear on the exact page where they were created
    - Support multi-page prototypes and websites
*/

-- Add page_url column to track the specific page where feedback was given
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comments' AND column_name = 'page_url'
  ) THEN
    ALTER TABLE comments ADD COLUMN page_url text;
  END IF;
END $$;

-- Create index for faster filtering by page_url
CREATE INDEX IF NOT EXISTS idx_comments_page_url ON comments(page_url);

-- Create index for combined design_id and page_url lookups
CREATE INDEX IF NOT EXISTS idx_comments_design_page ON comments(design_id, page_url);
