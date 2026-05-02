import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";

import { isSupabasePublicConfigured } from "@/lib/env";

export async function createServerSupabaseClient() {
  if (!isSupabasePublicConfigured()) {
    throw new Error(
      "Supabase URL or anon key is missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* Server Component — cookie mutation not allowed */
          }
        },
      },
    },
  );
}

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabaseClient>>;

/**
 * One Supabase client + `getUser()` per React request. Without this, layout,
 * page, and each query helper each hit Auth separately (multi-second latency).
 */
export const getServerAuth = cache(
  async (): Promise<{
    supabase: ServerSupabase | null;
    user: User | null;
  }> => {
    if (!isSupabasePublicConfigured()) {
      return { supabase: null, user: null };
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return { supabase, user };
  },
);
