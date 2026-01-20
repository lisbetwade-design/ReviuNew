/*
  # Reviu Database Schema

  ## Overview
  This migration creates the core database structure for Reviu, a feedback management platform for UX/UI designers.

  ## New Tables
  
  ### 1. `profiles`
  User profile information extending Supabase auth.users
  - `id` (uuid, primary key) - References auth.users
  - `email` (text) - User email
  - `full_name` (text) - User's full name
  - `created_at` (timestamptz) - Account creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 2. `projects`
  Design projects containing multiple design files
  - `id` (uuid, primary key) - Unique project identifier
  - `user_id` (uuid, foreign key) - Project owner
  - `name` (text) - Project name
  - `description` (text) - Project description
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 3. `designs`
  Individual design files within projects
  - `id` (uuid, primary key) - Unique design identifier
  - `project_id` (uuid, foreign key) - Parent project
  - `name` (text) - Design file name
  - `source_type` (text) - Type: 'manual', 'figma', 'slack'
  - `source_url` (text) - Original source URL (Figma link, etc)
  - `image_url` (text) - Stored image URL for manual uploads
  - `shareable_token` (text, unique) - Token for public feedback links
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 4. `feedback`
  Feedback and comments on designs
  - `id` (uuid, primary key) - Unique feedback identifier
  - `design_id` (uuid, foreign key) - Related design
  - `stakeholder_name` (text) - Name of person providing feedback
  - `stakeholder_email` (text) - Email of stakeholder
  - `stakeholder_role` (text) - Role: 'client', 'pm', 'developer', 'designer', 'other'
  - `content` (text) - Feedback content
  - `rating` (integer) - Design rating 1-5
  - `source_type` (text) - Source: 'manual', 'figma', 'slack'
  - `is_processed` (boolean) - Whether converted to board item
  - `created_at` (timestamptz) - Creation timestamp

  ### 5. `board_items`
  Kanban board items for tracking feedback actions
  - `id` (uuid, primary key) - Unique item identifier
  - `user_id` (uuid, foreign key) - Item owner
  - `project_id` (uuid, foreign key) - Related project
  - `design_id` (uuid, foreign key, nullable) - Related design if applicable
  - `title` (text) - Item title
  - `description` (text) - Item description
  - `status` (text) - Status: 'open', 'in_progress', 'under_review', 'resolved'
  - `priority` (text) - Priority: 'low', 'medium', 'high', 'critical'
  - `stakeholder_role` (text) - Role that raised this item
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 6. `feedback_summaries`
  AI-generated summaries of feedback
  - `id` (uuid, primary key) - Unique summary identifier
  - `project_id` (uuid, foreign key) - Related project
  - `design_id` (uuid, foreign key, nullable) - Related design if specific to one
  - `summary_data` (jsonb) - Structured summary with themes and action items
  - `created_at` (timestamptz) - Creation timestamp

  ## Security
  - Enable RLS on all tables
  - Users can only access their own data
  - Public access allowed for shareable feedback submission
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects"
  ON projects FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON projects FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create designs table
CREATE TABLE IF NOT EXISTS designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  source_type text NOT NULL DEFAULT 'manual',
  source_url text,
  image_url text,
  shareable_token text UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE designs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view designs in own projects"
  ON designs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = designs.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create designs in own projects"
  ON designs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = designs.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update designs in own projects"
  ON designs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = designs.project_id
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = designs.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete designs in own projects"
  ON designs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = designs.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Allow anonymous access to designs via shareable token (for feedback submission)
CREATE POLICY "Anyone can view designs with valid shareable token"
  ON designs FOR SELECT
  TO anon
  USING (shareable_token IS NOT NULL);

-- Create feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id uuid NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  stakeholder_name text NOT NULL,
  stakeholder_email text,
  stakeholder_role text NOT NULL DEFAULT 'other',
  content text NOT NULL,
  rating integer,
  source_type text NOT NULL DEFAULT 'manual',
  is_processed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view feedback on own designs"
  ON feedback FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designs
      JOIN projects ON projects.id = designs.project_id
      WHERE designs.id = feedback.design_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update feedback on own designs"
  ON feedback FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designs
      JOIN projects ON projects.id = designs.project_id
      WHERE designs.id = feedback.design_id
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM designs
      JOIN projects ON projects.id = designs.project_id
      WHERE designs.id = feedback.design_id
      AND projects.user_id = auth.uid()
    )
  );

-- Allow anonymous users to submit feedback via shareable links
CREATE POLICY "Anyone can submit feedback via shareable link"
  ON feedback FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM designs
      WHERE designs.id = feedback.design_id
      AND designs.shareable_token IS NOT NULL
    )
  );

-- Create board_items table
CREATE TABLE IF NOT EXISTS board_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  design_id uuid REFERENCES designs(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'medium',
  stakeholder_role text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE board_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own board items"
  ON board_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create board items"
  ON board_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own board items"
  ON board_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own board items"
  ON board_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create feedback_summaries table
CREATE TABLE IF NOT EXISTS feedback_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  design_id uuid REFERENCES designs(id) ON DELETE CASCADE,
  summary_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE feedback_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view summaries for own projects"
  ON feedback_summaries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = feedback_summaries.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create summaries for own projects"
  ON feedback_summaries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = feedback_summaries.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_designs_project_id ON designs(project_id);
CREATE INDEX IF NOT EXISTS idx_designs_shareable_token ON designs(shareable_token);
CREATE INDEX IF NOT EXISTS idx_feedback_design_id ON feedback(design_id);
CREATE INDEX IF NOT EXISTS idx_board_items_user_id ON board_items(user_id);
CREATE INDEX IF NOT EXISTS idx_board_items_project_id ON board_items(project_id);
CREATE INDEX IF NOT EXISTS idx_board_items_status ON board_items(status);
CREATE INDEX IF NOT EXISTS idx_feedback_summaries_project_id ON feedback_summaries(project_id);
