/*
  # Make project_id nullable in comments

  ## Overview
  Makes project_id optional in comments table to support standalone inbox messages from Slack

  ## Changes
  - Makes project_id column nullable in comments table
  - Allows comments to exist without being tied to a specific project or design
*/

ALTER TABLE comments ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE comments ALTER COLUMN design_id DROP NOT NULL;
