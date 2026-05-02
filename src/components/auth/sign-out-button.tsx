"use client";

import { LogOutIcon } from "lucide-react";

import { signOutAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOutAction}>
      <Button
        type="submit"
        variant="outline"
        size="sm"
        className={cn("gap-1.5", className)}
        title="Sign out"
      >
        <LogOutIcon className="size-4" aria-hidden />
        Sign out
      </Button>
    </form>
  );
}