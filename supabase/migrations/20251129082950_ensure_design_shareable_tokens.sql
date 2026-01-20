/*
  # Ensure Shareable Tokens for All Designs

  ## Changes
  
  1. Modifications to `designs` table
    - Ensure shareable_token has a default value for all new designs
    - Update existing designs without tokens to have tokens
  
  ## Purpose
  - Every design should be shareable by default
  - Stakeholders can access individual design feedback pages
*/

-- Update existing designs without shareable tokens
UPDATE designs
SET shareable_token = encode(gen_random_bytes(32), 'base64')
WHERE shareable_token IS NULL;

-- Ensure future designs always get a shareable token
DO $$
BEGIN
  -- Check if the column has a default
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'designs' 
    AND column_name = 'shareable_token'
    AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE designs 
    ALTER COLUMN shareable_token 
    SET DEFAULT encode(gen_random_bytes(32), 'base64');
  END IF;
END $$;
