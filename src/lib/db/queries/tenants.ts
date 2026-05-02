import { formatDatePH, parseLocalDateOnly } from "@/lib/lease-utils";
import type { TenantHistoryRow } from "@/lib/types/tenant-history";
import { isSupabasePublicConfigured } from "@/lib/env";
import { getServerAuth } from "@/lib/supabase/server";

type LeaseRoomEmbed = { title: string; slug: string };

function roomTitleSlugFromLeaseEmbed(
  rooms: LeaseRoomEmbed | LeaseRoomEmbed[] | null | undefined,
): { title: string; slug: string } {
  if (rooms == null) return { title: "Room", slug: "room" };
  const row = Array.isArray(rooms) ? rooms[0] : rooms;
  if (!row) return { title: "Room", slug: "room" };
  return { title: row.title, slug: row.slug };
}

export async function fetchTenantLeaseHistory(): Promise<TenantHistoryRow[]> {
  if (!isSupabasePublicConfigured()) return [];

  const { supabase, user } = await getServerAuth();

  if (!supabase || !user) return [];

  const { data, error } = await supabase
    .from("leases")
    .select(
      "id, room_id, tenant_name, tenant_phone, monthly_rent_php, rent_due_day, lease_start, lease_end, is_active, notes, rooms:room_id(title,slug)",
    )
    .order("lease_start", { ascending: false });

  if (error || !data?.length) return [];

  const rows: TenantHistoryRow[] = [];
  for (const raw of data) {
    const row = raw as {
      id: string;
      room_id: string;
      tenant_name: string;
      tenant_phone: string | null;
      monthly_rent_php: number | string;
      rent_due_day: number;
      lease_start: string;
      lease_end: string | null;
      is_active: boolean;
      notes: string | null;
      rooms: LeaseRoomEmbed | LeaseRoomEmbed[] | null;
    };
    const { title, slug } = roomTitleSlugFromLeaseEmbed(row.rooms);
    rows.push({
      leaseId: row.id,
      roomId: row.room_id,
      roomTitle: title,
      roomSlug: slug,
      tenantName: row.tenant_name,
      tenantPhone: row.tenant_phone ?? null,
      monthlyRentPhp: Number(row.monthly_rent_php),
      rentDueDay: row.rent_due_day,
      leaseStartDisplay: formatDatePH(parseLocalDateOnly(row.lease_start)),
      leaseEndDisplay: row.lease_end
        ? formatDatePH(parseLocalDateOnly(row.lease_end))
        : null,
      isActive: row.is_active,
      notes: row.notes,
    });
  }

  return rows;
}
