"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, CircleAlert } from "lucide-react";
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
import { ELECTRIC_RATE_PHP_PER_KWH, electricUsageKwh, parseCheckoutMeterInputs } from "@/lib/billing/electric";
import { formatPHP } from "@/lib/format-php";
import { formatIsoDateLocal } from "@/lib/lease-utils";
import { roomShortTitle } from "@/lib/room-display-name";
import { cn } from "@/lib/utils";
import type { CheckoutVacateInput } from "@/lib/schemas/lease-occupancy";
import type { LeaseSummary, OwnerRoom } from "@/lib/types/owner-room";

export type RoomCheckoutCompleteDetail = {
  roomDisplayName: string;
  tenantName: string;
  message: string;
};

export function RoomCheckoutSuccessDialog({
  detail,
  onDismiss,
}: {
  detail: RoomCheckoutCompleteDetail | null;
  onDismiss: () => void;
}) {
  const doneButtonId = "checkout-success-done";

  React.useLayoutEffect(() => {
    if (!detail) return;
    document.getElementById(doneButtonId)?.focus();
  }, [detail]);

  React.useEffect(() => {
    if (!detail) return;
    const blockEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") e.preventDefault();
    };
    window.addEventListener("keydown", blockEscape);
    return () => window.removeEventListener("keydown", blockEscape);
  }, [detail]);

  if (detail === null || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-black/55 supports-backdrop-filter:backdrop-blur-[2px]"
        aria-hidden
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="checkout-success-title"
        className="relative z-[1] grid w-full max-w-md gap-4 rounded-xl border border-emerald-500/25 bg-popover p-4 text-popover-foreground shadow-xl ring-1 ring-foreground/10"
      >
        <div className="flex items-start gap-3 sm:text-left">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-6" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <h2
              id="checkout-success-title"
              className="font-heading text-base font-semibold leading-snug"
            >
              Checkout complete · {detail.roomDisplayName}
            </h2>
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              {detail.tenantName} — unit marked vacant
            </p>
          </div>
        </div>
        <p className="text-base leading-relaxed text-foreground/95">
          {detail.message}
        </p>
        <div className="flex justify-end">
          <Button
            id={doneButtonId}
            type="button"
            className="border-0 bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
            onClick={onDismiss}
          >
            Done
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

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

function ElectricDraftPreview({
  draftPrev,
  draftCurr,
  electricRate,
}: {
  draftPrev: string;
  draftCurr: string;
  electricRate: number;
}) {
  const partial =
    draftPrev.trim() !== "" || draftCurr.trim() !== "";
  const { prevN, currN } = React.useMemo(
    () => parseCheckoutMeterInputs(draftPrev, draftCurr),
    [draftPrev, draftCurr],
  );
  const usage =
    Number.isFinite(prevN) && Number.isFinite(currN)
      ? electricUsageKwh(prevN, currN)
      : null;

  if (!partial) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        Enter both readings as needed, or use &quot;No meter reading&quot; for
        water-only utilities.
      </p>
    );
  }
  if (usage === null) {
    return (
      <p className="text-xs leading-relaxed text-amber-600 dark:text-amber-400">
        Readings aren&apos;t billable yet (current must be ≥ previous, or a rollover
        only when previous is ≥ 90,000 kWh).
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

export function RoomCheckoutDialog({
  room,
  lease,
  open,
  onOpenChange,
  canPersist,
  onCheckoutComplete,
}: {
  room: OwnerRoom;
  lease: LeaseSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canPersist: boolean;
  onCheckoutComplete: (detail: RoomCheckoutCompleteDetail) => void;
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
  const [electricDialogOpen, setElectricDialogOpen] = React.useState(false);
  /** User must finish the electricity dialog (apply valid reads or skip) before confirming checkout. */
  const [electricStepDone, setElectricStepDone] = React.useState(false);

  const [draftPrev, setDraftPrev] = React.useState("");
  const [draftCurr, setDraftCurr] = React.useState("");
  const [draftStart, setDraftStart] = React.useState("");
  const [draftEnd, setDraftEnd] = React.useState("");

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
    setElectricStepDone(false);
    setElectricDialogOpen(false);
  }, [open]);

  React.useEffect(() => {
    if (step === 2) {
      setElectricStepDone(false);
    }
  }, [step]);

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
      const res = await fetchCheckoutElectricPrefillAction(
        room.id,
        lease.leaseStart,
        lease.id,
      );
      if (cancelled) return;
      if (res.ok && res.previousReading != null) {
        setPreviousReading(String(res.previousReading));
      } else if (res.ok) {
        setPreviousReading("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, step, room.id, lease.leaseStart, lease.id]);

  const { prevN: prevNum, currN: currNum } = React.useMemo(
    () => parseCheckoutMeterInputs(previousReading, currentReading),
    [previousReading, currentReading],
  );
  const usage =
    Number.isFinite(prevNum) && Number.isFinite(currNum)
      ? electricUsageKwh(prevNum, currNum)
      : null;
  const elecComplete = usage !== null;
  const elecCost = elecComplete ? usage * electricRate : 0;
  const advance = lease.advancePaidPhp;
  const waterNum = 150;
  const totalUtils = elecCost + waterNum;
  /** Remaining advance after utility charges (deposit is not in this line). */
  const balanceOwed = Math.max(0, totalUtils - advance);
  const refundToTenant = Math.max(0, advance - totalUtils);

  function openElectricDialog() {
    setDraftPrev(previousReading);
    setDraftCurr(currentReading);
    setDraftStart(periodStart);
    setDraftEnd(periodEnd);
    setElectricDialogOpen(true);
  }

  function applyElectricDraft() {
    const { prevN, currN } = parseCheckoutMeterInputs(draftPrev, draftCurr);
    const partial =
      draftPrev.trim() !== "" || draftCurr.trim() !== "";
    const usage =
      Number.isFinite(prevN) && Number.isFinite(currN)
        ? electricUsageKwh(prevN, currN)
        : null;
    if (partial && usage === null) {
      toast.error(
        "Invalid readings: current ≥ previous (0 kWh if equal), or rollover only when previous is ≥ 90,000 kWh. Or clear both fields and use “No meter reading”.",
      );
      return;
    }
    setPreviousReading(draftPrev);
    setCurrentReading(draftCurr);
    setPeriodStart(draftStart);
    setPeriodEnd(draftEnd);
    setElectricStepDone(true);
    setElectricDialogOpen(false);
    toast.success(
      usage !== null && usage > 0
        ? `Electricity set: ${usage.toLocaleString("en-PH")} kWh`
        : "Electricity for checkout saved (no usage).",
    );
  }

  function skipElectricDraft() {
    setPreviousReading("");
    setCurrentReading("");
    const { start, end } = periodForMonthOf(checkoutDate);
    setPeriodStart(start);
    setPeriodEnd(end);
    setDraftPrev("");
    setDraftCurr("");
    setDraftStart(start);
    setDraftEnd(end);
    setElectricStepDone(true);
    setElectricDialogOpen(false);
    toast.success("Checkout will use water only for utilities.");
  }

  function submitCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!canPersist) {
      toast.error("Sign in to save.");
      return;
    }

    if (!electricStepDone) {
      toast.error(
        "Open “Electricity (final)”, then apply your readings or use “No meter reading” before confirming.",
      );
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
        if (res.warning) {
          toast.warning(res.warning, { duration: 12_000 });
        }
        onOpenChange(false);
        onCheckoutComplete({
          roomDisplayName: displayName,
          tenantName: lease.tenantName,
          message:
            "Checkout is saved and this unit is now vacant. You can rent it out again anytime.",
        });
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
            <DialogFooter className="!-mx-0 !-mb-0 gap-2 !rounded-none !border-0 !bg-transparent p-0 pt-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="button" className="h-10" onClick={() => setStep(2)}>
                Continue to checkout
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submitCheckout} className="space-y-8">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">
                Tenant checkout · {displayName}
              </DialogTitle>
            </DialogHeader>

            <section className="space-y-4">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Invoice summary
              </h2>
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Tenant
                </p>
                <p className="text-lg font-semibold leading-tight text-foreground">
                  {lease.tenantName}
                </p>
                <p className="text-sm text-muted-foreground">
                  Checkout date{" "}
                  <span className="font-medium text-foreground">
                    {formatIsoDateLocal(checkoutDate)}
                  </span>
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Advance (on file)</dt>
                <dd className="text-right tabular-nums font-medium">
                  {formatPHP(advance)}
                </dd>
                <dt className="text-muted-foreground">Water (monthly)</dt>
                <dd className="text-right tabular-nums">
                  {formatPHP(waterNum)}
                </dd>
                <dt className="text-muted-foreground">
                  Electricity (final)
                </dt>
                <dd className="text-right">
                  <button
                    type="button"
                    onClick={openElectricDialog}
                    aria-describedby={
                      !electricStepDone
                        ? "checkout-electric-required-hint"
                        : undefined
                    }
                    className={cn(
                      "-mr-1 inline-flex min-h-9 items-center justify-end gap-1 rounded-lg text-right text-sm tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      !electricStepDone
                        ? "border border-amber-500/70 bg-amber-500/15 px-2.5 py-1 font-semibold text-amber-700 shadow-[0_0_0_1px_rgba(245,158,11,0.12)] hover:border-amber-500 hover:bg-amber-500/25 dark:border-amber-400/50 dark:bg-amber-400/10 dark:text-amber-300 dark:hover:bg-amber-400/20"
                        : cn(
                            "min-w-[5.5rem] px-1 font-medium hover:bg-muted/60 hover:text-foreground",
                            elecComplete
                              ? "text-foreground"
                              : "text-muted-foreground",
                          ),
                    )}
                  >
                    {!electricStepDone ? (
                      <>
                        <CircleAlert
                          className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400"
                          aria-hidden
                        />
                        <span>Set electricity</span>
                      </>
                    ) : elecComplete ? (
                      formatPHP(elecCost)
                    ) : (
                      "₱0.00"
                    )}
                  </button>
                  {!electricStepDone ? (
                    <p
                      id="checkout-electric-required-hint"
                      className="sr-only"
                    >
                      Required before checkout: open to enter final meter reads or
                      choose no meter reading.
                    </p>
                  ) : null}
                </dd>
                <dt className="col-span-2 border-t border-border pt-3 font-medium text-foreground">
                  Subtotal — utilities
                </dt>
                <dd className="col-span-2 text-right text-sm font-semibold tabular-nums text-foreground">
                  {electricStepDone ? formatPHP(totalUtils) : "—"}
                </dd>
                <dt className="col-span-2 border-t border-border pt-3 font-medium text-foreground">
                  Remaining advance (refund to tenant)
                </dt>
                <dd className="col-span-2 text-right text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {electricStepDone ? formatPHP(refundToTenant) : "—"}
                </dd>
                {electricStepDone && balanceOwed > 0 ? (
                  <>
                    <dt className="col-span-2 pt-1 text-xs text-red-800 dark:text-red-200/90">
                      Balance tenant may owe (utilities exceed advance)
                    </dt>
                    <dd className="col-span-2 text-right text-sm font-semibold tabular-nums text-red-700 dark:text-red-200">
                      {formatPHP(balanceOwed)}
                    </dd>
                  </>
                ) : null}
              </dl>
            </section>

            <Dialog
              open={electricDialogOpen}
              onOpenChange={setElectricDialogOpen}
            >
              <DialogContent
                className="z-[100] max-h-[90dvh] gap-4 overflow-y-auto border-border/80 sm:max-w-md"
                showCloseButton
              >
                <DialogHeader>
                  <DialogTitle className="text-base font-semibold">
                    Final electricity reading
                  </DialogTitle>
                </DialogHeader>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Enter the meter reads for this checkout period. We bill at{" "}
                  {formatPHP(electricRate)}/kWh. Leave both fields empty and use
                  &quot;No meter reading&quot; if there is no final bill.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="co-prev-d" className="text-xs">
                      Previous (kWh)
                    </Label>
                    <Input
                      id="co-prev-d"
                      type="number"
                      min={0}
                      step={0.01}
                      value={draftPrev}
                      onChange={(e) => setDraftPrev(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="co-curr-d" className="text-xs">
                      Current (kWh)
                    </Label>
                    <Input
                      id="co-curr-d"
                      type="number"
                      min={0}
                      step={0.01}
                      value={draftCurr}
                      onChange={(e) => setDraftCurr(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="co-pstart-d" className="text-xs">
                      Period start
                    </Label>
                    <Input
                      id="co-pstart-d"
                      type="date"
                      value={draftStart}
                      onChange={(e) => setDraftStart(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="co-pend-d" className="text-xs">
                      Period end
                    </Label>
                    <Input
                      id="co-pend-d"
                      type="date"
                      value={draftEnd}
                      onChange={(e) => setDraftEnd(e.target.value)}
                    />
                  </div>
                </div>
                <ElectricDraftPreview
                  draftPrev={draftPrev}
                  draftCurr={draftCurr}
                  electricRate={electricRate}
                />
                <DialogFooter className="!-mx-0 !-mb-0 flex !flex-col gap-2 !border-0 !bg-transparent p-0 sm:!flex-row sm:flex-wrap sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-full sm:w-auto sm:flex-1"
                    onClick={() => setElectricDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-full sm:w-auto sm:flex-1"
                    onClick={skipElectricDraft}
                  >
                    No meter reading
                  </Button>
                  <Button
                    type="button"
                    className="h-10 w-full border-0 bg-emerald-600 font-semibold text-white hover:bg-emerald-700 sm:flex-1"
                    onClick={applyElectricDraft}
                  >
                    Apply to checkout
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className="space-y-3 border-t border-border pt-8">
              <label className="flex items-start gap-3 text-sm leading-snug">
                <input
                  type="checkbox"
                  checked={recordPending}
                  onChange={(e) => setRecordPending(e.target.checked)}
                  className="mt-0.5 size-4 shrink-0 rounded border-input"
                />
                <span>
                  Create a <strong>pending</strong> payment for the balance owed (
                  {electricStepDone ? formatPHP(balanceOwed) : "—"}) when it is
                  greater than zero — due in 7 days.
                </span>
              </label>
              <p className="pl-7 text-xs leading-relaxed text-muted-foreground">
                Uncheck if you only want to vacate the unit and record money
                elsewhere.
              </p>

              <div className="grid gap-2 pt-2">
                <Label htmlFor="co-notes" className="text-xs text-muted-foreground">
                  Settlement notes (optional)
                </Label>
                <Input
                  id="co-notes"
                  value={settlementNotes}
                  onChange={(e) => setSettlementNotes(e.target.value)}
                  placeholder="Attached to utility reading / payment"
                />
              </div>
            </div>

            <DialogFooter className="!-mx-0 !-mb-0 mt-2 flex !flex-col gap-2 !rounded-none !border-0 !border-t !border-border !bg-transparent p-0 pt-6 sm:!flex-row sm:justify-stretch sm:gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                className="h-10 w-full sm:flex-1"
              >
                Back
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-10 w-full sm:flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!canPersist || pending || !electricStepDone}
                className="h-10 w-full border-0 bg-emerald-600 font-semibold text-white hover:bg-emerald-700 sm:flex-1"
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
