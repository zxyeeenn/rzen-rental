import { MainShell } from "@/components/layout/main-shell";
import { isSupabasePublicConfigured } from "@/lib/env";
import { getServerAuth } from "@/lib/supabase/server";

/**
 * Auth + shell for routes that need the owner chrome (sidebar, login header).
 * Keeping this separate from the root layout lets the outer HTML/fonts shell
 * avoid cookies() and improves static optimization / caching behavior.
 */
export default async function AppChromeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let userEmail: string | null = null;
  if (isSupabasePublicConfigured()) {
    const { user } = await getServerAuth();
    userEmail = user?.email ?? null;
  }

  return <MainShell userEmail={userEmail}>{children}</MainShell>;
}
