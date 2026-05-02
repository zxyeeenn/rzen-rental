import type { OwnerRoom } from "@/lib/types/owner-room";import { isSupabasePublicConfigured } from "@/lib/env";
import { getServerAuth } from "@/lib/supabase/server";

import { getFallbackOwnerRooms } from "../fallback-owner";
import { mapUnknownRoomRowToOwnerRoom } from "../mappers";

export async function fetchOwnerRooms(): Promise<OwnerRoom[]> {
  if (!isSupabasePublicConfigured()) return getFallbackOwnerRooms();

  const { supabase, user } = await getServerAuth();

  if (!supabase || !user) return getFallbackOwnerRooms();

  const { data: rooms, error: roomsError } = await supabase
    .from("rooms")
    .select("*")
    .order("sort_order", { ascending: true });

  if (roomsError || !rooms?.length) return getFallbackOwnerRooms();

  const { data: leases, error: leasesError } = await supabase
    .from("leases")
    .select("*")
    .eq("is_active", true);

  if (leasesError) return getFallbackOwnerRooms();

  const leaseByRoomId = new Map<string, unknown>();
  for (const lease of leases ?? []) {
    const roomId = (lease as { room_id?: string }).room_id;
    if (typeof roomId === "string") leaseByRoomId.set(roomId, lease);
  }

  const ownerRooms: OwnerRoom[] = [];
  for (const row of rooms) {
    const id = (row as { id?: string }).id;
    const mapped = mapUnknownRoomRowToOwnerRoom(
      row,
      typeof id === "string" ? leaseByRoomId.get(id) : undefined,
    );
    if (mapped) ownerRooms.push(mapped);
  }

  return ownerRooms.length ? ownerRooms : getFallbackOwnerRooms();
}
