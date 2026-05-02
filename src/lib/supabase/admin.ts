import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { isSupabaseAdminConfigured } from "@/lib/env";

export function createAdminSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseAdminConfigured()) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
