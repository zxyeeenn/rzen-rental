import type { OwnerRoom } from "@/lib/types/owner-room";

/**
 * Short label from a listing title: segment after "·" when present
 * (e.g. "Room 2" instead of "Garden Wing · Room 2").
 */
export function shortRoomLabelFromListingTitle(title: string): string {
  const parts = title.split("·");
  const last = parts[parts.length - 1]?.trim();
  return last && last.length > 0 ? last : title;
}

/**
 * Short label for dashboards and modals: uses the segment after "·" when present.
 */
export function roomShortTitle(room: OwnerRoom): string {
  return shortRoomLabelFromListingTitle(room.listing.title);
}
