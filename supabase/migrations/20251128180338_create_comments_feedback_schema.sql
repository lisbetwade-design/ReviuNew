/*
  # Create Comments and Feedback Schema

  ## Changes
  
  1. New Tables
    - `comments`
      - `id` (uuid, primary key)
      - `design_id` (uuid, foreign key to designs)
      - `user_id` (uuid, foreign key to profiles, nullable for guest feedback)
      - `author_name` (text, for guest comments)
      - `author_email` (text, for guest comments)
      - `content` (text, comment content)
      - `x_position` (numeric, nullable, for pinned comments)
      - `y_position` (numeric, nullable, for pinned comments)
      - `status` (text, default 'open', can be 'open', 'resolved', 'archived')
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on comments table
    - Users can read comments on their own designs
    - Users can create comments on any design they have access to
    - Users can update/delete their own comments
    - Guest users (with shareable link) can create comments
  
  ## Purpose
  - Store feedback and comments on design files
  - Support both authenticated users and guest feedback
  - Enable pinned comments at specific coordinates
  - Track comment status for workflow management
*/

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id uuid NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  author_name text,
  author_email text,
  content text NOT NULL,
  x_position numeric,
  y_position numeric,
  status text DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'archived')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS comments_design_id_idx ON comments(design_id);
CREATE INDEX IF NOT EXISTS comments_user_id_idx ON comments(user_id);
CREATE INDEX IF NOT EXISTS comments_status_idx ON comments(status);

-- Enable RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read comments on designs in their projects
CREATE POLICY "Users can read comments on their projects"
  ON comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designs
      JOIN projects ON designs.project_id = projects.id
      WHERE designs.id = comments.design_id
      AND projects.user_id = auth.uid()
    )
  );

-- Policy: Authenticated users can create comments
CREATE POLICY "Authenticated users can create comments"
  ON comments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
  );

-- Policy: Users can update their own comments
CREATE POLICY "Users can update own comments"
  ON comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own comments
CREATE POLICY "Users can delete own comments"
  ON comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Anyone can read comments on designs with shareable tokens (for public feedback)
CREATE POLICY "Public can read comments on shareable designs"
  ON comments FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM designs
      WHERE designs.id = comments.design_id
      AND designs.shareable_token IS NOT NULL
    )
  );

-- Policy: Guests can create comments on shareable designs
CREATE POLICY "Guests can create comments on shareable designs"
  ON comments FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM designs
      WHERE designs.id = comments.design_id
      AND designs.shareable_token IS NOT NULL
    )
    AND user_id IS NULL
    AND author_name IS NOT NULL
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_comments_updated_at ON comments;
CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
