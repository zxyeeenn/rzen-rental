"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export function LoginForm({
  defaultNext = "/dashboard",
  supabaseUrl,
  supabaseAnonKey,
}: {
  defaultNext?: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function safeNextPath(next: string) {
    if (!next.startsWith("/") || next.startsWith("//")) return "/dashboard";
    return next;
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Use the email and password you were given for this property. If you
          need access, ask your administrator.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = new FormData(form);
            const parsed = loginSchema.safeParse({
              email: fd.get("email"),
              password: fd.get("password"),
            });
            if (!parsed.success) {
              toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
              return;
            }

            if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
              toast.error(
                "Sign-in isn't available on this site right now. Please try again later.",
              );
              return;
            }

            startTransition(async () => {
              const supabase = createBrowserSupabaseClient(
                supabaseUrl,
                supabaseAnonKey,
              );
              const { error } = await supabase.auth.signInWithPassword({
                email: parsed.data.email,
                password: parsed.data.password,
              });
              if (error) {
                toast.error(error.message);
                return;
              }
              toast.success("Signed in");
              router.push(safeNextPath(defaultNext));
              router.refresh();
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        After you sign in, you can manage rooms, rent, and payments.
      </CardFooter>
    </Card>
  );
}
