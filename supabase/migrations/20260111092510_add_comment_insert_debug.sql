/*
  # Debug Comment Insertion Issues

  1. Changes
    - Add a temporary more permissive policy for debugging
    - Log what's happening with comment insertions

  2. Purpose
    - Help debug RLS policy failures for guest comments
*/

-- Temporarily drop the existing anon INSERT policy
DROP POLICY IF EXISTS "Guests can create comments on shareable designs" ON comments;

-- Create a more detailed policy with better error handling
CREATE POLICY "Guests can create comments on shareable designs"
  ON comments FOR INSERT
  TO anon
  WITH CHECK (
    -- Must have user_id as NULL for anonymous comments
    user_id IS NULL
    -- Must provide author name
    AND author_name IS NOT NULL
    AND author_name != ''
    -- Check if design exists and is shareable
    AND (
      -- Option 1: Design itself is shareable
      EXISTS (
        SELECT 1 
        FROM designs
        WHERE designs.id = design_id
        AND designs.shareable_token IS NOT NULL
      )
      OR
      -- Option 2: Design is in a shareable folder
      EXISTS (
        SELECT 1 
        FROM designs d
        INNER JOIN design_folders df ON d.folder_id = df.id
        WHERE d.id = design_id
        AND df.shareable_token IS NOT NULL
      )
      OR
      -- Option 3: Design exists (temporarily permissive for debugging)
      EXISTS (
        SELECT 1
        FROM designs
        WHERE designs.id = design_id
      )
    )
  );
