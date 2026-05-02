"use client";

import * as React from "react";
import { toast } from "sonner";

import { createLeaseAndOccupyAction } from "@/app/(app)/dashboard/actions";
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
import type { OwnerRoom } from "@/lib/types/owner-room";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function RoomOccupyDialog({
  room,
  roomDisplayName,
  open,
  onOpenChange,
  canPersist,
  onSuccess,
}: {
  room: OwnerRoom;
  roomDisplayName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canPersist: boolean;
  onSuccess: () => void;
}) {
  const rent = room.listing.monthlyRentPhp;
  const [pending, start] = React.useTransition();
  const [tenantName, setTenantName] = React.useState("");
  const [tenantPhone, setTenantPhone] = React.useState("");
  const [stayMonths, setStayMonths] = React.useState("6");
  const [leaseStart, setLeaseStart] = React.useState(todayIso);

  React.useEffect(() => {
    if (!open) return;
    setLeaseStart(todayIso());
    setTenantName("");
    setTenantPhone("");
    setStayMonths("6");
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canPersist) {
      toast.error("Sign in to save.");
      return;
    }
    if (tenantPhone.length !== 11 || !/^\d{11}$/.test(tenantPhone)) {
      toast.error("Phone number must be exactly 11 digits.");
      return;
    }
    const months = Number(stayMonths);
    if (!Number.isFinite(months) || months < 1 || months > 120) {
      toast.error("Length of stay must be between 1 and 120 months.");
      return;
    }

    const payload = {
      roomId: room.id,
      tenantName: tenantName.trim(),
      tenantPhone,
      leaseStart,
      contractMonths: months,
      monthlyRentPhp: rent,
      advanceMonths: 1,
      depositMonths: 1,
      rentDueDay: 5,
      advancePaidPhp: rent,
      depositHeldPhp: rent,
    };

    start(async () => {
      const res = await createLeaseAndOccupyAction(payload);
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        onOpenChange(false);
        onSuccess();
        return;
      }
      toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-indigo-950 dark:text-foreground">
            Add Tenant for {roomDisplayName}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div className="grid gap-2">
            <Label htmlFor="occ-name" className="text-indigo-800 dark:text-indigo-200">
              Tenant Name
            </Label>
            <Input
              id="occ-name"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              required
              autoComplete="name"
              placeholder="Juan Dela Cruz"
              className="border-indigo-200"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="occ-phone" className="text-indigo-800 dark:text-indigo-200">
              Phone Number
            </Label>
            <Input
              id="occ-phone"
              value={tenantPhone}
              onChange={(e) =>
                setTenantPhone(e.target.value.replace(/\D/g, "").slice(0, 11))
              }
              inputMode="numeric"
              autoComplete="tel"
              placeholder="09XX-XXX-XXXX"
              maxLength={11}
              required
              className="border-indigo-200"
            />
            <p className="text-xs text-muted-foreground">Exactly 11 digits.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="occ-months" className="text-indigo-800 dark:text-indigo-200">
              Length of Stay (Months)
            </Label>
            <Input
              id="occ-months"
              type="number"
              min={1}
              max={120}
              value={stayMonths}
              onChange={(e) => setStayMonths(e.target.value)}
              required
              className="border-indigo-200"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="occ-start" className="text-indigo-800 dark:text-indigo-200">
              Move-in Date
            </Label>
            <Input
              id="occ-start"
              type="date"
              value={leaseStart}
              onChange={(e) => setLeaseStart(e.target.value)}
              required
              className="border-indigo-200"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 dark:border-border dark:bg-muted dark:text-foreground"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canPersist || pending}>
              {pending ? "Saving…" : "Save tenant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
