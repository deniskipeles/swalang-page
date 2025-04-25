import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

if (!PUBLIC_SUPABASE_URL || !PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error("Supabase URL or Anon Key is missing. Check your .env file.");
}

export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
    // Optional: Configure auth helper specifics if needed
    // auth: {
    //   storage: localStorage, // Default for browser
    //   autoRefreshToken: true,
    //   persistSession: true,
    //   detectSessionInUrl: true
    // }
});