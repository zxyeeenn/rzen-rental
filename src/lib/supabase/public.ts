import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { isSupabasePublicConfigured } from "@/lib/env";

export function createPublicSupabaseClient(): SupabaseClient | null {
  if (!isSupabasePublicConfigured()) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
