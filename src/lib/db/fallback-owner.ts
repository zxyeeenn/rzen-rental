import { VACANT_LISTINGS } from "@/data/vacant-listings";
import { computeNextRentDueDate, formatDatePH } from "@/lib/lease-utils";
import type { RoomListing } from "@/lib/schemas/listing";
import type { RoomStatus } from "@/lib/schemas/room-status";
import type { LeaseSummary, OwnerRoom } from "@/lib/types/owner-room";

const FALLBACK_STATUSES: RoomStatus[] = [
  "vacant",
  "vacant",
  "vacant",
  "occupied",
  "occupied",
  "occupied",
  "occupied",
  "maintenance",
];

const TENANTS = [
  "",
  "",
  "",
  "Maria Santos",
  "James & Ana Reyes",
  "Luis Galaroza",
  "Remote worker — initials KL",
  "",
];

function mockLeaseForListing(
  listing: RoomListing,
  index: number,
): LeaseSummary | null {
  if (FALLBACK_STATUSES[index] !== "occupied") return null;

  const rentDueDay =
    index === 3 ? 5 : index === 4 ? 3 : index === 5 ? 7 : 1;

  const leaseStart =
    index === 3
      ? "2025-11-01"
      : index === 4
        ? "2025-10-15"
        : index === 5
          ? "2026-01-05"
          : "2025-12-01";

  const next = computeNextRentDueDate(rentDueDay, leaseStart);

  return {
    id: `offline-lease-${listing.id}`,
    tenantName: TENANTS[index] || "Tenant",
    tenantPhone: null,
    monthlyRentPhp: listing.monthlyRentPhp,
    advanceMonths: 1,
    depositMonths: 1,
    rentDueDay,
    leaseStart,
    leaseEnd: index === 6 ? "2026-06-30" : null,
    advancePaidPhp: listing.monthlyRentPhp,
    depositHeldPhp: listing.monthlyRentPhp,
    nextDueDate: formatDatePH(next),
    notes:
      index === 3
        ? "1 month advance + 1 month deposit on file."
        : index === 6
          ? "End date tentative; renewal in discussion."
          : null,
  };
}

export function getFallbackOwnerRooms(): OwnerRoom[] {
  return VACANT_LISTINGS.map((listing, index) => ({
    id: listing.id,
    slug: listing.id,
    status: FALLBACK_STATUSES[index] ?? "vacant",
    listing,
    lease: mockLeaseForListing(listing, index),
  }));
}
