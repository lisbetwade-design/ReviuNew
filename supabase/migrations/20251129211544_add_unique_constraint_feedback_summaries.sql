/*
  # Add Unique Constraint to Feedback Summaries

  ## Changes
  
  1. Schema Updates
    - Add unique constraint on (project_id, design_id) to prevent duplicate summaries
    - This allows using ON CONFLICT for upsert operations
  
  ## Purpose
  - Prevent duplicate summaries for the same design
  - Enable upsert operations when generating summaries
  - Fix "no unique or exclusion constraint" error
*/

-- Add unique constraint on project_id and design_id
-- This ensures one summary per design per project
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'feedback_summaries_project_design_unique'
  ) THEN
    ALTER TABLE feedback_summaries
    ADD CONSTRAINT feedback_summaries_project_design_unique
    UNIQUE (project_id, design_id);
  END IF;
END $$;

