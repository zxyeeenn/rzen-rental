import type { Metadata } from "next";

import { TenantHistoryOverview } from "@/components/dashboard/tenant-history-overview";
import { fetchTenantLeaseHistory } from "@/lib/db/queries";

export const metadata: Metadata = {
  title: "Tenant history",
  description: "Active and past leases across all units.",
};

export default async function DashboardTenantsPage() {
  const rows = await fetchTenantLeaseHistory();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Owner dashboard
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Tenant history
        </h1>
      </header>

      <TenantHistoryOverview rows={rows} />
    </div>
  );
}
