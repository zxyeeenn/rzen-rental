"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MoreVertical, Pencil, ReceiptText, Wrench } from "lucide-react";
import { toast } from "sonner";

import { updateRoomStatusAction } from "@/app/(app)/dashboard/actions";
import { RoomCheckoutDialog } from "@/components/dashboard/room-checkout-dialog";
import { RoomEditRateDialog } from "@/components/dashboard/room-edit-rate-dialog";
import { RoomOccupyDialog } from "@/components/dashboard/room-occupy-dialog";
import { RoomPaymentInvoiceDialog } from "@/components/dashboard/room-payment-invoice-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardFooter,
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
import { formatPHP } from "@/lib/format-php";
import { formatIsoDateLocal } from "@/lib/lease-utils";
import { roomShortTitle } from "@/lib/room-display-name";
import type { RoomStatus } from "@/lib/schemas/room-status";
import type { OwnerRoom } from "@/lib/types/owner-room";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<RoomStatus, string> = {
  vacant: "Vacant",
  occupied: "Occupied",
  maintenance: "Maintenance",
};

const STATUS_BADGE: Record<RoomStatus, string> = {
  vacant:
    "border-0 bg-emerald-600/15 text-emerald-800 dark:text-emerald-200",
  occupied: "border-0 bg-red-600/15 text-red-900 dark:text-red-100",
  maintenance:
    "border-0 bg-amber-500/20 text-amber-900 dark:text-amber-100",
};

export const cardRoomTitle = roomShortTitle;

/** Digits from "Room 12" style short titles; otherwise null. */
function roomNumberDigits(shortTitle: string): string | null {
  const m = shortTitle.match(/^room\s+(\d+)$/i);
  return m?.[1] ?? null;
}

function RoomFloatingMenu({
  open,
  anchorRef,
  onClose,
  children,
}: {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [box, setBox] = React.useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  React.useLayoutEffect(() => {
    if (!open) return;
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = 224;
    setBox({
      top: r.bottom + 6,
      left: Math.max(8, r.right - width),
      width,
    });
  }, [open, anchorRef]);

  if (!open || typeof document === "undefined" || !box) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-40 cursor-default"
        aria-hidden
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      />
      <div
        role="menu"
        className="fixed z-50 overflow-hidden rounded-xl border-2 border-indigo-100 bg-popover py-1 shadow-lg dark:border-border"
        style={{ top: box.top, left: box.left, width: box.width }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}

function StatusButtons({
  roomId,
  current,
  canPersist,
  onUpdated,
}: {
  roomId: string;
  current: RoomStatus;
  canPersist: boolean;
  onUpdated: () => void;
}) {
  const options: RoomStatus[] = ["vacant", "occupied", "maintenance"];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((status) => (
        <Button
          key={status}
          type="button"
          size="sm"
          variant={current === status ? "default" : "outline"}
          disabled={!canPersist || current === status}
          className="capitalize"
          onClick={async () => {
            const res = await updateRoomStatusAction(roomId, status);
            if (res.ok) {
              toast.success(res.message ?? "Updated");
              onUpdated();
              return;
            }
            toast.error(res.error);
          }}
        >
          {STATUS_LABEL[status]}
        </Button>
      ))}
    </div>
  );
}

