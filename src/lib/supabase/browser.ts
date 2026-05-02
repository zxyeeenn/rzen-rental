import { createBrowserClient } from "@supabase/ssr";

/**
 * Prefer passing `url` and `anonKey` from a Server Component so `.env.local`
 * is read at request time. Bare `process.env` in Client Components can be
 * empty if the bundle was built before env was available.
 */
export function createBrowserSupabaseClient(
  url: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
) {
  if (!url?.trim() || !anonKey?.trim()) {
    throw new Error(
      "Missing Supabase URL or anon key. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, then restart the dev server.",
    );
  }

  return createBrowserClient(url, anonKey);
}
