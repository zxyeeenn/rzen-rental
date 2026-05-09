"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import { ChevronDown, CircleAlert, Lock, Unlock, Zap } from "lucide-react";
import { toast } from "sonner";

import {
  fetchInvoiceElectricFromDbAction,
  recordPaidInvoiceLineAction,
  recordUtilityReadingAction,
  saveLeaseInvoiceUiStateAction,
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
  parseInvoiceMeterInputs,
} from "@/lib/billing/electric";
import { formatPHP } from "@/lib/format-php";
import { buildInvoicePaymentNote } from "@/lib/invoice-notes";
import {
  currentLeaseMonthIndex,
  dueDateForBillingMonth,
  formatIsoDateLocal,
  invoiceUtilityPeriodFromDueDateIso,
  parseLocalDateOnly,
} from "@/lib/lease-utils";
import {
  electricStateFromPersisted,
  electricStateToPersisted,
  invoiceUiStateHasData,
  isMissingLeasesInvoiceUiStateColumnError,
  type InvoiceMonthElectric,
} from "@/lib/schemas/invoice-ui-state";
import type { LeaseSummary } from "@/lib/types/owner-room";
import { cn } from "@/lib/utils";

type MonthElectric = InvoiceMonthElectric;

const WIFI_MONTHLY_FEE_PHP = 500;
const WATER_MONTHLY_FEE_PHP = 150;

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

const invoiceElectricLocalKey = (leaseId: string) =>
  `rzen:invoiceElectricByMonth:${leaseId}`;

function loadInvoiceElectricLocal(leaseId: string): Record<
  number,
  MonthElectric
> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(invoiceElectricLocalKey(leaseId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const out: Record<number, MonthElectric> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const i = Number(k);
      if (!Number.isInteger(i) || i < 0) continue;
      if (!v || typeof v !== "object") continue;
      const o = v as Record<string, unknown>;
      const prev = typeof o.prev === "string" ? o.prev : "";
      const curr = typeof o.curr === "string" ? o.curr : "";
      const applied = Boolean(o.applied);
      out[i] = { prev, curr, applied };
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

function saveInvoiceElectricLocal(
  leaseId: string,
  m: Record<number, MonthElectric>,
): void {
  try {
    localStorage.setItem(invoiceElectricLocalKey(leaseId), JSON.stringify(m));
  } catch {
    /* quota / private mode */
  }
}

function mergeElectricPreferLocal(
  base: Record<number, MonthElectric>,
  local: Record<number, MonthElectric> | null,
): Record<number, MonthElectric> {
  if (!local) return base;
  const out: Record<number, MonthElectric> = { ...base };
  for (const [k, v] of Object.entries(local)) {
    const i = Number(k);
    if (!Number.isInteger(i) || i < 0) continue;
    if (!v.applied) continue;
    const b = out[i];
    if (!b?.applied) {
      out[i] = { prev: v.prev, curr: v.curr, applied: true };
      continue;
    }
    const baseEmpty = b.prev.trim() === "" && b.curr.trim() === "";
    const localHasReads =
      v.prev.trim() !== "" || v.curr.trim() !== "";
    if (baseEmpty && localHasReads) {
      out[i] = { prev: v.prev, curr: v.curr, applied: true };
    }
  }
  return out;
}

const LEASE_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isPersistableLeaseId(leaseId: string): boolean {
  return LEASE_UUID_RE.test(leaseId);
}

function InvoiceElectricDraftPreview({
  draftPrev,
  draftCurr,
  monthIndex,
  electricRate,
}: {
  draftPrev: string;
  draftCurr: string;
  monthIndex: number;
  electricRate: number;
}) {
  const { prevN, currN } = React.useMemo(
    () => parseInvoiceMeterInputs(draftPrev, draftCurr, monthIndex),
    [draftPrev, draftCurr, monthIndex],
  );
  const usage =
    Number.isFinite(prevN) && Number.isFinite(currN)
      ? electricUsageKwh(prevN, currN)
      : null;

  const partial =
    draftPrev.trim() !== "" || draftCurr.trim() !== "";
  if (!partial) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        Enter previous and current reads, then apply to add electricity to this
        month&apos;s invoice.
      </p>
    );
  }
  if (usage === null) {
    return (
      <p className="text-xs leading-relaxed text-amber-600 dark:text-amber-400">
        Readings aren&apos;t billable yet (current must be ≥ previous, or a
        rollover only when previous is ≥ 90,000 kWh).
      </p>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm">
      <p className="tabular-nums text-foreground">
        <span className="font-medium">
          {usage.toLocaleString("en-PH")} kWh
        </span>{" "}
        × {formatPHP(electricRate)}{" "}
        <span className="font-semibold">
          = {formatPHP(usage * electricRate)}
        </span>
      </p>
    </div>
  );
}

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
  const [electricDialogMonth, setElectricDialogMonth] = React.useState<
    number | null
  >(null);
  const [electricDraftPrev, setElectricDraftPrev] = React.useState("");
  const [electricDraftCurr, setElectricDraftCurr] = React.useState("");
  const [utilityPending, startUtility] = React.useTransition();
  const [, startPay] = React.useTransition();
  /** Single-flight pay: which button is in progress (or `all:{index}` for bulk). */
  const [payingKey, setPayingKey] = React.useState<string | null>(null);
  const [manualUnlocked, setManualUnlocked] = React.useState<Set<number>>(
    () => new Set(),
  );
  const persistSkipRef = React.useRef(0);
  const electricFocusMonthRef = React.useRef<number | null>(null);
  const [invoiceDbSyncBlocked, setInvoiceDbSyncBlocked] =
    React.useState(false);

  function closeInvoiceElectricDialog(
    focusMonthIndex: number | null = electricDialogMonth,
  ) {
    const idx = focusMonthIndex ?? electricFocusMonthRef.current;
    setElectricDialogMonth(null);
    electricFocusMonthRef.current = null;
    if (idx != null && typeof document !== "undefined") {
      window.requestAnimationFrame(() => {
        document.getElementById(`invoice-set-electric-${idx}`)?.focus();
      });
    }
  }

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
    if (!open) return;

    persistSkipRef.current = 2;
    setInvoiceDbSyncBlocked(false);

    setExpandedMonth(
      Math.min(nowMonthIndex, Math.max(0, baseMonths.length - 1)),
    );

    const calMonthIndex = currentLeaseMonthIndex(
      lease.leaseStart,
      baseMonths.length,
    );
    const fromStorageUnlock = loadManualUnlocked(lease.id);
    const prunedUnlock = new Set(
      [...fromStorageUnlock].filter((i) => i > calMonthIndex),
    );
    if (prunedUnlock.size !== fromStorageUnlock.size) {
      saveManualUnlocked(lease.id, prunedUnlock);
    }

    const server = lease.invoiceUiState;
    const hasServer =
      isPersistableLeaseId(lease.id) &&
      canPersist &&
      invoiceUiStateHasData(server);

    let nextPaid: Set<string>;
    let nextManual: Set<number>;
    let nextElectric: Record<number, MonthElectric>;

    if (hasServer) {
      nextPaid = new Set(server.paidLineIds ?? []);
      nextManual = new Set(
        [...(server.manualUnlockedMonths ?? [])].filter(
          (i) => i > calMonthIndex,
        ),
      );
      nextElectric = electricStateFromPersisted(server.electricByMonth);
    } else {
      nextPaid = loadPaidSet(lease.id);
      nextManual = prunedUnlock;
      nextElectric = electricStateFromPersisted(undefined);
    }

    nextElectric = mergeElectricPreferLocal(
      nextElectric,
      loadInvoiceElectricLocal(lease.id),
    );

    savePaidSet(lease.id, nextPaid);
    saveManualUnlocked(lease.id, nextManual);

    setPaidIds(nextPaid);
    setManualUnlocked(nextManual);
    setElectricByMonth(nextElectric);
    setElectricDialogMonth(null);
  }, [
    open,
    lease.id,
    lease.invoiceUiState,
    canPersist,
    nowMonthIndex,
    baseMonths.length,
    lease.leaseStart,
  ]);

  React.useEffect(() => {
    if (!open || !canPersist || !isPersistableLeaseId(lease.id)) return;
    let cancelled = false;
    void (async () => {
      const res = await fetchInvoiceElectricFromDbAction({
        roomId,
        leaseId: lease.id,
        leaseStart: lease.leaseStart,
        rentDueDay: lease.rentDueDay,
        monthCount: baseMonths.length,
      });
      if (cancelled || !res.ok) return;
      setElectricByMonth((prev) => {
        const indices = Object.keys(res.byMonthIndex)
          .map(Number)
          .filter((n) => Number.isInteger(n) && n >= 0)
          .sort((a, b) => a - b);
        if (indices.length === 0) return prev;

        let next: Record<number, MonthElectric> = { ...prev };
        for (const i of indices) {
          const v = res.byMonthIndex[String(i)]!;
          next[i] = { prev: v.prev, curr: v.curr, applied: true };
          const c = v.curr;
          if (c !== "" && i + 1 < baseMonths.length) {
            const fut = next[i + 1];
            if (!fut?.applied) {
              next[i + 1] = {
                prev: c,
                curr: fut?.curr ?? "",
                applied: false,
              };
            }
          }
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [
    open,
    canPersist,
    roomId,
    lease.id,
    lease.leaseStart,
    lease.rentDueDay,
    baseMonths.length,
  ]);

  const paidKey = [...paidIds].sort().join("\n");
  const manualKey = [...manualUnlocked].sort((a, b) => a - b).join(",");
  const electricKey = JSON.stringify(electricByMonth);

  React.useEffect(() => {
    if (!open || !canPersist || !isPersistableLeaseId(lease.id)) return;
    if (persistSkipRef.current > 0) {
      persistSkipRef.current -= 1;
      return;
    }
    const t = window.setTimeout(() => {
      saveInvoiceElectricLocal(lease.id, electricByMonth);
      if (invoiceDbSyncBlocked) return;
      void (async () => {
        const res = await saveLeaseInvoiceUiStateAction({
          leaseId: lease.id,
          paidLineIds: [...paidIds],
          manualUnlockedMonths: [...manualUnlocked].sort((a, b) => a - b),
          electricByMonth: electricStateToPersisted(electricByMonth),
        });
        if (!res.ok) {
          if (isMissingLeasesInvoiceUiStateColumnError(res.error)) {
            setInvoiceDbSyncBlocked(true);
            toast.error(
              "Cloud sync is off: the leases.invoice_ui_state column is missing. Run migration 20260509120000_lease_invoice_ui_state.sql in the Supabase SQL Editor (or supabase db push), wait a minute, then refresh. Your electricity readings are still in utility_readings and cached on this device.",
              { id: "lease-invoice-ui-state-migration", duration: 16_000 },
            );
            return;
          }
          toast.error(`Could not sync invoice progress. ${res.error}`);
        }
      })();
    }, 500);
    return () => window.clearTimeout(t);
  }, [
    open,
    canPersist,
    lease.id,
    paidKey,
    manualKey,
    electricKey,
    paidIds,
    manualUnlocked,
    electricByMonth,
    invoiceDbSyncBlocked,
  ]);

  function getElectricState(index: number): MonthElectric {
    const b = electricByMonth[index];
    if (index === 0) {
      return {
        prev: b?.prev ?? "",
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
    const { prevN, currN } = parseInvoiceMeterInputs(
      st.prev,
      st.curr,
      index,
    );
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
          notes: buildInvoicePaymentNote(monthTitle, bill.label),
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
            notes: buildInvoicePaymentNote(monthTitle, bill.label),
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

  function openInvoiceElectricDialog(index: number) {
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
    electricFocusMonthRef.current = index;
    const st = getElectricState(index);
    setElectricDraftPrev(st.prev);
    setElectricDraftCurr(st.curr);
    setElectricDialogMonth(index);
  }

  function applyElectricWithReads(
    index: number,
    prevRaw: string,
    currRaw: string,
  ) {
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
    const { prevN, currN } = parseInvoiceMeterInputs(
      prevRaw,
      currRaw,
      index,
    );
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
    const { start, end } = invoiceUtilityPeriodFromDueDateIso(dueDate);
    const monthTitle = baseMonths[index]?.title ?? `Month ${index + 1}`;

    const applyLocal = (fromDuplicateDbRow?: boolean) => {
      setElectricByMonth((m) => {
        const next: Record<number, MonthElectric> = {
          ...m,
          [index]: { prev: prevRaw, curr: currRaw, applied: true },
        };
        if (index + 1 < baseMonths.length) {
          const c = currRaw;
          if (c !== "") {
            const fut = m[index + 1];
            if (!fut?.applied) {
              next[index + 1] = { prev: c, curr: fut?.curr ?? "", applied: false };
            }
          }
        }
        return next;
      });
      toast.success(
        fromDuplicateDbRow
          ? "That electricity reading was already saved — invoice updated."
          : "Electricity added to this month’s invoice",
      );
      closeInvoiceElectricDialog(index);
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
      fd.set(
        "notes",
        `Payment invoice — ${monthTitle} · lease:${lease.id}`,
      );

      const res = await recordUtilityReadingAction(fd);
      if (!res.ok) {
        const msg = res.error;
        const duplicateRow =
          /duplicate key|unique constraint/i.test(msg) ||
          msg.includes("23505");
        if (duplicateRow) {
          applyLocal(true);
          return;
        }
        toast.error(msg);
        return;
      }
      applyLocal();
    });
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto border-border/60 p-4 sm:max-w-lg sm:p-6">
        <DialogHeader className="space-y-1.5 pb-2">
          <DialogTitle className="text-lg font-semibold tracking-tight sm:text-xl">
            Payment invoice · {roomDisplayName}
          </DialogTitle>
        </DialogHeader>

        {!canPersist ? (
          <div
            role="status"
            className="mb-3 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-950 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100"
          >
            <p className="font-semibold">Saved on this device only</p>
            <p className="mt-1 leading-relaxed text-amber-900/90 dark:text-amber-100/85">
              Paid lines, electricity reads, and early month unlocks stay in this
              browser until you sign in. Sign in to sync them to your account.
            </p>
          </div>
        ) : null}

        {canPersist && invoiceDbSyncBlocked ? (
          <div
            role="alert"
            className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100"
          >
            <p className="font-semibold">Cloud sync paused (database migration)</p>
            <p className="mt-1 leading-relaxed text-amber-900/90 dark:text-amber-100/85">
              Apply{" "}
              <span className="font-mono text-[11px]">
                supabase/migrations/20260509120000_lease_invoice_ui_state.sql
              </span>{" "}
              in your Supabase project (SQL Editor → paste → Run, or{" "}
              <span className="font-mono text-[11px]">supabase db push</span>
              ). After PostgREST refreshes its schema cache, reload this page. Invoice
              lines stay working here via your browser and existing utility readings.
            </p>
          </div>
        ) : null}

        <div className="space-y-6 pt-1">
          <div className="rounded-xl border border-border/70 bg-muted/25 px-4 py-4 text-sm dark:bg-muted/15">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Billing phase
            </p>
            <p className="mt-2 text-base font-semibold leading-snug text-foreground">
              Month 1 (Setup) — {finalMonth}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Move-in {formatIsoDateLocal(lease.leaseStart)} <span aria-hidden>·</span>{" "}
              Checkout{" "}
              {lease.leaseEnd
                ? formatIsoDateLocal(lease.leaseEnd)
                : "Open-ended"}
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-border/80">
            {baseMonths.map((block, index) => {
              const expanded = expandedMonth === index;
              const bills = billsForMonth(index);
              const st = getElectricState(index);
              const priorElec = priorMonthElectricOnInvoice(index);
              const allPaid = monthAllPaid(index);
              const autoU = isAutoUnlocked(index);
              const earlyU = !autoU && manualUnlocked.has(index);
              const unlocked = autoU || manualUnlocked.has(index);

              return (
                <div key={block.title} className="border-b last:border-b-0">
                  <div
                    className={cn(
                      "group flex w-full items-center justify-between gap-2 px-3 py-3.5 sm:gap-3 sm:px-5",
                      "bg-muted/30 dark:bg-muted/10",
                      "transition-colors hover:bg-muted/45 dark:hover:bg-muted/20",
                      expanded &&
                        unlocked &&
                        "bg-muted/50 dark:bg-muted/25",
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-1.5 sm:gap-2">
                      <button
                        type="button"
                        className={cn(
                          "mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg border transition-all duration-150",
                          "bg-background/80 dark:bg-background/40",
                          "group-hover:border-border group-hover:bg-background dark:group-hover:bg-background/60",
                          autoU
                            ? "cursor-default border-emerald-500/40 dark:border-emerald-600/50"
                            : "border-border",
                          !autoU &&
                            "hover:border-primary/50",
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
                              "size-4 text-muted-foreground transition-colors duration-150",
                              "group-hover:text-foreground",
                            )}
                            aria-hidden
                          />
                        )}
                      </button>
                      <button
                        type="button"
                        className="min-w-0 flex-1 rounded-md py-1 pl-0.5 pr-1 text-left transition-colors group-hover:opacity-100"
                        aria-expanded={expanded}
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
                              "size-4 shrink-0 text-muted-foreground transition-transform",
                              expanded && unlocked
                                ? "rotate-0"
                                : "-rotate-90",
                              !unlocked && "opacity-45",
                            )}
                            aria-hidden
                          />
                          <span className="block font-semibold text-foreground">
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
                        <span className="mt-1 block pl-5 text-sm text-muted-foreground sm:pl-6">
                          {monthSubtitle(bills)}
                        </span>
                      </button>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 self-center rounded-full px-3 py-1 text-xs font-medium",
                        allPaid
                          ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                          : "bg-amber-500/15 text-amber-900 dark:text-amber-200",
                      )}
                    >
                      {allPaid ? "Paid" : "Pending"}
                    </span>
                  </div>

                  {expanded && unlocked ? (
                    <div className="space-y-5 border-t border-border/70 bg-card/40 px-4 py-5 sm:px-5 dark:bg-card/20">
                      <div
                        className={cn(
                          "rounded-xl border border-border/80 bg-muted/20 p-4 dark:bg-muted/10",
                          !priorElec && index > 0 && "opacity-85",
                        )}
                      >
                        <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          <Zap
                            className="size-3.5 text-amber-600/90 dark:text-amber-400"
                            aria-hidden
                          />
                          Electricity · {block.title}
                        </p>
                        {index > 0 && !priorElec ? (
                          <p className="mb-3 text-xs text-amber-800 dark:text-amber-200/90">
                            Add electricity for{" "}
                            <span className="font-medium">
                              {baseMonths[index - 1]?.title ??
                                `Month ${index}`}
                            </span>{" "}
                            to this invoice first. Month {index + 1}’s
                            <strong> previous kWh</strong> will be that month’s
                            current read.
                          </p>
                        ) : null}
                        {st.applied ? (
                          (() => {
                            const { prevN, currN } = parseInvoiceMeterInputs(
                              st.prev,
                              st.curr,
                              index,
                            );
                            const kwh = electricUsageKwh(prevN, currN);
                            const cost = electricChargePhp(prevN, currN);
                            return (
                              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                                {kwh != null && cost != null ? (
                                  <>
                                    Electricity on invoice ·{" "}
                                    {kwh.toLocaleString("en-PH")} kWh ·{" "}
                                    {formatPHP(cost)}
                                  </>
                                ) : (
                                  "Electricity on invoice"
                                )}
                              </p>
                            );
                          })()
                        ) : (
                          <div className="space-y-3">
                            <p className="text-xs leading-relaxed text-muted-foreground">
                              Enter meter reads in the calculator to add
                              electricity to this month&apos;s bill list.
                            </p>
                            <Button
                              type="button"
                              id={`invoice-set-electric-${index}`}
                              className={cn(
                                "inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                                "border border-amber-500/70 bg-amber-500/15 text-amber-700 shadow-[0_0_0_1px_rgba(245,158,11,0.12)] hover:border-amber-500 hover:bg-amber-500/25 dark:border-amber-400/50 dark:bg-amber-400/10 dark:text-amber-300 dark:hover:bg-amber-400/20",
                              )}
                              disabled={
                                !unlocked || (index > 0 && !priorElec)
                              }
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openInvoiceElectricDialog(index);
                              }}
                            >
                              <CircleAlert
                                className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400"
                                aria-hidden
                              />
                              Set electricity
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="divide-y divide-border/70 rounded-xl border border-border/80">
                        {bills.map((bill) => {
                          const paid = paidIds.has(bill.id);
                          return (
                            <div
                              key={bill.id}
                              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-medium leading-snug text-foreground">
                                  {bill.label}
                                </p>
                                <p className="mt-1.5 text-sm text-muted-foreground">
                                  Due {formatIsoDateLocal(bill.dueDate)}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 sm:shrink-0">
                                <p className="min-w-[6.5rem] text-right font-semibold tabular-nums text-foreground">
                                  {formatPHP(bill.amountPhp)}
                                </p>
                                {paid ? (
                                  <span className="inline-flex rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                                    Paid
                                  </span>
                                ) : (
                                  <>
                                    <span className="inline-flex rounded-full bg-amber-500/12 px-2.5 py-1 text-xs font-medium text-amber-900 dark:text-amber-200">
                                      Unpaid
                                    </span>
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="border-0 bg-emerald-600 px-4 font-bold text-white hover:bg-emerald-700"
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

                      {unlocked &&
                      bills.some((b) => !paidIds.has(b.id)) ? (
                        <Button
                          type="button"
                          className="h-11 w-full border-0 bg-emerald-600 text-base font-bold text-white hover:bg-emerald-700"
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
                              ) — Total:{" "}
                              {formatPHP(
                                bills
                                  .filter((b) => !paidIds.has(b.id))
                                  .reduce((s, b) => s + b.amountPhp, 0),
                              )}{" "}
                              <span className="text-xs font-normal opacity-90">
                                (PHP)
                              </span>
                            </>
                          )}
                        </Button>
                      ) : null}
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

    <Dialog
      open={open && electricDialogMonth !== null}
      onOpenChange={(o) => {
        if (!o) closeInvoiceElectricDialog();
      }}
    >
      <DialogContent
        className="z-[100] max-h-[90dvh] gap-4 overflow-y-auto border-border/80 sm:max-w-md"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Electricity ·{" "}
            {electricDialogMonth != null
              ? baseMonths[electricDialogMonth]?.title ?? "Month"
              : ""}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Enter the meter reads for this billing month. We bill at{" "}
          {formatPHP(ELECTRIC_RATE_PHP_PER_KWH)}/kWh. This matches the
          checkout “Set electricity” flow — readings are saved when you
          apply (if you are signed in).
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="inv-elec-prev" className="text-xs">
              Previous (kWh)
            </Label>
            <Input
              id="inv-elec-prev"
              type="number"
              min={0}
              step={0.01}
              value={electricDraftPrev}
              onChange={(e) => setElectricDraftPrev(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="inv-elec-curr" className="text-xs">
              Current (kWh)
            </Label>
            <Input
              id="inv-elec-curr"
              type="number"
              min={0}
              step={0.01}
              value={electricDraftCurr}
              onChange={(e) => setElectricDraftCurr(e.target.value)}
            />
          </div>
        </div>
        {electricDialogMonth !== null ? (
          <InvoiceElectricDraftPreview
            draftPrev={electricDraftPrev}
            draftCurr={electricDraftCurr}
            monthIndex={electricDialogMonth}
            electricRate={ELECTRIC_RATE_PHP_PER_KWH}
          />
        ) : null}
        <DialogFooter className="!mx-0 !mb-0 flex !flex-col gap-2 !border-0 !bg-transparent p-0 sm:!flex-row sm:flex-wrap sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full sm:w-auto sm:flex-1"
            onClick={() => closeInvoiceElectricDialog()}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-10 w-full border-0 bg-emerald-600 font-semibold text-white hover:bg-emerald-700 sm:flex-1"
            disabled={
              electricDialogMonth === null ||
              utilityPending ||
              (() => {
                if (electricDialogMonth === null) return true;
                const { prevN, currN } = parseInvoiceMeterInputs(
                  electricDraftPrev,
                  electricDraftCurr,
                  electricDialogMonth,
                );
                const u = electricUsageKwh(prevN, currN);
                const c = electricChargePhp(prevN, currN);
                return u === null || c === null || c < 0;
              })()
            }
            onClick={() => {
              if (electricDialogMonth === null) return;
              applyElectricWithReads(
                electricDialogMonth,
                electricDraftPrev,
                electricDraftCurr,
              );
            }}
          >
            {utilityPending ? "Saving…" : "Calculate & add to invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
