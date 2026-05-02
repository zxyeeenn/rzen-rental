"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Archive, BarChart3, CheckCircle, Users } from "lucide-react";

import { TenantHistoryTable } from "@/components/dashboard/tenant-history-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { shortRoomLabelFromListingTitle } from "@/lib/room-display-name";
import type { TenantHistoryRow } from "@/lib/types/tenant-history";

const TenantStatusChart = dynamic(
  () =>
    import("@/components/dashboard/tenant-status-chart").then(
      (m) => m.TenantStatusChart,
    ),
  {
    loading: () => (
      <div className="h-[280px] w-full animate-pulse rounded-lg bg-indigo-50/80 dark:bg-muted/40" />
    ),
    ssr: false,
  },
);

export function TenantHistoryOverview({ rows }: { rows: TenantHistoryRow[] }) {
  const activeCount = rows.filter((r) => r.isActive).length;
  const endedCount = rows.filter((r) => !r.isActive).length;
  const totalCount = rows.length;

  const [statusFilter, setStatusFilter] = React.useState<
    "all" | "active" | "ended"
  >("all");
  const [search, setSearch] = React.useState("");

  const filteredRows = React.useMemo(() => {
    let r = rows;
    if (statusFilter === "active") r = r.filter((x) => x.isActive);
    if (statusFilter === "ended") r = r.filter((x) => !x.isActive);
    const q = search.trim().toLowerCase();
    if (q) {
      r = r.filter(
        (x) =>
          x.tenantName.toLowerCase().includes(q) ||
          shortRoomLabelFromListingTitle(x.roomTitle)
            .toLowerCase()
            .includes(q),
      );
    }
    return r;
  }, [rows, statusFilter, search]);

  return (    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-indigo-100/80 bg-white p-4 shadow-sm dark:border-border dark:bg-card">
          <div className="mb-2 flex items-center gap-2">
            <Users className="size-[18px] text-[#4f46e5]" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#4338ca] dark:text-indigo-300">
              Active tenants
            </span>
          </div>
          <p className="text-2xl font-extrabold text-[#4f46e5] dark:text-indigo-400">
            {activeCount}
          </p>
          <p className="mt-1 text-xs text-indigo-400 dark:text-muted-foreground">
            Currently occupied
          </p>
        </div>
        <div className="rounded-xl border border-indigo-100/80 bg-white p-4 shadow-sm dark:border-border dark:bg-card">
          <div className="mb-2 flex items-center gap-2">
            <CheckCircle className="size-[18px] text-[#22c55e]" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#4338ca] dark:text-indigo-300">
              Total leases
            </span>
          </div>
          <p className="text-2xl font-extrabold text-[#22c55e] dark:text-emerald-400">
            {totalCount}
          </p>
          <p className="mt-1 text-xs text-indigo-400 dark:text-muted-foreground">
            All time
          </p>
        </div>
        <div className="rounded-xl border border-indigo-100/80 bg-white p-4 shadow-sm dark:border-border dark:bg-card">
          <div className="mb-2 flex items-center gap-2">
            <Archive className="size-[18px] text-[#6366f1]" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#4338ca] dark:text-indigo-300">
              Ended
            </span>
          </div>
          <p className="text-2xl font-extrabold text-[#6366f1] dark:text-indigo-400">
            {endedCount}
          </p>
          <p className="mt-1 text-xs text-indigo-400 dark:text-muted-foreground">
            Checked out
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-indigo-100/80 bg-white p-5 shadow-sm dark:border-border dark:bg-card">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="size-5 text-[#4f46e5]" aria-hidden />
          <h3 className="text-lg font-bold text-[#312e81] dark:text-foreground">
            Tenant status distribution
          </h3>
        </div>
        <TenantStatusChart activeCount={activeCount} endedCount={endedCount} />
      </div>

      <div className="rounded-2xl border border-indigo-100/80 bg-white p-5 shadow-sm dark:border-border dark:bg-card">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Users className="size-5 text-[#4f46e5]" aria-hidden />
            <h2 className="text-lg font-bold text-[#312e81] dark:text-foreground">
              Tenant history
            </h2>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
            <div className="grid min-w-[11rem] flex-1 gap-1.5 sm:max-w-xs">
              <Label htmlFor="tenant-search" className="text-xs">
                Search tenant or room
              </Label>
              <Input
                id="tenant-search"
                placeholder="Name or room…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="grid min-w-[10.5rem] gap-1.5">
              <Label htmlFor="tenant-status" className="text-xs">
                Status
              </Label>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  if (v === "all" || v === "active" || v === "ended") {
                    setStatusFilter(v);
                  }
                }}
              >
                <SelectTrigger
                  id="tenant-status"
                  className="h-9"
                  aria-label="Filter by lease status"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="ended">Ended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        {rows.length === 0 ? (
          <TenantHistoryTable rows={[]} />
        ) : filteredRows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 px-4 py-10 text-center text-sm text-indigo-600 dark:border-border dark:bg-muted/30 dark:text-muted-foreground">
            No leases match your filters. Try clearing search or choosing
            &quot;All&quot; for status.
          </p>
        ) : (
          <TenantHistoryTable rows={filteredRows} />
        )}
      </div>    </div>
  );
}
