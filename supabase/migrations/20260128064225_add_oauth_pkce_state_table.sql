/*
  # Add OAuth PKCE State Table

  ## Overview
  This migration creates the oauth_pkce_state table required for secure OAuth 2.0 
  PKCE (Proof Key for Code Exchange) authentication flows.

  ## New Tables

  ### 1. `oauth_pkce_state`
  Stores temporary PKCE state and code verifiers during OAuth flows
    - `id` (uuid, primary key)
    - `state` (text, unique random string for CSRF protection)
    - `code_verifier` (text, PKCE code verifier)
    - `user_id` (uuid, the user initiating the OAuth flow)
    - `provider` (text, e.g., 'figma', 'slack')
    - `expires_at` (timestamptz, when this state expires)
    - `created_at` (timestamptz)

  ## Security
    - Enable RLS on the table
    - Service role can access all records (needed for edge functions)
    - Users can only view their own pending states
    - States auto-expire after 10 minutes

  ## Notes
    - This table is used by figma-oauth-start and figma-oauth-callback functions
    - Records should be deleted after successful OAuth completion
*/

CREATE TABLE IF NOT EXISTS oauth_pkce_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text UNIQUE NOT NULL,
  code_verifier text NOT NULL,
  user_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'figma',
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE oauth_pkce_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own PKCE states"
  ON oauth_pkce_state FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_oauth_pkce_state_state ON oauth_pkce_state(state);
CREATE INDEX IF NOT EXISTS idx_oauth_pkce_state_user_id ON oauth_pkce_state(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_pkce_state_expires_at ON oauth_pkce_state(expires_at);
