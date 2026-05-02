import type { Metadata } from "next";

import { PaymentsOverview } from "@/components/dashboard/payments-overview";
import { fetchPaymentSnapshot } from "@/lib/db/queries";
import { isSupabasePublicConfigured } from "@/lib/env";
import { getServerAuth } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Payments",
  description: "Track rent collections, pending bills, and payment records.",
};

export default async function DashboardPaymentsPage() {
  let user: unknown = null;

  if (isSupabasePublicConfigured()) {
    const { user: signedInUser } = await getServerAuth();
    user = signedInUser;
  }

  const snapshot = await fetchPaymentSnapshot();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Owner dashboard
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Payments
        </h1>
      </header>

      <PaymentsOverview snapshot={snapshot} canPersist={Boolean(user)} />
    </div>
  );
}
