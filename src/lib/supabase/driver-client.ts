"use client";

import { createClient } from "@supabase/supabase-js";

// Create a Supabase client using service role key for driver verification
// This bypasses RLS policies and allows drivers to access necessary data
export function createDriverClient() {
  // For driver verification, we need to use service role key to bypass RLS
  // since drivers aren't authenticated Supabase users
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Disable automatic session persistence for security
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    }
  );
}