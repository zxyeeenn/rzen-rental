"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isSupabasePublicConfigured } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function signOutAction() {
  if (!isSupabasePublicConfigured()) {
    redirect("/");
  }

  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
