/*
  # Fix Performance and Security Issues - Part 1

  ## Overview
  Adds missing foreign key indexes and fixes function search path

  ## Changes
  1. Add missing indexes for foreign keys
  2. Fix update_updated_at_column function with secure search path
*/

-- Add missing foreign key indexes
CREATE INDEX IF NOT EXISTS idx_board_items_design_id ON board_items(design_id);
CREATE INDEX IF NOT EXISTS idx_feedback_summaries_design_id ON feedback_summaries(design_id);

-- Fix function search path
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;
