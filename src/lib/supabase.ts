import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Always returns a valid, non-expired session or throws.
export async function getValidSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw new Error('Failed to get session');
  if (!session) throw new Error('Not authenticated. Please sign in again.');

  const expiresAt = (session.expires_at ?? 0) * 1000;
  if (expiresAt - Date.now() < 60_000) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session) throw new Error('Session expired. Please sign in again.');
    return refreshed.session;
  }

  return session;
}
