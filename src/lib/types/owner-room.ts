import type { RoomListing } from "@/lib/schemas/listing";
import type { RoomStatus } from "@/lib/schemas/room-status";

export type LeaseSummary = {
  id: string;
  tenantName: string;
  tenantPhone: string | null;
  monthlyRentPhp: number;
  advanceMonths: number;
  depositMonths: number;
  rentDueDay: number;
  leaseStart: string;
  leaseEnd: string | null;
  advancePaidPhp: number;
  depositHeldPhp: number;
  nextDueDate: string;
  notes: string | null;
};

export type OwnerRoom = {
  id: string;
  slug: string;
  status: RoomStatus;
  listing: RoomListing;
  lease: LeaseSummary | null;
};
