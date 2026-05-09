import { formatDatePH, parseLocalDateOnly } from "@/lib/lease-utils";
import type {
  PaymentMonthBucket,
  PaymentRecord,
  PaymentSnapshot,
} from "@/lib/types/payment";
import { isSupabasePublicConfigured } from "@/lib/env";
import { getServerAuth } from "@/lib/supabase/server";

const emptyPaymentSnapshot: PaymentSnapshot = {
  totalCollectedPhp: 0,
  monthCollectedPhp: 0,
  pendingAmountPhp: 0,
  pendingCount: 0,
  records: [],
  chartByMonth: [],
  loadError: null,
};

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function buildPaymentChartByMonth(
  records: PaymentRecord[],
): PaymentMonthBucket[] {
  const map = new Map<string, { paid: number; pending: number }>();
  for (const r of records) {
    const cur = map.get(r.billingMonth) ?? { paid: 0, pending: 0 };
    if (r.status === "paid") cur.paid += r.amountPhp;
    else cur.pending += r.amountPhp;
    map.set(r.billingMonth, cur);
  }
  return Array.from(map.entries())
    .map(([month, v]) => ({
      month,
      paidPhp: v.paid,
      pendingPhp: v.pending,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

type RoomEmbed = {
  title: string;
  slug: string;
  status: "vacant" | "occupied" | "maintenance";
};

function roomFromPaymentEmbed(
  rooms: RoomEmbed | RoomEmbed[] | null | undefined,
): RoomEmbed | null {
  if (rooms == null) return null;
  return Array.isArray(rooms) ? (rooms[0] ?? null) : rooms;
}

function mapPaymentRowToRecord(raw: {
  id: string;
  room_id: string;
  amount_php: number | string;
  billing_month: string;
  due_date: string;
  paid_date: string | null;
  status: "pending" | "paid";
  notes: string | null;
  created_at: string;
  rooms: RoomEmbed | RoomEmbed[] | null;
}): PaymentRecord {
  const room = roomFromPaymentEmbed(raw.rooms);
  return {
    id: raw.id,
    roomId: raw.room_id,
    roomTitle: room?.title ?? raw.room_id,
    roomSlug: room?.slug ?? "room",
    roomStatus: room?.status ?? "vacant",
    amountPhp: Number(raw.amount_php),
    billingMonth: raw.billing_month,
    dueDate: formatDatePH(parseLocalDateOnly(raw.due_date)),
    paidDate: raw.paid_date
      ? formatDatePH(parseLocalDateOnly(raw.paid_date))
      : null,
    status: raw.status,
    notes: raw.notes,
    createdAt: raw.created_at,
  };
}

export async function fetchPaymentSnapshot(): Promise<PaymentSnapshot> {
  if (!isSupabasePublicConfigured()) return emptyPaymentSnapshot;

  const { supabase, user } = await getServerAuth();

  if (!supabase || !user) return emptyPaymentSnapshot;

  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select(
      "id, room_id, amount_php, billing_month, due_date, paid_date, status, notes, created_at, rooms:room_id(title,slug,status)",
    )
    .order("created_at", { ascending: false });

  if (paymentsError) {
    console.error("[payments]", paymentsError.message);
    return {
      ...emptyPaymentSnapshot,
      loadError: "Could not load payments. Check your connection and try again.",
    };
  }

  const records = (payments ?? []).map((row) =>
    mapPaymentRowToRecord(row as Parameters<typeof mapPaymentRowToRecord>[0]),
  );

  const month = currentMonthKey();
  const totalCollectedPhp = records
    .filter((r) => r.status === "paid")
    .reduce((sum, r) => sum + r.amountPhp, 0);
  const monthCollectedPhp = records
    .filter((r) => r.status === "paid" && r.billingMonth === month)
    .reduce((sum, r) => sum + r.amountPhp, 0);
  const pendingRecords = records.filter((r) => r.status === "pending");

  return {
    totalCollectedPhp,
    monthCollectedPhp,
    pendingAmountPhp: pendingRecords.reduce((sum, r) => sum + r.amountPhp, 0),
    pendingCount: pendingRecords.length,
    records,
    chartByMonth: buildPaymentChartByMonth(records),
    loadError: null,
  };
}
