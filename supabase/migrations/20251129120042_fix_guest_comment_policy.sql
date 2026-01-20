/*
  # Fix Guest Comment Insertion Policy

  ## Changes
  
  1. Policy Updates
    - Drop and recreate the guest comment insertion policy
    - Make it more explicit about NULL user_id requirement
    - Ensure proper design validation
  
  ## Purpose
  - Fix issue where guests cannot submit comments from shareable links
  - Ensure RLS policy correctly validates shareable designs
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Guests can create comments on shareable designs" ON comments;

-- Recreate with more explicit checks
CREATE POLICY "Guests can create comments on shareable designs"
  ON comments FOR INSERT
  TO anon
  WITH CHECK (
    -- User must be anonymous (no user_id)
    user_id IS NULL
    -- Must provide author name
    AND author_name IS NOT NULL
    AND author_name != ''
    -- Design must have a shareable token
    AND EXISTS (
      SELECT 1 FROM designs
      WHERE designs.id = design_id
      AND designs.shareable_token IS NOT NULL
    )
  );
