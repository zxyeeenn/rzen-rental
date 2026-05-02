"use client";

import * as React from "react";
import { toast } from "sonner";

import { updateRoomMonthlyRentAction } from "@/app/(app)/dashboard/actions";
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

export function RoomEditRateDialog({
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
  const [pending, start] = React.useTransition();
  const [rate, setRate] = React.useState(String(room.listing.monthlyRentPhp));

  React.useEffect(() => {
    if (open) {
      setRate(String(room.listing.monthlyRentPhp));
    }
  }, [open, room.listing.monthlyRentPhp]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canPersist) {
      toast.error("Sign in to save.");
      return;
    }
    const n = Number(rate);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Enter a valid monthly rate.");
      return;
    }
    start(async () => {
      const res = await updateRoomMonthlyRentAction({
        roomId: room.id,
        monthlyRentPhp: n,
      });
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-indigo-950 dark:text-foreground">
            Edit {roomDisplayName}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div className="grid gap-2">
            <Label htmlFor="edit-rate" className="text-indigo-800 dark:text-indigo-200">
              Monthly Rate (₱)
            </Label>
            <Input
              id="edit-rate"
              type="number"
              min={1}
              step={100}
              value={rate}
              onChange={(e) => setRate(e.target.value)}
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
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
