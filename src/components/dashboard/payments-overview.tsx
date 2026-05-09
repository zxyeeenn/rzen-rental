"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { markPaymentsPaidAction } from "@/app/(app)/dashboard/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { parseInvoicePaymentNote } from "@/lib/invoice-notes";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  visiblePageItems,
} from "@/lib/pagination-helpers";
import { shortRoomLabelFromListingTitle } from "@/lib/room-display-name";
import type { PaymentRecord, PaymentSnapshot } from "@/lib/types/payment";
import {
  BarChart3,
  Calendar,
  ChevronDown,
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

type PaymentGroup = {
  key: string;
  roomId: string;
  roomTitle: string;
  billingMonth: string;
  monthTitle: string | null;
  totalAmountPhp: number;
  status: "pending" | "paid";
  dueLabel: string;
  paidLabel: string | null;
  items: PaymentRecord[];
  pendingIds: string[];
};

function monthTitleFromNotes(notes: string | null): string | null {
  const p = parseInvoicePaymentNote(notes);
  return p?.monthTitle ?? null;
}

function dominantInvoiceMonthTitle(items: PaymentRecord[]): string | null {
  const titles = items
    .map((x) => monthTitleFromNotes(x.notes))
    .filter((x): x is string => Boolean(x));
  if (!titles.length) return null;
  const counts = new Map<string, number>();
  for (const t of titles) counts.set(t, (counts.get(t) ?? 0) + 1);
  let best: string | null = null;
  let bestN = 0;
  for (const [t, n] of counts.entries()) {
    if (n > bestN) {
      best = t;
      bestN = n;
    }
  }
  return best;
}

/** Group invoice lines by payment-invoice *phase* (Month 1, Month 2, …), not calendar `billing_month`. */
function groupingBucketForRecord(r: PaymentRecord): string {
  const inv = monthTitleFromNotes(r.notes);
  if (inv) return `inv:${inv}`;
  return `cal:${r.billingMonth}`;
}

/** "Month 12 (early)" → 12; non-invoice / unmatched → null. */
function invoiceMonthIndexFromTitle(title: string | null): number | null {
  if (!title) return null;
  const m = /Month\s+(\d+)/i.exec(title);
  return m ? Number(m[1]) : null;
}

function comparePaymentMonthGroups(a: PaymentGroup, b: PaymentGroup): number {
  const ai = invoiceMonthIndexFromTitle(a.monthTitle);
  const bi = invoiceMonthIndexFromTitle(b.monthTitle);
  if (ai != null && bi != null && ai !== bi) return ai - bi;
  if (ai != null && bi == null) return -1;
  if (ai == null && bi != null) return 1;
  if (ai == null && bi == null) {
    const am =
      a.billingMonth === "Multiple"
        ? a.items.map((x) => x.billingMonth).sort()[0] ?? ""
        : a.billingMonth;
    const bm =
      b.billingMonth === "Multiple"
        ? b.items.map((x) => x.billingMonth).sort()[0] ?? ""
        : b.billingMonth;
    return am.localeCompare(bm);
  }
  return (a.monthTitle ?? "").localeCompare(b.monthTitle ?? "");
}

function buildPaymentGroups(records: PaymentRecord[]): PaymentGroup[] {
  const map = new Map<string, PaymentGroup>();
  for (const r of records) {
    const bucket = groupingBucketForRecord(r);
    const key = `${r.roomId}::${bucket}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        roomId: r.roomId,
        roomTitle: r.roomTitle,
        billingMonth: r.billingMonth,
        monthTitle: null,
        totalAmountPhp: r.amountPhp,
        status: r.status,
        dueLabel: r.dueDate,
        paidLabel: r.paidDate,
        items: [r],
        pendingIds: r.status === "pending" ? [r.id] : [],
      });
      continue;
    }
    existing.totalAmountPhp += r.amountPhp;
    existing.items.push(r);
    if (r.status === "pending") existing.pendingIds.push(r.id);
  }

  const groups = Array.from(map.values());

  for (const g of groups) {
    g.monthTitle = dominantInvoiceMonthTitle(g.items);

    const calSet = new Set(g.items.map((x) => x.billingMonth));
    g.billingMonth = calSet.size === 1 ? [...calSet][0]! : "Multiple";

    g.status = g.items.every((x) => x.status === "paid") ? "paid" : "pending";

    const dueSet = new Set(g.items.map((x) => x.dueDate));
    g.dueLabel = dueSet.size === 1 ? g.items[0]!.dueDate : "Multiple";

    if (g.status === "paid") {
      const paidSet = new Set(g.items.map((x) => x.paidDate ?? ""));
      const paid =
        paidSet.size === 1 ? (g.items[0]!.paidDate ?? null) : "Multiple";
      g.paidLabel = paid === "Multiple" ? "Multiple" : paid;
    } else {
      g.paidLabel = null;
    }
  }

  groups.sort((a, b) => {
    const cmp = comparePaymentMonthGroups(a, b);
    if (cmp !== 0) return cmp;
    const aMax = a.items.reduce(
      (m, x) => (x.createdAt > m ? x.createdAt : m),
      a.items[0]!.createdAt,
    );
    const bMax = b.items.reduce(
      (m, x) => (x.createdAt > m ? x.createdAt : m),
      b.items[0]!.createdAt,
    );
    return bMax.localeCompare(aMax);
  });

  return groups;
}

type RoomMonthGroup = PaymentGroup;

type RoomGroup = {
  key: string;
  roomId: string;
  roomTitle: string;
  totalAmountPhp: number;
  status: "pending" | "paid";
  months: RoomMonthGroup[];
};

function buildRoomGroups(records: PaymentRecord[]): RoomGroup[] {
  const monthGroups = buildPaymentGroups(records);
  const roomMap = new Map<string, RoomGroup>();

  for (const m of monthGroups) {
    const key = m.roomId;
    const existing = roomMap.get(key);
    if (!existing) {
      roomMap.set(key, {
        key,
        roomId: m.roomId,
        roomTitle: m.roomTitle,
        totalAmountPhp: m.totalAmountPhp,
        status: m.status,
        months: [m],
      });
      continue;
    }
    existing.totalAmountPhp += m.totalAmountPhp;
    existing.months.push(m);
  }

  const rooms = Array.from(roomMap.values());
  for (const r of rooms) {
    r.status = r.months.every((x) => x.status === "paid") ? "paid" : "pending";
    r.months.sort(comparePaymentMonthGroups);
  }

  // Newest-first by most recent payment activity in the room
  rooms.sort((a, b) => {
    const aMax = a.months
      .flatMap((m) => m.items)
      .reduce(
        (max, x) => (x.createdAt > max ? x.createdAt : max),
        a.months[0]!.items[0]!.createdAt,
      );
    const bMax = b.months
      .flatMap((m) => m.items)
      .reduce(
        (max, x) => (x.createdAt > max ? x.createdAt : max),
        b.months[0]!.items[0]!.createdAt,
      );
    return bMax.localeCompare(aMax);
  });

  return rooms;
}

function paymentKindLabel(notes: string | null): string {
  const n = (notes ?? "").trim();
  if (!n) return "Payment";

  const inv = parseInvoicePaymentNote(notes);
  if (inv) return inv.billLabel || "Invoice";

  if (n.toLowerCase().startsWith("checkout utility balance")) {
    return "Checkout balance";
  }

  // Fallback heuristic for ad-hoc notes.
  const low = n.toLowerCase();
  if (low.includes("rent")) return "Rent";
  if (low.includes("electric")) return "Electricity";
  if (low.includes("water")) return "Water";
  if (low.includes("deposit")) return "Deposit";
  if (low.includes("advance")) return "Advance";

  return "Payment";
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
  const router = useRouter();
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
    if (txYear) {
      if (txMonth === "all") {
        r = r.filter((x) => x.billingMonth.startsWith(`${txYear}-`));
      } else {
        const key = `${txYear}-${txMonth}`;
        r = r.filter((x) => x.billingMonth === key);
      }
    }
    return r;
  }, [snapshot.records, txYear, txMonth]);

  const roomGroups = React.useMemo(() => {
    const rooms = buildRoomGroups(filteredRecords);
    if (txStatus === "all") return rooms;
    return rooms
      .map((r) => ({
        ...r,
        months: r.months.filter((m) => m.status === txStatus),
      }))
      .filter((r) => r.months.length > 0);
  }, [filteredRecords, txStatus]);

  const [pendingMark, startMark] = React.useTransition();
  const [page, setPage] = React.useState(1);
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [expandedMonth, setExpandedMonth] = React.useState<
    Record<string, boolean>
  >({});
  const [confirmGroup, setConfirmGroup] = React.useState<RoomMonthGroup | null>(
    null,
  );

  const totalPages = Math.max(
    1,
    Math.ceil(roomGroups.length / DEFAULT_TABLE_PAGE_SIZE),
  );

  React.useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  React.useEffect(() => {
    setPage(1);
  }, [txStatus, txYear, txMonth]);

  const pageOffset = (page - 1) * DEFAULT_TABLE_PAGE_SIZE;
  const pageRecords = roomGroups.slice(
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
          {snapshot.loadError ? (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              <p className="font-medium leading-snug">{snapshot.loadError}</p>
              <p className="mt-1.5 text-xs text-destructive/90">
                Your summary cards may show zero until payments load.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 border-destructive/40 text-destructive hover:bg-destructive/10"
                onClick={() => router.refresh()}
              >
                Retry
              </Button>
            </div>
          ) : null}
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
              {roomGroups.length ? (
                pageRecords.flatMap((room) => {
                  const roomOpen = !!expanded[room.key];
                  const roomLabel = shortRoomLabelFromListingTitle(
                    room.roomTitle,
                  );
                  const monthCount = room.months.length;

                  const rows: React.ReactNode[] = [];

                  rows.push(
                    <tr
                      key={room.key}
                      className="border-b border-indigo-100/50 dark:border-border"
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            className="h-8 w-8"
                            aria-expanded={roomOpen}
                            aria-label={
                              roomOpen ? "Collapse room" : "Expand room"
                            }
                            onClick={() =>
                              setExpanded((m) => ({
                                ...m,
                                [room.key]: !roomOpen,
                              }))
                            }
                          >
                            <ChevronDown
                              className={
                                roomOpen
                                  ? "size-4 rotate-180 transition-transform"
                                  : "size-4 transition-transform"
                              }
                              aria-hidden
                            />
                          </Button>
                          <div>
                            <p className="font-medium">{roomLabel}</p>
                            <p className="text-xs text-muted-foreground">
                              {monthCount} month{monthCount === 1 ? "" : "s"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 tabular-nums font-semibold">
                        {formatPHP(room.totalAmountPhp)}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">—</td>
                      <td className="px-3 py-3 text-muted-foreground">—</td>
                      <td className="px-3 py-3">
                        <Badge
                          className={
                            room.status === "paid"
                              ? "border-0 bg-emerald-600/15 text-emerald-800 dark:text-emerald-200"
                              : "border-0 bg-amber-500/20 text-amber-900 dark:text-amber-100"
                          }
                        >
                          {room.status === "paid" ? "Paid" : "Pending"}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-center text-muted-foreground">
                        —
                      </td>
                    </tr>,
                  );

                  if (!roomOpen) return rows;

                  for (const month of room.months) {
                    const monthKey = month.key;
                    const monthOpen = !!expandedMonth[monthKey];
                    rows.push(
                      <tr
                        key={`${room.key}::${monthKey}`}
                        className="border-b border-indigo-100/50 dark:border-border"
                      >
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2 pl-8">
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              className="h-8 w-8"
                              aria-expanded={monthOpen}
                              aria-label={
                                monthOpen ? "Collapse month" : "Expand month"
                              }
                              onClick={() =>
                                setExpandedMonth((m) => ({
                                  ...m,
                                  [monthKey]: !monthOpen,
                                }))
                              }
                            >
                              <ChevronDown
                                className={
                                  monthOpen
                                    ? "size-4 rotate-180 transition-transform"
                                    : "size-4 transition-transform"
                                }
                                aria-hidden
                              />
                            </Button>
                            <div>
                              <p className="font-medium">
                                {month.monthTitle ?? month.billingMonth}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {month.items.length} item
                                {month.items.length === 1 ? "" : "s"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 tabular-nums font-semibold">
                          {formatPHP(month.totalAmountPhp)}
                        </td>
                        <td className="px-3 py-3">{month.billingMonth}</td>
                        <td className="px-3 py-3">{month.dueLabel}</td>
                        <td className="px-3 py-3">
                          <Badge
                            className={
                              month.status === "paid"
                                ? "border-0 bg-emerald-600/15 text-emerald-800 dark:text-emerald-200"
                                : "border-0 bg-amber-500/20 text-amber-900 dark:text-amber-100"
                            }
                          >
                            {month.status === "paid" ? "Paid" : "Pending"}
                          </Badge>
                          {month.paidLabel ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Paid {month.paidLabel}
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
                              month.pendingIds.length === 0 ||
                              pendingMark
                            }
                            onClick={() => setConfirmGroup(month)}
                          >
                            Mark paid
                          </Button>
                        </td>
                      </tr>,
                    );

                    if (!monthOpen) continue;

                    rows.push(
                      <tr
                        key={`${room.key}::${monthKey}::details`}
                        className="border-b border-indigo-100/50 last:border-b-0 dark:border-border"
                      >
                        <td colSpan={6} className="px-3 pb-4 pt-0">
                          <div className="mt-2 rounded-xl border border-indigo-100/80 bg-indigo-50/40 p-3 dark:border-border dark:bg-muted/30">
                            <div className="grid gap-2">
                              {month.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="grid grid-cols-1 gap-1 rounded-lg bg-white/80 p-2 text-xs text-foreground shadow-sm dark:bg-card"
                                >
                                  <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_10rem_6rem]">
                                    <div className="flex min-w-0 items-center gap-2">
                                      <span className="inline-flex shrink-0 items-center rounded-md bg-indigo-600/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-900 dark:text-indigo-200">
                                        {paymentKindLabel(item.notes)}
                                      </span>
                                      <span className="tabular-nums font-medium">
                                        {formatPHP(item.amountPhp)}
                                      </span>
                                    </div>
                                    <span className="text-muted-foreground sm:text-right">
                                      Due {item.dueDate}
                                    </span>
                                    <div className="sm:text-right">
                                      <Badge
                                        className={
                                          item.status === "paid"
                                            ? "border-0 bg-emerald-600/15 text-emerald-800 dark:text-emerald-200"
                                            : "border-0 bg-amber-500/20 text-amber-900 dark:text-amber-100"
                                        }
                                      >
                                        {item.status === "paid"
                                          ? "Paid"
                                          : "Pending"}
                                      </Badge>
                                    </div>
                                  </div>
                                  {item.paidDate ? (
                                    <p className="text-muted-foreground">
                                      Paid {item.paidDate}
                                    </p>
                                  ) : null}
                                  {item.notes ? (
                                    <p className="text-muted-foreground">
                                      {item.notes}
                                    </p>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>,
                    );
                  }

                  return rows;
                })
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-indigo-400 dark:text-muted-foreground"
                  >
                    {snapshot.loadError
                      ? "Payments could not be loaded. Use Retry above."
                      : snapshot.records.length
                        ? "No transactions match these filters."
                        : "No payment records yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {roomGroups.length > 0 && totalPages > 1 ? (
            <div className="mt-6 flex flex-col items-center gap-3 border-t border-indigo-100/80 pt-4 dark:border-border">
              <p className="text-xs text-muted-foreground">
                Showing{" "}
                <span className="font-medium text-foreground">
                  {pageOffset + 1}–
                  {Math.min(
                    pageOffset + DEFAULT_TABLE_PAGE_SIZE,
                    roomGroups.length,
                  )}
                </span>{" "}
                of{" "}
                <span className="font-medium text-foreground">
                  {roomGroups.length}
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
          {snapshot.records.length > 0 && roomGroups.length > 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {roomGroups.length} room
              {roomGroups.length === 1 ? "" : "s"} from{" "}
              {snapshot.records.length} payment record
              {snapshot.records.length === 1 ? "" : "s"}.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={!!confirmGroup}
        onOpenChange={(o) => !o && setConfirmGroup(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Mark month as paid?
            </DialogTitle>
          </DialogHeader>
          {confirmGroup ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                This will mark{" "}
                <span className="font-medium text-foreground">
                  {confirmGroup.pendingIds.length}
                </span>{" "}
                pending item
                {confirmGroup.pendingIds.length === 1 ? "" : "s"} as paid for{" "}
                <span className="font-medium text-foreground">
                  {shortRoomLabelFromListingTitle(confirmGroup.roomTitle)}
                </span>{" "}
                ({confirmGroup.billingMonth}).
              </p>
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Total</span>
                  <span className="tabular-nums font-semibold text-foreground">
                    {formatPHP(confirmGroup.totalAmountPhp)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Pending items</span>
                  <span className="tabular-nums font-medium text-foreground">
                    {confirmGroup.pendingIds.length}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmGroup(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                !canPersist ||
                pendingMark ||
                !confirmGroup ||
                confirmGroup.pendingIds.length === 0
              }
              onClick={() => {
                if (!confirmGroup) return;
                const ids = [...confirmGroup.pendingIds];
                startMark(async () => {
                  const res = await markPaymentsPaidAction(ids);
                  if (!res.ok) {
                    toast.error("Could not mark as paid", {
                      description:
                        res.error ??
                        "Check your connection, then try again.",
                      action: {
                        label: "Retry",
                        onClick: () => {
                          void (async () => {
                            const again = await markPaymentsPaidAction(ids);
                            if (!again.ok) {
                              toast.error("Still could not mark as paid", {
                                description: again.error,
                              });
                              return;
                            }
                            toast.success(again.message ?? "Updated");
                            setConfirmGroup(null);
                          })();
                        },
                      },
                    });
                    return;
                  }
                  toast.success(res.message ?? "Updated");
                  setConfirmGroup(null);
                });
              }}
            >
              {pendingMark ? "Saving…" : "Mark paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
