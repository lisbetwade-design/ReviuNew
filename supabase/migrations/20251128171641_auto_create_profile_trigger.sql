/*
  # Add trigger to automatically create profiles

  ## Changes
  
  1. Create a trigger function that automatically creates a profile when a new user signs up
  2. Attach the trigger to auth.users table
  
  ## Purpose
  - Ensures every authenticated user has a corresponding profile
  - Prevents foreign key constraint violations
  - Maintains data consistency
  
  ## Security
  - Function runs with security definer privileges
  - Only creates profiles for new users
*/

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO NOTHING;
  
  RETURN new;
END;
$$;

-- Create trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