function RoomLeaseAndStatusDialog({
  room,
  open,
  onOpenChange,
  canPersist,
  onUpdated,
}: {
  room: OwnerRoom;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canPersist: boolean;
  onUpdated: () => void;
}) {
  const lease = room.lease;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{roomShortTitle(room)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={STATUS_BADGE[room.status]}>
              {STATUS_LABEL[room.status]}
            </Badge>
            <span className="text-muted-foreground">
              {formatPHP(room.listing.monthlyRentPhp)} / month ·{" "}
              {room.listing.floorAreaSqm} sqm
            </span>
          </div>

          {lease ? (
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Active lease
              </p>
              <dl className="mt-2 grid gap-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Tenant</dt>
                  <dd className="text-right font-medium">{lease.tenantName}</dd>
                </div>
                {lease.tenantPhone ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Phone</dt>
                    <dd className="text-right font-medium">{lease.tenantPhone}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Advance / deposit</dt>
                  <dd>
                    {lease.advanceMonths} mo / {lease.depositMonths} mo
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Advance paid</dt>
                  <dd className="tabular-nums">
                    {formatPHP(lease.advancePaidPhp)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Deposit held</dt>
                  <dd className="tabular-nums">
                    {formatPHP(lease.depositHeldPhp)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Next payment due</dt>
                  <dd>{lease.nextDueDate}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Move-in</dt>
                  <dd>{formatIsoDateLocal(lease.leaseStart)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Checkout</dt>
                  <dd>
                    {lease.leaseEnd ? formatIsoDateLocal(lease.leaseEnd) : "Open-ended"}
                  </dd>
                </div>
              </dl>
              {lease.notes ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {lease.notes}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-muted-foreground">
              No active lease on file for this unit. Occupied units should have a
              row in <span className="font-mono text-xs">leases</span>.
            </p>
          )}

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Set status
            </p>
            <StatusButtons
              roomId={room.id}
              current={room.status}
              canPersist={canPersist}
              onUpdated={onUpdated}
            />
            {!canPersist ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Configure Supabase URL and anon key, then sign in to update room
                status (RLS applies).
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}

function PrimaryStatusButton({
  room,
  canPersist,
  onUpdated,
  onOpenOccupy,
  onOpenCheckout,
  onOpenSimpleVacate,
}: {
  room: OwnerRoom;
  canPersist: boolean;
  onUpdated: () => void;
  onOpenOccupy: () => void;
  onOpenCheckout: () => void;
  onOpenSimpleVacate: () => void;
}) {
  const [pending, start] = React.useTransition();

  const action =
    room.status === "vacant"
      ? ({ next: "occupied" as const, label: "Mark Occupied" })
      : room.status === "occupied"
        ? ({ next: "vacant" as const, label: "Mark as available" })
        : ({ next: "vacant" as const, label: "Mark as available" });

  const isMarkOccupied = action.next === "occupied";

  return (
    <Button
      type="button"
      className={cn(
        "h-11 w-full text-base font-bold shadow-sm sm:h-12",
        isMarkOccupied &&
          "border-0 bg-emerald-600 text-white hover:bg-emerald-700",
      )}
      variant={isMarkOccupied ? "default" : "outline"}
      disabled={!canPersist || pending || room.status === action.next}
      onClick={() => {
        if (room.status === "vacant" && action.next === "occupied") {
          onOpenOccupy();
          return;
        }
        if (room.status === "occupied" && action.next === "vacant") {
          if (room.lease) {
            onOpenCheckout();
            return;
          }
          onOpenSimpleVacate();
          return;
        }
        start(async () => {
          const res = await updateRoomStatusAction(room.id, action.next);
          if (res.ok) {
            toast.success(res.message ?? "Updated");
            onUpdated();
            return;
          }
          toast.error(res.error);
        });
      }}
    >
      {pending ? "Saving…" : action.label}
    </Button>
  );
}

function SimpleVacateDialog({
  room,
  open,
  onOpenChange,
  canPersist,
  onSuccess,
}: {
  room: OwnerRoom;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canPersist: boolean;
  onSuccess: () => void;
}) {
  const [pending, start] = React.useTransition();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark {roomShortTitle(room)} vacant?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          There is no active lease on file for this unit. The room will be set
          to <strong>Vacant</strong> only.
        </p>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canPersist || pending}
            onClick={() => {
              start(async () => {
                const res = await updateRoomStatusAction(room.id, "vacant");
                if (res.ok) {
                  toast.success(res.message ?? "Updated");
                  onOpenChange(false);
                  onSuccess();
                  return;
                }
                toast.error(res.error);
              });
            }}
          >
            {pending ? "Saving…" : "Mark vacant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DashboardRoomCard({
  room,
  canPersist,
}: {
  room: OwnerRoom;
  canPersist: boolean;
}) {
  const router = useRouter();
  const menuAnchorRef = React.useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [editRateOpen, setEditRateOpen] = React.useState(false);
  const [occupyOpen, setOccupyOpen] = React.useState(false);
  const [invoiceOpen, setInvoiceOpen] = React.useState(false);
  const [checkoutOpen, setCheckoutOpen] = React.useState(false);
  const [simpleVacateOpen, setSimpleVacateOpen] = React.useState(false);
  const [maintPending, startMaint] = React.useTransition();

  const shortTitle = cardRoomTitle(room);
  const roomDigits = roomNumberDigits(shortTitle);
  const isMaintenance = room.status === "maintenance";

  return (
    <>
      <Card
        className={cn(
          "h-fit min-w-0 max-w-full self-start gap-0 overflow-hidden rounded-2xl border border-indigo-100/90 bg-white py-0 shadow-sm",
          "transition duration-300 ease-out",
          "hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(55,48,163,0.1)]",
          "dark:border-border dark:bg-card",
        )}
      >
        <CardHeader className="space-y-3 px-5 pb-0 pt-5 sm:px-6 sm:pt-6">
          <div className="flex items-center justify-between gap-3">
            {roomDigits != null ? (
              <CardTitle
                className="flex min-w-0 flex-1 items-baseline gap-3 whitespace-nowrap text-indigo-950 dark:text-foreground"
                aria-label={`Room ${roomDigits}`}
              >
                <span className="shrink-0 text-xl font-extrabold leading-none tracking-tight sm:text-2xl">
                  Room
                </span>
                <span className="text-xl font-extrabold tabular-nums leading-none tracking-tight sm:text-2xl">
                  {roomDigits}
                </span>
              </CardTitle>
            ) : (
              <CardTitle className="min-w-0 flex-1 text-2xl font-extrabold leading-tight tracking-tight text-indigo-950 dark:text-foreground sm:text-[1.65rem]">
                {shortTitle}
              </CardTitle>
            )}
            <div className="flex shrink-0 items-center gap-1 self-center">
              <Badge
                className={cn(
                  "shrink-0 border-0 px-2.5 py-1 text-xs font-semibold leading-none",
                  STATUS_BADGE[room.status],
                )}
              >
                {STATUS_LABEL[room.status]}
              </Badge>
              <button
                ref={menuAnchorRef}
                type="button"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon" }),
                  "shrink-0 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950/40",
                )}
                aria-label={`More options for ${shortTitle}`}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <MoreVertical className="size-4" aria-hidden />
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-sky-100/90 bg-sky-50/90 px-4 py-3 dark:border-sky-900/45 dark:bg-sky-950/40">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-800/90 dark:text-sky-300">
              Monthly rate
            </p>
            <p className="mt-1.5 text-xl font-bold tabular-nums leading-none text-sky-950 dark:text-sky-100 sm:text-2xl">
              {formatPHP(room.listing.monthlyRentPhp)}
            </p>
          </div>
          {room.lease ? (
            <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3 dark:border-border dark:bg-muted/25">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tenant
              </p>
              <p className="mt-1.5 wrap-break-word text-sm font-semibold leading-snug text-foreground">
                {room.lease.tenantName}
              </p>
              {room.lease.tenantPhone ? (
                <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                  {room.lease.tenantPhone}
                </p>
              ) : null}
              <dl className="mt-3 grid gap-3 border-t border-border/60 pt-3 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Next payment due</dt>
                  <dd className="min-w-0 text-right font-medium">
                    {room.lease.nextDueDate}
                  </dd>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-muted-foreground">Move-in</dt>
                    <dd className="mt-1 font-medium">
                      {formatIsoDateLocal(room.lease.leaseStart)}
                    </dd>
                  </div>
                  <div className="text-right">
                    <dt className="text-muted-foreground">Checkout</dt>
                    <dd className="mt-1 font-medium">
                      {room.lease.leaseEnd
                        ? formatIsoDateLocal(room.lease.leaseEnd)
                        : "Open-ended"}
                    </dd>
                  </div>
                </div>
              </dl>
            </div>
          ) : null}
        </CardHeader>
        <CardFooter
          className={cn(
            "mt-3 flex flex-col gap-2 border-t-0 px-5 pb-5 pt-2 sm:mt-4 sm:px-6 sm:pt-3",
            !room.lease && "pt-3 pb-4 sm:pt-4",
          )}
        >
          <PrimaryStatusButton
            room={room}
            canPersist={canPersist}
            onUpdated={() => router.refresh()}
            onOpenOccupy={() => setOccupyOpen(true)}
            onOpenCheckout={() => setCheckoutOpen(true)}
            onOpenSimpleVacate={() => setSimpleVacateOpen(true)}
          />
          {room.lease ? (
            <Button
              type="button"
              className="h-11 w-full border-0 bg-indigo-600 text-base font-bold text-white shadow-sm hover:bg-indigo-700 sm:h-12"
              onClick={() => setInvoiceOpen(true)}
            >
              <ReceiptText className="size-4" aria-hidden />
              Payment Invoice
            </Button>
          ) : null}
        </CardFooter>
      </Card>

      <RoomFloatingMenu
        open={menuOpen}
        anchorRef={menuAnchorRef}
        onClose={() => setMenuOpen(false)}
      >
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-indigo-800 hover:bg-indigo-50 dark:text-indigo-200 dark:hover:bg-indigo-950/40"
          onClick={() => {
            setMenuOpen(false);
            setEditRateOpen(true);
          }}
        >
          <Pencil className="size-4 shrink-0 opacity-80" aria-hidden />
          Edit room info
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={!canPersist || maintPending}
          className="flex w-full items-center gap-2 border-t border-indigo-100 px-4 py-3 text-left text-sm font-semibold text-indigo-800 hover:bg-indigo-50 disabled:opacity-50 dark:border-border dark:text-indigo-200 dark:hover:bg-indigo-950/40"
          onClick={() => {
            setMenuOpen(false);
            startMaint(async () => {
              const next: RoomStatus = isMaintenance
                ? room.lease
                  ? "occupied"
                  : "vacant"
                : "maintenance";
              const res = await updateRoomStatusAction(room.id, next);
              if (res.ok) {
                toast.success(res.message ?? "Updated");
                router.refresh();
                return;
              }
              toast.error(res.error);
            });
          }}
        >
          <Wrench className="size-4 shrink-0 opacity-80" aria-hidden />
          {isMaintenance ? "Remove maintenance" : "Set maintenance"}
        </button>
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2 border-t border-indigo-100 px-4 py-3 text-left text-sm font-semibold text-indigo-800 hover:bg-indigo-50 dark:border-border dark:text-indigo-200 dark:hover:bg-indigo-950/40"
          onClick={() => {
            setMenuOpen(false);
            setDetailsOpen(true);
          }}
        >
          Lease &amp; status
        </button>
      </RoomFloatingMenu>

      <RoomLeaseAndStatusDialog
        room={room}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        canPersist={canPersist}
        onUpdated={() => router.refresh()}
      />

      <RoomEditRateDialog
        room={room}
        roomDisplayName={shortTitle}
        open={editRateOpen}
        onOpenChange={setEditRateOpen}
        canPersist={canPersist}
        onSuccess={() => router.refresh()}
      />

      <RoomOccupyDialog
        room={room}
        roomDisplayName={shortTitle}
        open={occupyOpen}
        onOpenChange={setOccupyOpen}
        canPersist={canPersist}
        onSuccess={() => router.refresh()}
      />

      {room.lease ? (
        <RoomPaymentInvoiceDialog
          roomId={room.id}
          roomDisplayName={shortTitle}
          lease={room.lease}
          open={invoiceOpen}
          onOpenChange={setInvoiceOpen}
          canPersist={canPersist}
          onPaymentRecorded={() => router.refresh()}
        />
      ) : null}

      {room.lease ? (
        <RoomCheckoutDialog
          room={room}
          lease={room.lease}
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          canPersist={canPersist}
          onSuccess={() => router.refresh()}
        />
      ) : null}

      <SimpleVacateDialog
        room={room}
        open={simpleVacateOpen}
        onOpenChange={setSimpleVacateOpen}
        canPersist={canPersist}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}

export function DashboardRooms({
  rooms,
  canPersist,
}: {
  rooms: OwnerRoom[];
  canPersist: boolean;
}) {
  return (
    <div className="grid grid-cols-1 items-start gap-6 sm:grid-cols-2 sm:gap-7 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3 lg:gap-8">
      {rooms.map((room) => (
        <DashboardRoomCard key={room.id} room={room} canPersist={canPersist} />
      ))}
    </div>
  );
}
