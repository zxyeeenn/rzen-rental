"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LogIn } from "lucide-react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function MainShell({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail: string | null;
}) {
  const pathname = usePathname();
  const onLoginRoute = pathname.startsWith("/login");

  if (!userEmail) {
    return (
      <div className="flex min-h-svh flex-col bg-[#f0f0f8] dark:bg-background">
        <header
          className="w-full shrink-0 border-b border-indigo-950/25 bg-indigo-950 text-white dark:border-border dark:bg-card dark:text-foreground"
          role="banner"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between md:px-6 lg:px-8">
            <div className="flex min-w-0 items-start gap-4 sm:items-center">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 shadow-sm dark:bg-primary">
                <Building2
                  className="size-[22px] text-indigo-100 dark:text-primary-foreground"
                  aria-hidden
                />
              </div>
              <div className="min-w-0 space-y-1">
                <Link
                  href="/dashboard"
                  className="block truncate text-xl font-extrabold tracking-tight text-white hover:text-indigo-100 sm:text-2xl dark:text-foreground dark:hover:text-foreground"
                >
                  RZen Rental
                </Link>
                <p className="text-sm font-medium leading-snug text-indigo-200/95 dark:text-muted-foreground">
                  Bohol · rooms &amp; payments
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-stretch gap-3 sm:items-end">
              {onLoginRoute ? (
                <Link
                  href="/dashboard"
                  className="inline-flex h-9 items-center justify-center self-start rounded-lg border border-white/35 bg-white/10 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/18 sm:self-end dark:border-border dark:bg-muted dark:text-foreground dark:hover:bg-muted/80"
                >
                  ← Dashboard
                </Link>
              ) : (
                <Link
                  href="/login"
                  className={cn(
                    "inline-flex h-9 items-center justify-center gap-2 self-start rounded-lg border border-white/35 bg-white/10 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/18 sm:self-end dark:border-border dark:bg-muted dark:text-foreground dark:hover:bg-muted/80",
                  )}
                >
                  <LogIn className="size-4 opacity-90" aria-hidden />
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-6 md:py-10 lg:px-8">
          <div className="min-w-0 flex-1 pb-4">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar userEmail={userEmail} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-4 md:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-6"
          />
        </header>
        <div className="flex flex-1 flex-col overflow-auto bg-[#f0f0f8] dark:bg-background">
          <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-6 md:py-10 lg:px-8">
            <div className="min-w-0 pb-4">{children}</div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
