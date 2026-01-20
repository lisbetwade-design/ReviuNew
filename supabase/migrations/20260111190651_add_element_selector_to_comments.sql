/*
  # Add Element Selector to Comments

  1. Changes
    - Add `element_selector` column to `comments` table to store CSS selector or XPath
    - Add `element_text` column to store a snippet of the element's text content for fallback identification
    - Add index on element_selector for faster queries

  2. Purpose
    - Enable comments to be tied to specific UI elements, not just coordinates
    - Allow intelligent re-targeting if element moves but still exists
    - Provide better context for what is being commented on
*/

-- Add element_selector column to store CSS selector or XPath
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comments' AND column_name = 'element_selector'
  ) THEN
    ALTER TABLE comments ADD COLUMN element_selector text;
  END IF;
END $$;

-- Add element_text column for fallback identification
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comments' AND column_name = 'element_text'
  ) THEN
    ALTER TABLE comments ADD COLUMN element_text text;
  END IF;
END $$;

-- Add index for faster element-based queries
CREATE INDEX IF NOT EXISTS idx_comments_element_selector ON comments(element_selector);

-- Add comment explaining the columns
COMMENT ON COLUMN comments.element_selector IS 'CSS selector or XPath identifying the UI element this comment is attached to';
COMMENT ON COLUMN comments.element_text IS 'Text content snippet of the element for fallback identification';
