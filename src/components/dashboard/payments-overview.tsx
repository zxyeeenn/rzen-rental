"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";

import { markPaymentPaidAction } from "@/app/(app)/dashboard/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPHP } from "@/lib/format-php";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  visiblePageItems,
} from "@/lib/pagination-helpers";
import { shortRoomLabelFromListingTitle } from "@/lib/room-display-name";
import type { PaymentSnapshot } from "@/lib/types/payment";
import {
  BarChart3,
  Calendar,
  CreditCard,
  PieChart,
  TrendingUp,
  Zap,
} from "lucide-react";

const MONTH_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All months" },
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

function ChartBlockSkeleton() {
  return (
    <div className="h-72 w-full animate-pulse rounded-lg bg-indigo-50/80 dark:bg-muted/40" />
  );
}

const PaymentsByMonthChart = dynamic(
  () =>
    import("@/components/dashboard/payments-by-month-chart").then(
      (m) => m.PaymentsByMonthChart,
    ),
  { loading: ChartBlockSkeleton, ssr: false },
);

const PaymentStatusChart = dynamic(
  () =>
    import("@/components/dashboard/payment-status-chart").then(
      (m) => m.PaymentStatusChart,
    ),
  { loading: ChartBlockSkeleton, ssr: false },
);

function currentMonthLabel(): string {
  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function collectYears(snapshot: PaymentSnapshot): string[] {
  const s = new Set<string>();
  s.add(String(new Date().getFullYear()));
  for (const d of snapshot.chartByMonth) {
    if (d.month.length >= 4) s.add(d.month.slice(0, 4));
  }
  for (const r of snapshot.records) {
    if (r.billingMonth.length >= 4) s.add(r.billingMonth.slice(0, 4));
  }
  return [...s].sort((a, b) => b.localeCompare(a));
}

export function PaymentsOverview({
  snapshot,
  canPersist,
}: {
  snapshot: PaymentSnapshot;
  canPersist: boolean;
}) {
  const yearOptions = React.useMemo(() => collectYears(snapshot), [snapshot]);

  const [chartYear, setChartYear] = React.useState(() =>
    String(new Date().getFullYear()),
  );
  const [chartMonth, setChartMonth] = React.useState<string>("all");

  const [txStatus, setTxStatus] = React.useState<"all" | "paid" | "pending">(
    "all",
  );
  const [txYear, setTxYear] = React.useState(() =>
    String(new Date().getFullYear()),
  );
  const [txMonth, setTxMonth] = React.useState<string>("all");

  React.useEffect(() => {
    if (!yearOptions.includes(chartYear) && yearOptions[0]) {
      setChartYear(yearOptions[0]);
    }
  }, [yearOptions, chartYear]);

  React.useEffect(() => {
    if (!yearOptions.includes(txYear) && yearOptions[0]) {
      setTxYear(yearOptions[0]);
    }
  }, [yearOptions, txYear]);

  const filteredChartData = React.useMemo(() => {
    if (!chartYear) return snapshot.chartByMonth;
    const inYear = snapshot.chartByMonth.filter((d) =>
      d.month.startsWith(`${chartYear}-`),
    );
    if (chartMonth === "all") return inYear;
    const key = `${chartYear}-${chartMonth}`;
    return inYear.filter((d) => d.month === key);
  }, [snapshot.chartByMonth, chartYear, chartMonth]);

  const filteredRecords = React.useMemo(() => {
    let r = snapshot.records;
    if (txStatus !== "all") {
      r = r.filter((x) => x.status === txStatus);
    }
    if (txYear) {
      if (txMonth === "all") {
        r = r.filter((x) => x.billingMonth.startsWith(`${txYear}-`));
      } else {
        const key = `${txYear}-${txMonth}`;
        r = r.filter((x) => x.billingMonth === key);
      }
    }
    return r;
  }, [snapshot.records, txStatus, txYear, txMonth]);

  const [pendingMark, startMark] = React.useTransition();
  const [page, setPage] = React.useState(1);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRecords.length / DEFAULT_TABLE_PAGE_SIZE),
  );

  React.useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  React.useEffect(() => {
    setPage(1);
  }, [txStatus, txYear, txMonth]);

  const pageOffset = (page - 1) * DEFAULT_TABLE_PAGE_SIZE;
  const pageRecords = filteredRecords.slice(
    pageOffset,
    pageOffset + DEFAULT_TABLE_PAGE_SIZE,
  );
  const paginationItems = visiblePageItems(page, totalPages);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-indigo-100/80 bg-white p-4 shadow-sm dark:border-border dark:bg-card">
          <div className="mb-2 flex items-center gap-2">
            <TrendingUp className="size-[18px] text-[#22c55e]" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#4338ca] dark:text-indigo-300">
              Total collected
            </span>
          </div>
          <p className="text-2xl font-extrabold text-[#22c55e] dark:text-emerald-400">
            {formatPHP(snapshot.totalCollectedPhp)}
          </p>
          <p className="mt-1 text-xs text-indigo-400 dark:text-muted-foreground">
            All time (paid only)
          </p>
        </div>
        <div className="rounded-xl border border-indigo-100/80 bg-white p-4 shadow-sm dark:border-border dark:bg-card">
          <div className="mb-2 flex items-center gap-2">
            <Calendar className="size-[18px] text-[#6366f1]" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#4338ca] dark:text-indigo-300">
              This month
            </span>
          </div>
          <p className="text-2xl font-extrabold text-[#6366f1] dark:text-indigo-400">
            {formatPHP(snapshot.monthCollectedPhp)}
          </p>
          <p className="mt-1 text-xs text-indigo-400 dark:text-muted-foreground">
            {currentMonthLabel()}
          </p>
        </div>
        <div className="rounded-xl border border-indigo-100/80 bg-white p-4 shadow-sm dark:border-border dark:bg-card">
          <div className="mb-2 flex items-center gap-2">
            <Zap className="size-[18px] text-[#f59e0b]" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#4338ca] dark:text-indigo-300">
              Pending
            </span>
          </div>
          <p className="text-2xl font-extrabold text-[#f59e0b] dark:text-amber-400">
            {formatPHP(snapshot.pendingAmountPhp)}
          </p>
          <p className="mt-1 text-xs text-indigo-400 dark:text-muted-foreground">
            {snapshot.pendingCount} bill
            {snapshot.pendingCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-indigo-100/80 bg-white p-5 shadow-sm dark:border-border dark:bg-card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="size-5 text-[#4f46e5]" aria-hidden />
              <h3 className="text-lg font-bold text-[#312e81] dark:text-foreground">
                Monthly revenue
              </h3>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="chart-year" className="text-xs">
                  Year
                </Label>
                <Select
                  value={chartYear}
                  onValueChange={(v) => v && setChartYear(v)}
                >
                  <SelectTrigger
                    id="chart-year"
                    className="h-9 w-[7.5rem]"
                    aria-label="Filter chart by year"
                  >
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="chart-month" className="text-xs">
                  Month
                </Label>
                <Select
                  value={chartMonth}
                  onValueChange={(v) => v && setChartMonth(v)}
                >
                  <SelectTrigger
                    id="chart-month"
                    className="h-9 w-[10.5rem]"
                    aria-label="Filter chart by month"
                  >
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <PaymentsByMonthChart data={filteredChartData} />
        </div>
        <div className="rounded-2xl border border-indigo-100/80 bg-white p-5 shadow-sm dark:border-border dark:bg-card">
          <div className="mb-4 flex items-center gap-2">
            <PieChart className="size-5 text-[#4f46e5]" aria-hidden />
            <h3 className="text-lg font-bold text-[#312e81] dark:text-foreground">
              Payment status breakdown
            </h3>
          </div>
          <PaymentStatusChart
            paidPhp={
              snapshot.records
                .filter((r) => r.status === "paid")
                .reduce((s, r) => s + r.amountPhp, 0)
            }
            pendingPhp={
              snapshot.records
                .filter((r) => r.status === "pending")
                .reduce((s, r) => s + r.amountPhp, 0)
            }
          />
        </div>
      </div>

      <Card className="border-indigo-100/80 shadow-sm dark:border-border">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="size-5 text-[#4f46e5]" aria-hidden />
              <div>
                <CardTitle className="text-[#312e81] dark:text-foreground">
                  Payment transactions
                </CardTitle>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="tx-status" className="text-xs">
                  Status
                </Label>
                <Select
                  value={txStatus}
                  onValueChange={(v) => {
                    if (v === "all" || v === "paid" || v === "pending") {
                      setTxStatus(v);
                    }
                  }}
                >
                  <SelectTrigger
                    id="tx-status"
                    className="h-9 w-[9.5rem]"
                    aria-label="Filter by payment status"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="tx-year" className="text-xs">
                  Billing year
                </Label>
                <Select value={txYear} onValueChange={(v) => v && setTxYear(v)}>
                  <SelectTrigger
                    id="tx-year"
                    className="h-9 w-[7.5rem]"
                    aria-label="Filter by billing year"
                  >
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="tx-month" className="text-xs">
                  Billing month
                </Label>
                <Select
                  value={txMonth}
                  onValueChange={(v) => v && setTxMonth(v)}
                >
                  <SelectTrigger
                    id="tx-month"
                    className="h-9 w-[10.5rem]"
                    aria-label="Filter by billing month"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_OPTIONS.map((m) => (
                      <SelectItem key={`tx-${m.value}`} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b-2 border-indigo-200 bg-indigo-50 text-left dark:border-border dark:bg-muted/40">
                <th className="px-3 py-3 text-xs font-semibold text-[#4338ca] dark:text-foreground">
                  Room
                </th>
                <th className="px-3 py-3 text-xs font-semibold text-[#4338ca] dark:text-foreground">
                  Amount
                </th>
                <th className="px-3 py-3 text-xs font-semibold text-[#4338ca] dark:text-foreground">
                  Billing month
                </th>
                <th className="px-3 py-3 text-xs font-semibold text-[#4338ca] dark:text-foreground">
                  Due
                </th>
                <th className="px-3 py-3 text-xs font-semibold text-[#4338ca] dark:text-foreground">
                  Status
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-[#4338ca] dark:text-foreground">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length ? (
                pageRecords.map((record) => (
                  <tr
                    key={record.id}
                    className="border-b border-indigo-100/50 last:border-b-0 dark:border-border"
                  >
                    <td className="px-3 py-3">
                      <span className="font-medium">
                        {shortRoomLabelFromListingTitle(record.roomTitle)}
                      </span>
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {formatPHP(record.amountPhp)}
                    </td>
                    <td className="px-3 py-3">{record.billingMonth}</td>
                    <td className="px-3 py-3">{record.dueDate}</td>
                    <td className="px-3 py-3">
                      <Badge
                        className={
                          record.status === "paid"
                            ? "border-0 bg-emerald-600/15 text-emerald-800 dark:text-emerald-200"
                            : "border-0 bg-amber-500/20 text-amber-900 dark:text-amber-100"
                        }
                      >
                        {record.status === "paid" ? "Paid" : "Pending"}
                      </Badge>
                      {record.paidDate ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Paid {record.paidDate}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={
                          !canPersist ||
                          record.status === "paid" ||
                          pendingMark
                        }
                        onClick={() => {
                          startMark(async () => {
                            const res = await markPaymentPaidAction(record.id);
                            if (!res.ok) {
                              toast.error(res.error);
                              return;
                            }
                            toast.success(res.message ?? "Updated");
                          });
                        }}
                      >
                        Mark paid
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-indigo-400 dark:text-muted-foreground"
                  >
                    {snapshot.records.length
                      ? "No transactions match these filters."
                      : "No payment records yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {filteredRecords.length > 0 && totalPages > 1 ? (
            <div className="mt-6 flex flex-col items-center gap-3 border-t border-indigo-100/80 pt-4 dark:border-border">
              <p className="text-xs text-muted-foreground">
                Showing{" "}
                <span className="font-medium text-foreground">
                  {pageOffset + 1}–
                  {Math.min(
                    pageOffset + DEFAULT_TABLE_PAGE_SIZE,
                    filteredRecords.length,
                  )}
                </span>{" "}
                of{" "}
                <span className="font-medium text-foreground">
                  {filteredRecords.length}
                </span>
              </p>
              <Pagination>
                <PaginationContent className="flex-wrap">
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      className={
                        page <= 1 ? "pointer-events-none opacity-50" : undefined
                      }
                      onClick={(e) => {
                        e.preventDefault();
                        if (page > 1) setPage((p) => p - 1);
                      }}
                    />
                  </PaginationItem>
                  {paginationItems.map((item) =>
                    item.type === "ellipsis" ? (
                      <PaginationItem key={item.key}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={item.n}>
                        <PaginationLink
                          href="#"
                          isActive={item.n === page}
                          onClick={(e) => {
                            e.preventDefault();
                            setPage(item.n);
                          }}
                        >
                          {item.n}
                        </PaginationLink>
                      </PaginationItem>
                    ),
                  )}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      className={
                        page >= totalPages
                          ? "pointer-events-none opacity-50"
                          : undefined
                      }
                      onClick={(e) => {
                        e.preventDefault();
                        if (page < totalPages) setPage((p) => p + 1);
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          ) : null}
          {snapshot.records.length > 0 && filteredRecords.length > 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {filteredRecords.length} of {snapshot.records.length} row
              {snapshot.records.length === 1 ? "" : "s"} after filters.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
