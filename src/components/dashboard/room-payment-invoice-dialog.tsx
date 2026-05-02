"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import { ChevronDown, Lock, Unlock, Zap } from "lucide-react";
import { toast } from "sonner";

import {
  recordPaidInvoiceLineAction,
  recordUtilityReadingAction,
} from "@/app/(app)/dashboard/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ELECTRIC_RATE_PHP_PER_KWH,
  electricChargePhp,
  electricUsageKwh,
} from "@/lib/billing/electric";
import { formatPHP } from "@/lib/format-php";
import {
  currentLeaseMonthIndex,
  dueDateForBillingMonth,
  formatIsoDateLocal,
  parseLocalDateOnly,
} from "@/lib/lease-utils";
import type { LeaseSummary } from "@/lib/types/owner-room";
import { cn } from "@/lib/utils";

const WIFI_MONTHLY_FEE_PHP = 500;
const WATER_MONTHLY_FEE_PHP = 150;

function periodFromDueDateIso(dueDateIso: string): { start: string; end: string } {
  const d = parseLocalDateOnly(dueDateIso);
  const y = d.getFullYear();
  const m = d.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  return { start: fmt(start), end: fmt(end) };
}

function leaseMonthCount(lease: LeaseSummary): number {
  if (!lease.leaseEnd) return 4;

  const start = parseLocalDateOnly(lease.leaseStart);
  const end = parseLocalDateOnly(lease.leaseEnd);
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    1;

  return Math.min(Math.max(months, 1), 12);
}

export type InvoiceBillLine = {
  id: string;
  label: string;
  amountPhp: number;
  dueDate: string;
};

type InvoiceMonthBlock = {
  title: string;
  bills: InvoiceBillLine[];
};

function buildInvoiceMonths(lease: LeaseSummary): InvoiceMonthBlock[] {
  const months = leaseMonthCount(lease);

  return Array.from({ length: months }, (_, index) => {
    const dueDate = dueDateForBillingMonth(lease.leaseStart, lease.rentDueDay, index);
    const bills: InvoiceBillLine[] =
      index === 0
        ? [
            lease.advanceMonths > 0
              ? {
                  id: `m${index}-advance`,
                  label: `${lease.advanceMonths} Month Advance`,
                  amountPhp: lease.monthlyRentPhp * lease.advanceMonths,
                  dueDate,
                }
              : null,
            lease.depositMonths > 0
              ? {
                  id: `m${index}-deposit`,
                  label: `${lease.depositMonths} Month Deposit`,
                  amountPhp: lease.monthlyRentPhp * lease.depositMonths,
                  dueDate,
                }
              : null,
            {
              id: `m${index}-wifi`,
              label: "WiFi Monthly Fee",
              amountPhp: WIFI_MONTHLY_FEE_PHP,
              dueDate,
            },
            {
              id: `m${index}-water`,
              label: "Water - Monthly",
              amountPhp: WATER_MONTHLY_FEE_PHP,
              dueDate,
            },
          ].filter((bill): bill is InvoiceBillLine => bill != null)
        : [
            {
              id: `m${index}-rent`,
              label: "Monthly Rate",
              amountPhp: lease.monthlyRentPhp,
              dueDate,
            },
            {
              id: `m${index}-wifi`,
              label: "WiFi Monthly Fee",
              amountPhp: WIFI_MONTHLY_FEE_PHP,
              dueDate,
            },
            {
              id: `m${index}-water`,
              label: "Water - Monthly",
              amountPhp: WATER_MONTHLY_FEE_PHP,
              dueDate,
            },
          ];

    return {
      title: index === 0 ? "Month 1 (Setup)" : `Month ${index + 1}`,
      bills,
    };
  });
}

function monthSubtitle(bills: InvoiceBillLine[]): string {
  const total = bills.reduce((s, b) => s + b.amountPhp, 0);
  return `${bills.length} bills · Total: ${formatPHP(total)}`;
}

function paidStorageKey(leaseId: string): string {
  return `rzen:invoicePaid:${leaseId}`;
}

