import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isSupabasePublicConfigured } from "@/lib/env";
import { getServerAuth } from "@/lib/supabase/server";
import { initialsFromEmail } from "@/lib/user-display";

export const metadata: Metadata = {
  title: "Account",
  description: "Your owner login for RZen Rental.",
};

export default async function ProfilePage() {
  let email: string | null = null;
  if (isSupabasePublicConfigured()) {
    const { user } = await getServerAuth();
    email = user?.email ?? null;
  }

  const initials = email ? initialsFromEmail(email) : "?";

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/dashboard"
          className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to dashboard
        </Link>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Your login
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Account
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          One email and password for you as the owner—same account you use on
          the sign-in page, backed by Supabase Auth.
        </p>
      </header>

      <Card className="border-indigo-100/80 shadow-sm dark:border-border">
        <CardHeader className="flex flex-row items-center gap-4 space-y-0">
          <Avatar size="lg" className="rounded-xl">
            <AvatarFallback className="rounded-xl bg-primary text-lg font-semibold text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base">Signed in as</CardTitle>
            <CardDescription className="truncate" title={email ?? undefined}>
              {email ?? "Not signed in"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            To change your password or email, use the{" "}
            <strong className="font-medium text-foreground">
              Supabase dashboard
            </strong>{" "}
            for your project (Authentication → Users), or add a password-reset
            flow on the login page later if you want self‑service from the app.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
