import { z } from "zod";

import { computeNextRentDueDate, formatDatePH } from "@/lib/lease-utils";
import { listingPhotoSchema, roomListingSchema } from "@/lib/schemas/listing";
import { roomStatusSchema } from "@/lib/schemas/room-status";
import type { LeaseSummary, OwnerRoom } from "@/lib/types/owner-room";

export const roomRowSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  monthly_rent_php: z.coerce.number(),
  floor_area_sqm: z.coerce.number(),
  short_description: z.string(),
  amenities: z.array(z.string()).catch([]),
  photo_urls: z.unknown(),
  status: roomStatusSchema,
  sort_order: z.coerce.number().optional(),
});

export type RoomRow = z.infer<typeof roomRowSchema>;

const leaseRowSchema = z.object({
  id: z.string().uuid(),
  room_id: z.string().uuid(),
  tenant_name: z.string(),
  tenant_phone: z.string().nullable().optional(),
  monthly_rent_php: z.coerce.number(),
  advance_months: z.coerce.number(),
  deposit_months: z.coerce.number(),
  rent_due_day: z.coerce.number(),
  lease_start: z.string(),
  lease_end: z.string().nullable(),
  advance_paid_php: z.coerce.number(),
  deposit_held_php: z.coerce.number(),
  is_active: z.boolean(),
  notes: z.string().nullable().optional(),
});

export type LeaseRow = z.infer<typeof leaseRowSchema>;

function parsePhotos(raw: unknown) {
  const parsed = z.array(listingPhotoSchema).safeParse(raw);
  if (parsed.success && parsed.data.length > 0) return parsed.data;
  return [
    {
      src: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
      alt: "Property photo",
    },
  ];
}

export function mapRoomRowToListing(row: RoomRow) {
  return roomListingSchema.parse({
    id: row.id,
    title: row.title,
    monthlyRentPhp: row.monthly_rent_php,
    floorAreaSqm: row.floor_area_sqm,
    shortDescription: row.short_description,
    amenities: row.amenities,
    photos: parsePhotos(row.photo_urls),
  });
}

function leaseRowToSummary(row: LeaseRow): LeaseSummary {
  const next = computeNextRentDueDate(row.rent_due_day, row.lease_start);
  return {
    id: row.id,
    tenantName: row.tenant_name,
    tenantPhone: row.tenant_phone ?? null,
    monthlyRentPhp: row.monthly_rent_php,
    advanceMonths: row.advance_months,
    depositMonths: row.deposit_months,
    rentDueDay: row.rent_due_day,
    leaseStart: row.lease_start,
    leaseEnd: row.lease_end,
    advancePaidPhp: row.advance_paid_php,
    depositHeldPhp: row.deposit_held_php,
    nextDueDate: formatDatePH(next),
    notes: row.notes ?? null,
  };
}

export function mapUnknownRoomRowToOwnerRoom(
  raw: unknown,
  leaseRaw: unknown | undefined,
): OwnerRoom | null {
  const room = roomRowSchema.safeParse(raw);
  if (!room.success) return null;

  const listing = mapRoomRowToListing(room.data);
  const leaseParsed = leaseRaw !== undefined ? leaseRowSchema.safeParse(leaseRaw) : null;
  const leaseRow = leaseParsed?.success ? leaseParsed.data : undefined;

  const shouldShowLease =
    (room.data.status === "occupied" || room.data.status === "maintenance") &&
    leaseRow &&
    leaseRow.room_id === room.data.id;

  return {
    id: room.data.id,
    slug: room.data.slug,
    status: room.data.status,
    listing,
    lease: shouldShowLease ? leaseRowToSummary(leaseRow) : null,
  };
}
