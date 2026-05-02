"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  checkoutAndVacateAction,
  fetchCheckoutElectricPrefillAction,
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
import { ELECTRIC_RATE_PHP_PER_KWH, electricUsageKwh } from "@/lib/billing/electric";
import { formatPHP } from "@/lib/format-php";
import { formatIsoDateLocal } from "@/lib/lease-utils";
import { roomShortTitle } from "@/lib/room-display-name";
import type { CheckoutVacateInput } from "@/lib/schemas/lease-occupancy";
import type { LeaseSummary, OwnerRoom } from "@/lib/types/owner-room";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function periodForMonthOf(isoDate: string): { start: string; end: string } {
  const [y, m] = isoDate.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  return { start: fmt(start), end: fmt(end) };
}

export function RoomCheckoutDialog({
  room,
  lease,
  open,
  onOpenChange,
  canPersist,
  onSuccess,
}: {
  room: OwnerRoom;
  lease: LeaseSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canPersist: boolean;
  onSuccess: () => void;
}) {
  const [step, setStep] = React.useState<1 | 2>(1);
  const [pending, start] = React.useTransition();

  /** Always “today” when the dialog opens — no manual date (avoids mismatch with settlement). */
  const [checkoutDate, setCheckoutDate] = React.useState(todayIso);
  const electricRate = ELECTRIC_RATE_PHP_PER_KWH;
  const [previousReading, setPreviousReading] = React.useState("");
  const [currentReading, setCurrentReading] = React.useState("");
  const [periodStart, setPeriodStart] = React.useState("");
  const [periodEnd, setPeriodEnd] = React.useState("");
  const [recordPending, setRecordPending] = React.useState(false);
  const [settlementNotes, setSettlementNotes] = React.useState("");

  const displayName = roomShortTitle(room);

  React.useEffect(() => {
    if (!open) return;
    setStep(1);
    const t = todayIso();
    setCheckoutDate(t);
    const { start: ps, end: pe } = periodForMonthOf(t);
    setPeriodStart(ps);
    setPeriodEnd(pe);
    setPreviousReading("");
    setCurrentReading("");
    setRecordPending(false);
    setSettlementNotes("");
  }, [open]);

  React.useEffect(() => {
    if (step !== 2) return;
    const { start: ps, end: pe } = periodForMonthOf(checkoutDate);
    setPeriodStart(ps);
    setPeriodEnd(pe);
  }, [checkoutDate, step]);

  React.useEffect(() => {
    if (!open || step !== 2) return;
    let cancelled = false;
    void (async () => {
      const res = await fetchCheckoutElectricPrefillAction(room.id);
      if (cancelled) return;
      if (res.ok && res.previousReading != null) {
        setPreviousReading(String(res.previousReading));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, step, room.id]);

  const prevNum =
    previousReading.trim() === "" ? NaN : Number(previousReading);
  const currNum =
    currentReading.trim() === "" ? NaN : Number(currentReading);
  const waterNum = 150;
  const usage =
    Number.isFinite(prevNum) && Number.isFinite(currNum)
      ? electricUsageKwh(prevNum, currNum)
      : null;
  const elecComplete = usage !== null;
  const elecCost = elecComplete ? usage * electricRate : 0;
  const advance = lease.advancePaidPhp;
  const totalUtils = elecCost + waterNum;
  /** Remaining advance after utility charges (deposit is not in this line). */
  const balanceOwed = Math.max(0, totalUtils - advance);
  const refundToTenant = Math.max(0, advance - totalUtils);

  function submitCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!canPersist) {
      toast.error("Sign in to save.");
      return;
    }

    if (
      (previousReading.trim() !== "" || currentReading.trim() !== "") &&
      !elecComplete
    ) {
      toast.error(
        "Enter valid electric readings: current ≥ previous (0 kWh if equal), or a rollover only when previous is ≥ 90,000 kWh. Or clear both reading fields.",
      );
      return;
    }

    const payload: CheckoutVacateInput = {
      roomId: room.id,
      leaseId: lease.id,
      checkoutDate,
      electricRatePerKwh: electricRate,
      waterChargePhp: waterNum,
      recordPendingBalance: recordPending,
      settlementNotes: settlementNotes.trim() || undefined,
    };

    if (elecComplete) {
      Object.assign(payload, {
        previousReading: prevNum,
        currentReading: currNum,
        periodStart,
        periodEnd,
      });
    }

    start(async () => {
      const res = await checkoutAndVacateAction(payload);
      if (res.ok) {
        toast.success(res.message ?? "Unit marked vacant");
        onOpenChange(false);
        onSuccess();
        return;
      }
      toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle>Mark {displayName} as available?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              This ends the active lease for{" "}
              <span className="font-medium text-foreground">
                {lease.tenantName}
              </span>{" "}
              and sets the unit to <strong>Vacant</strong>.
            </p>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="button" onClick={() => setStep(2)}>
                Continue to checkout
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submitCheckout} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Tenant checkout invoice · {displayName}</DialogTitle>
            </DialogHeader>

            <div className="rounded-lg border border-indigo-200/60 bg-indigo-50/50 p-3 text-sm dark:border-indigo-900 dark:bg-indigo-950/20">
              <p className="text-xs font-bold uppercase tracking-wide text-indigo-800 dark:text-indigo-200">
                Final checkout invoice
              </p>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-indigo-600/80 dark:text-indigo-400/90">
                Tenant
              </p>
              <p className="mt-0.5 text-lg font-semibold leading-tight text-indigo-950 dark:text-indigo-50">
                {lease.tenantName}
              </p>
              <p className="mb-2 mt-2.5 text-xs text-muted-foreground">
                Checkout date:{" "}
                <span className="font-medium text-foreground">
                  {formatIsoDateLocal(checkoutDate)}
                </span>
              </p>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <dt className="text-muted-foreground">Advance (on file)</dt>
                <dd className="text-right tabular-nums font-medium">
                  {formatPHP(advance)}
                </dd>
                <dt className="text-muted-foreground">Water (monthly)</dt>
                <dd className="text-right tabular-nums">
                  {formatPHP(waterNum)}
                </dd>
                <dt className="text-muted-foreground">Electricity (final)</dt>
                <dd className="text-right tabular-nums">
                  {elecComplete ? formatPHP(elecCost) : "—"}
                </dd>
                <dt className="col-span-2 border-t border-indigo-200/70 pt-1.5 font-medium text-foreground dark:border-indigo-800">
                  Subtotal — utilities
                </dt>
                <dd className="col-span-2 text-right text-sm font-bold tabular-nums text-indigo-900 dark:text-indigo-100">
                  {formatPHP(totalUtils)}
                </dd>
                <dt className="col-span-2 border-t border-indigo-200/70 pt-1.5 font-medium text-foreground dark:border-indigo-800">
                  Remaining advance (refund to tenant)
                </dt>
                <dd className="col-span-2 text-right text-base font-bold tabular-nums text-emerald-800 dark:text-emerald-200">
                  {formatPHP(refundToTenant)}
                </dd>
                {balanceOwed > 0 ? (
                  <>
                    <dt className="col-span-2 text-xs text-red-800 dark:text-red-200/90">
                      Balance tenant may owe (utilities exceed advance)
                    </dt>
                    <dd className="col-span-2 text-right text-sm font-semibold tabular-nums text-red-700 dark:text-red-200">
                      {formatPHP(balanceOwed)}
                    </dd>
                  </>
                ) : null}
              </dl>
            </div>

            <div className="space-y-3 rounded-lg border border-sky-200/90 bg-sky-50/80 p-3 dark:border-sky-900 dark:bg-sky-950/30">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-900 dark:text-sky-200">
                Final electricity reading
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="co-prev">Previous reading (kWh)</Label>
                  <Input
                    id="co-prev"
                    type="number"
                    min={0}
                    step={0.01}
                    value={previousReading}
                    onChange={(e) => setPreviousReading(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="co-curr">Current reading (kWh)</Label>
                  <Input
                    id="co-curr"
                    type="number"
                    min={0}
                    step={0.01}
                    value={currentReading}
                    onChange={(e) => setCurrentReading(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="co-pstart">Period start</Label>
                  <Input
                    id="co-pstart"
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="co-pend">Period end</Label>
                  <Input
                    id="co-pend"
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-sky-200/80 bg-sky-50/50 p-3 text-xs text-sky-900 dark:border-sky-900 dark:bg-sky-950/20 dark:text-sky-100/90">
              <p className="font-semibold">How it works</p>
              <ol className="mt-1 list-decimal space-y-1 pl-4">
                <li>Enter the final electric meter read (or leave blank).</li>
                <li>Water is the standard monthly {formatPHP(150)}.</li>
                <li>
                  Refund is <strong>advance minus utility charges</strong>. If
                  utilities are more than the advance, the tenant may owe the
                  difference.
                </li>
                <li>
                  You can create a pending payment if the tenant still owes a
                  balance after checkout.
                </li>
              </ol>
            </div>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={recordPending}
                onChange={(e) => setRecordPending(e.target.checked)}
                className="mt-1 rounded border-input"
              />
              <span>
                Create a <strong>pending</strong> payment for the balance owed (
                {formatPHP(balanceOwed)}) when it is greater than zero — due in
                7 days.
              </span>
            </label>
            <p className="text-xs text-muted-foreground">
              Uncheck if you only want to vacate the unit and record money
              elsewhere.
            </p>

            <div className="grid gap-2">
              <Label htmlFor="co-notes">Settlement notes (optional)</Label>
              <Input
                id="co-notes"
                value={settlementNotes}
                onChange={(e) => setSettlementNotes(e.target.value)}
                placeholder="Attached to utility reading / payment"
              />
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                className="w-full sm:w-auto"
              >
                Back
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!canPersist || pending}
                className="w-full sm:w-auto"
              >
                {pending ? "Saving…" : "Confirm & mark vacant"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