function loadPaidSet(leaseId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(paidStorageKey(leaseId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function savePaidSet(leaseId: string, set: Set<string>): void {
  localStorage.setItem(paidStorageKey(leaseId), JSON.stringify([...set]));
}

const manualUnlockedKey = (leaseId: string) => `rzen:invoiceMonthUnlock:${leaseId}`;

function loadManualUnlocked(leaseId: string): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(manualUnlockedKey(leaseId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(
      arr.filter((x): x is number => typeof x === "number" && Number.isInteger(x) && x >= 0),
    );
  } catch {
    return new Set();
  }
}

function saveManualUnlocked(leaseId: string, set: Set<number>): void {
  localStorage.setItem(
    manualUnlockedKey(leaseId),
    JSON.stringify([...set].sort((a, b) => a - b)),
  );
}

type MonthElectric = {
  prev: string;
  curr: string;
  applied: boolean;
};

export function RoomPaymentInvoiceDialog({
  roomId,
  roomDisplayName,
  lease,
  open,
  onOpenChange,
  canPersist,
  onPaymentRecorded,
}: {
  roomId: string;
  roomDisplayName: string;
  lease: LeaseSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canPersist: boolean;
  onPaymentRecorded?: () => void;
}) {
  const baseMonths = React.useMemo(() => buildInvoiceMonths(lease), [lease]);
  const [expandedMonth, setExpandedMonth] = React.useState(0);
  const [paidIds, setPaidIds] = React.useState<Set<string>>(() => new Set());
  const [electricByMonth, setElectricByMonth] = React.useState<
    Record<number, MonthElectric>
  >({});
  const [utilityPending, startUtility] = React.useTransition();
  const [, startPay] = React.useTransition();
  /** Single-flight pay: which button is in progress (or `all:{index}` for bulk). */
  const [payingKey, setPayingKey] = React.useState<string | null>(null);
  const [manualUnlocked, setManualUnlocked] = React.useState<Set<number>>(
    () => new Set(),
  );

  const finalMonth =
    baseMonths[baseMonths.length - 1]?.title ?? "Month 1";

  const nowMonthIndex = React.useMemo(
    () => currentLeaseMonthIndex(lease.leaseStart, baseMonths.length),
    [lease.leaseStart, baseMonths.length],
  );

  /** Calendar has reached this month, or the user opened it early. */
  const isMonthUnlocked = (monthIndex: number) =>
    monthIndex <= nowMonthIndex || manualUnlocked.has(monthIndex);

  const isAutoUnlocked = (monthIndex: number) =>
    monthIndex <= nowMonthIndex;

  function unlockMonthEarly(index: number) {
    if (index <= nowMonthIndex) return;
    const next = new Set(manualUnlocked);
    next.add(index);
    setManualUnlocked(next);
    saveManualUnlocked(lease.id, next);
    setExpandedMonth(index);
    toast.success("Month unlocked. You can add readings and pay.");
  }

  function relockMonth(index: number) {
    if (index <= nowMonthIndex) return;
    const next = new Set(manualUnlocked);
    next.delete(index);
    setManualUnlocked(next);
    saveManualUnlocked(lease.id, next);
    setExpandedMonth((m) => (m === index ? -1 : m));
    toast.info("Month locked again.");
  }

  React.useEffect(() => {
    if (open) {
      setExpandedMonth(
        Math.min(nowMonthIndex, Math.max(0, baseMonths.length - 1)),
      );
      setPaidIds(loadPaidSet(lease.id));
      const fromStorage = loadManualUnlocked(lease.id);
      const n = currentLeaseMonthIndex(lease.leaseStart, baseMonths.length);
      const pruned = new Set([...fromStorage].filter((i) => i > n));
      if (pruned.size !== fromStorage.size) {
        saveManualUnlocked(lease.id, pruned);
      }
      setManualUnlocked(pruned);
      setElectricByMonth({ 0: { prev: "0", curr: "", applied: false } });
    }
  }, [open, lease.id, nowMonthIndex, baseMonths.length, lease.leaseStart]);

  function getElectricState(index: number): MonthElectric {
    const b = electricByMonth[index];
    if (index === 0) {
      return {
        prev: b?.prev ?? "0",
        curr: b?.curr ?? "",
        applied: b?.applied ?? false,
      };
    }
    return {
      prev: b?.prev ?? "",
      curr: b?.curr ?? "",
      applied: b?.applied ?? false,
    };
  }

  /** Month 1 has no prior invoice month; month 2+ needs prior month’s kWh on the invoice first. */
  function priorMonthElectricOnInvoice(index: number): boolean {
    if (index === 0) return true;
    return Boolean(electricByMonth[index - 1]?.applied);
  }

  function billsForMonth(index: number): InvoiceBillLine[] {
    const base = baseMonths[index]?.bills ?? [];
    const st = getElectricState(index);
    if (!st.applied) return base;

    const dueDate = dueDateForBillingMonth(
      lease.leaseStart,
      lease.rentDueDay,
      index,
    );
    const prevN = Number(st.prev);
    const currN = Number(st.curr);
    const kwh = electricUsageKwh(prevN, currN);
    const amt = electricChargePhp(prevN, currN);
    if (kwh === null || amt === null || amt <= 0) return base;

    const line: InvoiceBillLine = {
      id: `m${index}-electric`,
      label: `Electricity (${kwh.toLocaleString("en-PH")} kWh × ₱${ELECTRIC_RATE_PHP_PER_KWH}/kWh)`,
      amountPhp: amt,
      dueDate,
    };
    return [...base, line];
  }

  function monthAllPaid(index: number): boolean {
    const bills = billsForMonth(index);
    return bills.length > 0 && bills.every((b) => paidIds.has(b.id));
  }

  function handlePay(
    bill: InvoiceBillLine,
    monthTitle: string,
    monthIndex: number,
  ) {
    if (paidIds.has(bill.id) || payingKey) return;
    if (!isMonthUnlocked(monthIndex)) {
      toast.error("Unlock this month first (lock icon) or wait until it’s due.");
      return;
    }

    const key = `line:${bill.id}`;
    flushSync(() => {
      setPayingKey(key);
    });
    startPay(async () => {
      try {
        const next = new Set(paidIds);
        next.add(bill.id);
        setPaidIds(next);
        savePaidSet(lease.id, next);

        if (!canPersist) {
          toast.success("Marked as paid (saved on this device)", {
            id: `pay-local-${bill.id}`,
          });
          return;
        }

        const res = await recordPaidInvoiceLineAction({
          roomId,
          amountPhp: bill.amountPhp,
          billingMonth: bill.dueDate.slice(0, 7),
          dueDate: bill.dueDate,
          notes: `Invoice · ${monthTitle} · ${bill.label}`,
        });

        if (!res.ok) {
          next.delete(bill.id);
          setPaidIds(new Set(next));
          savePaidSet(lease.id, next);
          toast.error(res.error);
          return;
        }

        toast.success(res.message ?? "Payment recorded", {
          id: `pay-${bill.id}`,
        });
        onPaymentRecorded?.();
      } finally {
        flushSync(() => {
          setPayingKey(null);
        });
      }
    });
  }

  function handlePayAllForMonth(monthIndex: number, monthTitle: string) {
    if (!isMonthUnlocked(monthIndex) || payingKey) return;
    const bills = billsForMonth(monthIndex).filter((b) => !paidIds.has(b.id));
    if (bills.length === 0) {
      toast.info("Nothing unpaid in this month.");
      return;
    }

    const key = `all:${monthIndex}`;
    flushSync(() => {
      setPayingKey(key);
    });
    startPay(async () => {
      const snapshot = new Set(paidIds);
      try {
        if (!canPersist) {
          const next = new Set(paidIds);
          for (const b of bills) next.add(b.id);
          setPaidIds(next);
          savePaidSet(lease.id, next);
          toast.success(
            `Marked ${bills.length} line(s) paid (saved on this device).`,
            { id: `payall-local-${monthIndex}` },
          );
          return;
        }

        const next = new Set(paidIds);
        for (const bill of bills) {
          const res = await recordPaidInvoiceLineAction({
            roomId,
            amountPhp: bill.amountPhp,
            billingMonth: bill.dueDate.slice(0, 7),
            dueDate: bill.dueDate,
            notes: `Invoice · ${monthTitle} · ${bill.label}`,
          });
          if (!res.ok) {
            setPaidIds(snapshot);
            savePaidSet(lease.id, snapshot);
            toast.error(res.error);
            return;
          }
          next.add(bill.id);
          setPaidIds(new Set(next));
        }
        savePaidSet(lease.id, next);
        toast.success(
          bills.length === 1
            ? "Payment recorded"
            : `${bills.length} payments recorded`,
          { id: `payall-${monthIndex}` },
        );
        onPaymentRecorded?.();
      } finally {
        flushSync(() => {
          setPayingKey(null);
        });
      }
    });
  }

  function applyElectric(index: number) {
    if (!isMonthUnlocked(index)) {
      toast.error("Unlock this month or wait until the calendar period.");
      return;
    }
    if (index > 0 && !electricByMonth[index - 1]?.applied) {
      toast.error(
        `Add electricity for ${baseMonths[index - 1]?.title ?? "the previous month"} to this invoice first.`,
      );
      return;
    }
    const st = getElectricState(index);
    const prevN = Number(st.prev);
    const currN = Number(st.curr);
    const usage = electricUsageKwh(prevN, currN);
    if (usage === null) {
      toast.error(
        "Invalid readings: use current ≥ previous (0 kWh if equal), or rollover only when previous is ≥ 90,000 kWh.",
      );
      return;
    }

    const dueDate = dueDateForBillingMonth(
      lease.leaseStart,
      lease.rentDueDay,
      index,
    );
    const { start, end } = periodFromDueDateIso(dueDate);
    const monthTitle = baseMonths[index]?.title ?? `Month ${index + 1}`;

    const applyLocal = () => {
      setElectricByMonth((m) => {
        const next: Record<number, MonthElectric> = {
          ...m,
          [index]: { ...st, applied: true },
        };
        if (index + 1 < baseMonths.length) {
          const c = st.curr;
          if (c !== "") {
            const fut = m[index + 1];
            if (!fut?.applied) {
              next[index + 1] = { prev: c, curr: fut?.curr ?? "", applied: false };
            }
          }
        }
        return next;
      });
      toast.success("Electricity added to this month’s invoice");
    };

    if (!canPersist) {
      applyLocal();
      return;
    }

    startUtility(async () => {
      const fd = new FormData();
      fd.set("roomId", roomId);
      fd.set("kind", "electric");
      fd.set("periodStart", start);
      fd.set("periodEnd", end);
      fd.set("previousReading", String(prevN));
      fd.set("currentReading", String(currN));
      fd.set("notes", `Payment invoice — ${monthTitle}`);

      const res = await recordUtilityReadingAction(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      applyLocal();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Payment Invoice — {roomDisplayName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border-l-4 border-indigo-600 bg-indigo-50 p-3 text-sm dark:bg-indigo-950/30">
            <p className="text-xs font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
              Billing phase
            </p>
            <p className="mt-1 font-semibold text-indigo-950 dark:text-indigo-100">
              Month 1 (Setup) — {finalMonth}
            </p>
            <p className="mt-2 text-xs text-indigo-700/80 dark:text-indigo-200/80">
              Move-in {formatIsoDateLocal(lease.leaseStart)} · Checkout{" "}
              {lease.leaseEnd
                ? formatIsoDateLocal(lease.leaseEnd)
                : "Open-ended"}
            </p>
          </div>

          <div className="overflow-hidden rounded-lg border border-indigo-100 dark:border-border">
            {baseMonths.map((block, index) => {
              const expanded = expandedMonth === index;
              const bills = billsForMonth(index);
              const st = getElectricState(index);
              const priorElec = priorMonthElectricOnInvoice(index);
              const prevN = Number(st.prev);
              const currN = Number(st.curr);
              const previewKwh = electricUsageKwh(prevN, currN);
              const previewCost = electricChargePhp(prevN, currN);
              const allPaid = monthAllPaid(index);
              const autoU = isAutoUnlocked(index);
              const earlyU = !autoU && manualUnlocked.has(index);
              const unlocked = autoU || manualUnlocked.has(index);

              return (
                <div key={block.title} className="border-b last:border-b-0">
                  <div
                    className={cn(
                      "group flex w-full items-center justify-between gap-1 px-2 py-2 transition-colors duration-150 sm:gap-2 sm:px-4",
                      "bg-indigo-50/90 dark:bg-indigo-950/25",
                      "hover:bg-indigo-100 dark:hover:bg-indigo-900/45",
                      expanded &&
                        unlocked &&
                        "bg-indigo-100/95 dark:bg-indigo-900/40",
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-1.5 sm:gap-2">
                      <button
                        type="button"
                        className={cn(
                          "mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg border transition-all duration-150",
                          "bg-indigo-100/80 dark:bg-indigo-950/70",
                          "group-hover:border-indigo-300 group-hover:bg-indigo-200/80 dark:group-hover:border-indigo-600 dark:group-hover:bg-indigo-800/60",
                          autoU
                            ? "cursor-default border-emerald-300/90 dark:border-emerald-800"
                            : "border-indigo-200/80 dark:border-indigo-800",
                          !autoU &&
                            "hover:scale-105 hover:border-indigo-500 hover:bg-indigo-200/90 dark:hover:border-indigo-500 dark:hover:bg-indigo-800/80",
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (autoU) return;
                          if (earlyU) relockMonth(index);
                          else unlockMonthEarly(index);
                        }}
                        title={
                          autoU
                            ? "Unlocked (calendar month is here)"
                            : earlyU
                              ? "Unlocked early — click to lock again"
                              : "Click to unlock this month anytime"
                        }
                        aria-pressed={unlocked}
                        aria-label={
                          autoU
                            ? "Unlocked for this calendar period"
                            : unlocked
                              ? "Unlocked, click to lock"
                              : "Locked, click to unlock"
                        }
                      >
                        {unlocked ? (
                          <Unlock
                            className={cn(
                              "size-4 transition-colors duration-150",
                              "text-emerald-600 dark:text-emerald-400",
                              "group-hover:text-emerald-700 dark:group-hover:text-emerald-300",
                              !autoU && "hover:brightness-110",
                            )}
                            aria-hidden
                          />
                        ) : (
                          <Lock
                            className={cn(
                              "size-4 text-indigo-400 transition-colors duration-150",
                              "group-hover:scale-110 group-hover:text-indigo-600",
                              "dark:text-indigo-500 dark:group-hover:text-indigo-200",
                            )}
                            aria-hidden
                          />
                        )}
                      </button>
                      <button
                        type="button"
                        className="min-w-0 flex-1 rounded-md py-1 pl-0.5 pr-1 text-left transition-colors group-hover:opacity-100"
                        onClick={() => {
                          if (!unlocked) {
                            toast.info(
                              "Use the lock icon to unlock, or wait until the calendar opens this month.",
                            );
                            return;
                          }
                          setExpandedMonth(expanded ? -1 : index);
                        }}
                      >
                        <span className="flex items-center gap-1">
                          <ChevronDown
                            className={cn(
                              "size-4 shrink-0 text-indigo-600 transition-transform dark:text-indigo-300",
                              expanded && unlocked
                                ? "rotate-0"
                                : "-rotate-90",
                              !unlocked && "opacity-50",
                            )}
                            aria-hidden
                          />
                          <span className="block font-bold text-indigo-950 dark:text-indigo-100">
                            {block.title}
                            {index === nowMonthIndex ? (
                              <span className="ml-1.5 text-xs font-normal text-emerald-600 dark:text-emerald-400">
                                (current)
                              </span>
                            ) : null}
                            {earlyU ? (
                              <span className="ml-1.5 text-xs font-normal text-amber-600 dark:text-amber-400">
                                (early)
                              </span>
                            ) : null}
                          </span>
                        </span>
                        <span className="mt-0.5 block pl-5 text-xs font-medium text-indigo-500 dark:text-indigo-300 sm:pl-6">
                          {monthSubtitle(bills)}
                        </span>
                      </button>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 self-center rounded-full px-2.5 py-1 text-xs font-semibold",
                        allPaid
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                          : "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-200",
                      )}
                    >
                      {allPaid ? "Paid" : "Pending"}
                    </span>
                  </div>

                  {expanded && unlocked ? (
                    <div className="space-y-3 border-t border-indigo-100/80 bg-white px-4 py-3 dark:border-border dark:bg-card">
                      <div
                        className={cn(
                          "rounded-lg border border-sky-200/80 bg-sky-50/80 p-3 dark:border-sky-900 dark:bg-sky-950/25",
                          !priorElec && index > 0 && "opacity-80",
                        )}
                      >
                        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-900 dark:text-sky-200">
                          <Zap className="size-3.5" aria-hidden />
                          Electricity for {block.title}
                        </p>
                        {index > 0 && !priorElec ? (
                          <p className="mb-3 text-xs text-amber-800 dark:text-amber-200/90">
                            Add electricity for{" "}
                            <span className="font-medium">
                              {baseMonths[index - 1]?.title ?? `Month ${index}`}
                            </span>{" "}
                            to this invoice first. Month {index + 1}’s
                            <strong> previous kWh</strong> will be that month’s
                            current read.
                          </p>
                        ) : null}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="grid gap-1.5">
                            <Label
                              htmlFor={`elec-prev-${index}`}
                              className="text-xs"
                            >
                              Previous (kWh)
                            </Label>
                            <Input
                              id={`elec-prev-${index}`}
                              type="number"
                              min={0}
                              step={0.01}
                              value={st.prev}
                              disabled={st.applied || (index > 0 && !priorElec)}
                              onChange={(e) =>
                                setElectricByMonth((m) => ({
                                  ...m,
                                  [index]: {
                                    prev: e.target.value,
                                    curr: m[index]?.curr ?? "",
                                    applied: false,
                                  },
                                }))
                              }
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label
                              htmlFor={`elec-curr-${index}`}
                              className="text-xs"
                            >
                              Current (kWh)
                            </Label>
                            <Input
                              id={`elec-curr-${index}`}
                              type="number"
                              min={0}
                              step={0.01}
                              value={st.curr}
                              disabled={st.applied || (index > 0 && !priorElec)}
                              onChange={(e) =>
                                setElectricByMonth((m) => ({
                                  ...m,
                                  [index]: {
                                    prev:
                                      m[index]?.prev ??
                                      (index === 0 ? "0" : ""),
                                    curr: e.target.value,
                                    applied: false,
                                  },
                                }))
                              }
                            />
                          </div>
                        </div>
                        {previewKwh !== null &&
                        Number.isFinite(prevN) &&
                        Number.isFinite(currN) &&
                        st.curr !== "" ? (
                          <p className="mt-2 text-xs text-sky-900/90 dark:text-sky-100/90">
                            Usage {previewKwh.toLocaleString("en-PH")} kWh ·
                            Estimated {formatPHP(previewCost ?? 0)}
                          </p>
                        ) : null}
                        {previewKwh === null &&
                        Number.isFinite(prevN) &&
                        Number.isFinite(currN) &&
                        st.curr !== "" ? (
                          <p className="mt-2 text-xs text-amber-800 dark:text-amber-200/90">
                            Readings are inconsistent (current &lt; previous
                            without rollover). Use current ≥ previous or a high
                            previous read (≥ 90,000).
                          </p>
                        ) : null}
                        <Button
                          type="button"
                          className="mt-3 w-full"
                          disabled={
                            st.applied ||
                            utilityPending ||
                            previewCost === null ||
                            previewCost < 0 ||
                            !unlocked ||
                            (index > 0 && !priorElec)
                          }
                          onClick={() => applyElectric(index)}
                        >
                          {st.applied
                            ? "Electricity on invoice"
                            : utilityPending
                              ? "Saving…"
                              : "Calculate & add to invoice"}
                        </Button>
                      </div>

                      {unlocked &&
                      bills.some((b) => !paidIds.has(b.id)) ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="w-full border-indigo-200 font-semibold dark:border-indigo-800"
                          disabled={!!payingKey}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handlePayAllForMonth(index, block.title);
                          }}
                        >
                          {payingKey === `all:${index}` ? (
                            "Recording…"
                          ) : (
                            <>
                              Pay all unpaid (
                              {
                                bills.filter((b) => !paidIds.has(b.id)).length
                              }
                              ) ·{" "}
                              {formatPHP(
                                bills
                                  .filter((b) => !paidIds.has(b.id))
                                  .reduce((s, b) => s + b.amountPhp, 0),
                              )}
                            </>
                          )}
                        </Button>
                      ) : null}

                      <div className="divide-y rounded-lg border border-indigo-100 dark:border-border">
                        {bills.map((bill) => {
                          const paid = paidIds.has(bill.id);
                          return (
                            <div
                              key={bill.id}
                              className="grid gap-3 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-4"
                            >
                              <div className="min-w-0">
                                <p className="font-semibold text-indigo-950 dark:text-indigo-100">
                                  {bill.label}
                                </p>
                                <p className="text-xs text-indigo-500 dark:text-indigo-300">
                                  Due {formatIsoDateLocal(bill.dueDate)}
                                </p>
                              </div>
                              <p className="text-left font-bold tabular-nums text-indigo-600 dark:text-indigo-300 sm:text-right">
                                {formatPHP(bill.amountPhp)}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                {paid ? (
                                  <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                                    Paid
                                  </span>
                                ) : (
                                  <>
                                    <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-600 dark:bg-red-950/40 dark:text-red-200">
                                      Unpaid
                                    </span>
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
                                      disabled={!!payingKey || !unlocked}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handlePay(bill, block.title, index);
                                      }}
                                    >
                                      {payingKey === `line:${bill.id}`
                                        ? "…"
                                        : "Pay"}
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
