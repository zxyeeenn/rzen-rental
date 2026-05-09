"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  addCalendarDaysIso,
  addCalendarMonthsIso,
  dueDateForBillingMonth,
  invoiceUtilityPeriodFromDueDateIso,
} from "@/lib/lease-utils";
import { isSupabasePublicConfigured } from "@/lib/env";
import {
  checkoutVacateSchema,
  createLeaseOccupancySchema,
  updateRoomMonthlyRentSchema,
} from "@/lib/schemas/lease-occupancy";
import { recordPaidInvoiceLineSchema } from "@/lib/schemas/payment";
import { invoiceUiStateSchema } from "@/lib/schemas/invoice-ui-state";
import {
  roomStatusSchema,
  type RoomStatus,
} from "@/lib/schemas/room-status";
import { utilityReadingFormSchema } from "@/lib/schemas/utility";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { electricUsageKwh } from "@/lib/billing/electric";

export type ActionResult =
  | { ok: true; message?: string; warning?: string }
  | { ok: false; error: string };

type SignedInClientResult =
  | { ok: false; error: string }
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
    };

function firstZodIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Invalid input";
}

async function requireSignedInClient(): Promise<SignedInClientResult> {
  if (!isSupabasePublicConfigured()) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  return { ok: true, supabase };
}

export async function updateRoomStatusAction(
  roomId: string,
  status: RoomStatus,
): Promise<ActionResult> {
  const ctx = await requireSignedInClient();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const statusParsed = roomStatusSchema.safeParse(status);
  if (!statusParsed.success) {
    return { ok: false, error: firstZodIssue(statusParsed.error) };
  }

  const { error } = await ctx.supabase
    .from("rooms")
    .update({
      status: statusParsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", roomId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/tenants");

  return { ok: true, message: "Room status updated" };
}

export async function updateRoomMonthlyRentAction(
  input: unknown,
): Promise<ActionResult> {
  const ctx = await requireSignedInClient();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const parsed = updateRoomMonthlyRentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstZodIssue(parsed.error) };
  }

  const { error } = await ctx.supabase
    .from("rooms")
    .update({
      monthly_rent_php: parsed.data.monthlyRentPhp,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.roomId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/tenants");

  return { ok: true, message: "Monthly rate updated" };
}

export async function recordUtilityReadingAction(
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireSignedInClient();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const raw = {
    roomId: String(formData.get("roomId") ?? ""),
    kind: String(formData.get("kind") ?? ""),
    periodStart: String(formData.get("periodStart") ?? ""),
    periodEnd: String(formData.get("periodEnd") ?? ""),
    previousReading: formData.get("previousReading"),
    currentReading: formData.get("currentReading"),
    notes: String(formData.get("notes") ?? ""),
  };

  const parsed = utilityReadingFormSchema.safeParse({
    ...raw,
    notes: raw.notes.length ? raw.notes : undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: firstZodIssue(parsed.error) };
  }

  const { error } = await ctx.supabase.from("utility_readings").insert({
    room_id: parsed.data.roomId,
    kind: parsed.data.kind,
    period_start: parsed.data.periodStart,
    period_end: parsed.data.periodEnd,
    previous_reading: parsed.data.previousReading,
    current_reading: parsed.data.currentReading,
    notes: parsed.data.notes ?? null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const used =
    parsed.data.kind === "electric"
      ? (electricUsageKwh(
          parsed.data.previousReading,
          parsed.data.currentReading,
        ) ?? 0)
      : parsed.data.currentReading - parsed.data.previousReading;

  revalidatePath("/dashboard");

  return {
    ok: true,
    message: `Saved - usage ${used.toLocaleString("en-PH")} units`,
  };
}

export async function recordPaidInvoiceLineAction(
  input: unknown,
): Promise<ActionResult> {
  const ctx = await requireSignedInClient();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const parsed = recordPaidInvoiceLineSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstZodIssue(parsed.error) };
  }

  const p = parsed.data;
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  const { error } = await ctx.supabase.from("payments").insert({
    room_id: p.roomId,
    amount_php: p.amountPhp,
    billing_month: p.billingMonth,
    due_date: p.dueDate,
    paid_date: today,
    status: "paid",
    notes: p.notes,
    updated_at: now,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/payments");

  return { ok: true, message: "Payment recorded" };
}

export async function markPaymentPaidAction(paymentId: string): Promise<ActionResult> {
  const ctx = await requireSignedInClient();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const today = new Date().toISOString().slice(0, 10);

  const { error } = await ctx.supabase
    .from("payments")
    .update({ status: "paid", paid_date: today, updated_at: new Date().toISOString() })
    .eq("id", paymentId)
    .neq("status", "paid");

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/payments");

  return { ok: true, message: "Payment marked as paid" };
}

export async function markPaymentsPaidAction(
  paymentIds: string[],
): Promise<ActionResult> {
  const ctx = await requireSignedInClient();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const parsed = z.array(z.string().uuid()).min(1).safeParse(paymentIds);
  if (!parsed.success) {
    return { ok: false, error: firstZodIssue(parsed.error) };
  }

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  const { data, error } = await ctx.supabase
    .from("payments")
    .update({ status: "paid", paid_date: today, updated_at: now })
    .in("id", parsed.data)
    .neq("status", "paid")
    .select("id");

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/payments");

  const n = (data ?? []).length;
  return { ok: true, message: n === 1 ? "Payment marked as paid" : `Marked ${n} payments as paid` };
}

const saveLeaseInvoiceUiStateInputSchema = z.object({
  leaseId: z.string().uuid(),
  paidLineIds: z.array(z.string()),
  manualUnlockedMonths: z.array(z.number().int().min(0)),
  electricByMonth: z.record(
    z.string(),
    z.object({
      prev: z.string(),
      curr: z.string(),
      applied: z.boolean(),
    }),
  ),
});

export async function saveLeaseInvoiceUiStateAction(
  input: unknown,
): Promise<ActionResult> {
  const ctx = await requireSignedInClient();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const parsed = saveLeaseInvoiceUiStateInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstZodIssue(parsed.error) };
  }
  const p = parsed.data;

  const body = invoiceUiStateSchema.safeParse({
    paidLineIds: p.paidLineIds,
    manualUnlockedMonths: p.manualUnlockedMonths,
    electricByMonth: p.electricByMonth,
  });
  if (!body.success) {
    return { ok: false, error: firstZodIssue(body.error) };
  }

  const { error } = await ctx.supabase
    .from("leases")
    .update({
      invoice_ui_state: body.data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", p.leaseId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/payments");
  return { ok: true };
}

export type CheckoutElectricPrefill =
  | { ok: true; previousReading: number | null }
  | { ok: false; error: string };

export async function fetchCheckoutElectricPrefillAction(
  roomId: string,
  leaseStartIso?: string,
  leaseId?: string,
): Promise<CheckoutElectricPrefill> {
  const ctx = await requireSignedInClient();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const parsedId = z.string().uuid().safeParse(roomId);
  if (!parsedId.success) {
    return { ok: false, error: "Invalid room" };
  }

  const leaseRowId = z.string().uuid().safeParse(leaseId);
  if (!leaseRowId.success) {
    return { ok: true, previousReading: null };
  }

  const leaseStartOk =
    leaseStartIso &&
    /^\d{4}-\d{2}-\d{2}$/.test(leaseStartIso) &&
    !Number.isNaN(Date.parse(leaseStartIso));

  const leaseTag = `lease:${leaseRowId.data}`;

  let query = ctx.supabase
    .from("utility_readings")
    .select("current_reading")
    .eq("room_id", parsedId.data)
    .eq("kind", "electric")
    .ilike("notes", "%Payment invoice%")
    .ilike("notes", `%${leaseTag}%`);

  if (leaseStartOk) {
    query = query.gte("period_end", leaseStartIso);
  }

  const { data, error } = await query
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  const prev =
    data?.current_reading != null ? Number(data.current_reading) : null;

  return {
    ok: true,
    previousReading: Number.isFinite(prev) ? prev : null,
  };
}

const fetchInvoiceElectricInputSchema = z.object({
  roomId: z.string().uuid(),
  leaseId: z.string().uuid(),
  leaseStart: z.string(),
  rentDueDay: z.number().int(),
  monthCount: z.number().int().min(1).max(12),
});

export type FetchInvoiceElectricFromDbResult =
  | {
      ok: true;
      byMonthIndex: Record<string, { prev: string; curr: string }>;
    }
  | { ok: false; error: string };

/**
 * Recover invoice electricity meter reads from `utility_readings` when
 * `leases.invoice_ui_state.electricByMonth` is missing or stale.
 */
export async function fetchInvoiceElectricFromDbAction(
  input: unknown,
): Promise<FetchInvoiceElectricFromDbResult> {
  const ctx = await requireSignedInClient();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const parsed = fetchInvoiceElectricInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstZodIssue(parsed.error) };
  }
  const p = parsed.data;
  const leaseTag = `lease:${p.leaseId}`;

  const { data, error } = await ctx.supabase
    .from("utility_readings")
    .select("period_start, period_end, previous_reading, current_reading")
    .eq("room_id", p.roomId)
    .eq("kind", "electric")
    .ilike("notes", "%Payment invoice%")
    .ilike("notes", `%${leaseTag}%`);

  if (error) {
    return { ok: false, error: error.message };
  }

  const rows = data ?? [];
  const byMonthIndex: Record<string, { prev: string; curr: string }> = {};

  for (let i = 0; i < p.monthCount; i++) {
    const due = dueDateForBillingMonth(p.leaseStart, p.rentDueDay, i);
    const { start, end } = invoiceUtilityPeriodFromDueDateIso(due);
    const row = rows.find(
      (r) => r.period_start === start && r.period_end === end,
    );
    if (
      row &&
      row.previous_reading != null &&
      row.current_reading != null
    ) {
      byMonthIndex[String(i)] = {
        prev: String(row.previous_reading),
        curr: String(row.current_reading),
      };
    }
  }

  return { ok: true, byMonthIndex };
}

export async function createLeaseAndOccupyAction(
  input: unknown,
): Promise<ActionResult> {
  const ctx = await requireSignedInClient();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const parsed = createLeaseOccupancySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstZodIssue(parsed.error) };
  }

  const data = parsed.data;

  const { data: roomRow, error: roomErr } = await ctx.supabase
    .from("rooms")
    .select("id,status")
    .eq("id", data.roomId)
    .single();

  if (roomErr || !roomRow) {
    return { ok: false, error: roomErr?.message ?? "Room not found." };
  }
  if (roomRow.status !== "vacant") {
    return {
      ok: false,
      error: "Only vacant units can be marked occupied with a new lease.",
    };
  }

  const { data: existing } = await ctx.supabase
    .from("leases")
    .select("id")
    .eq("room_id", data.roomId)
    .eq("is_active", true)
    .maybeSingle();

  const todayIso = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  /** Room is vacant in UI but a lease is still `is_active` (e.g. status changed without checkout) — close it. */
  if (existing) {
    const { error: endStaleErr } = await ctx.supabase
      .from("leases")
      .update({
        is_active: false,
        lease_end: todayIso,
        updated_at: now,
      })
      .eq("id", existing.id);

    if (endStaleErr) {
      return {
        ok: false,
        error: `Could not end the previous open lease: ${endStaleErr.message}. Fix it in the database or use checkout first.`,
      };
    }
  }

  let leaseEnd: string | null = null;
  if (data.contractMonths) {
    leaseEnd = addCalendarMonthsIso(data.leaseStart, data.contractMonths);
  } else if (data.leaseEnd) {
    leaseEnd = data.leaseEnd;
  }
  const insertRow = {
    room_id: data.roomId,
    tenant_name: data.tenantName,
    tenant_phone: data.tenantPhone ?? null,
    monthly_rent_php: data.monthlyRentPhp,
    advance_months: data.advanceMonths,
    deposit_months: data.depositMonths,
    rent_due_day: data.rentDueDay,
    lease_start: data.leaseStart,
    lease_end: leaseEnd,
    advance_paid_php: data.advancePaidPhp,
    deposit_held_php: data.depositHeldPhp,
    is_active: true,
    notes: data.notes?.trim() ? data.notes.trim() : null,
    updated_at: now,
  };

  const { data: inserted, error: insErr } = await ctx.supabase
    .from("leases")
    .insert(insertRow)
    .select("id")
    .single();

  if (insErr || !inserted) {
    return { ok: false, error: insErr?.message ?? "Could not create lease." };
  }

  const { error: roomUpdErr } = await ctx.supabase
    .from("rooms")
    .update({
      status: "occupied",
      updated_at: now,
    })
    .eq("id", data.roomId);

  if (roomUpdErr) {
    await ctx.supabase.from("leases").delete().eq("id", inserted.id);
    return { ok: false, error: roomUpdErr.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/tenants");

  return { ok: true, message: "Tenant saved and unit marked occupied." };
}

export async function checkoutAndVacateAction(
  input: unknown,
): Promise<ActionResult> {
  const ctx = await requireSignedInClient();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const parsed = checkoutVacateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstZodIssue(parsed.error) };
  }

  const p = parsed.data;
  const recordPending = Boolean(p.recordPendingBalance);

  const hasElecField =
    p.previousReading !== undefined ||
    p.currentReading !== undefined ||
    (p.periodStart != null && p.periodStart.length > 0) ||
    (p.periodEnd != null && p.periodEnd.length > 0);

  if (hasElecField) {
    const prev = p.previousReading;
    const curr = p.currentReading;
    const ps = p.periodStart;
    const pe = p.periodEnd;
    if (
      prev === undefined ||
      curr === undefined ||
      ps == null ||
      ps.length === 0 ||
      pe == null ||
      pe.length === 0
    ) {
      return {
        ok: false,
        error:
          "Complete previous/current readings and the billing period, or clear all electric fields.",
      };
    }
    const usage = electricUsageKwh(prev, curr);
    if (usage === null) {
      return {
        ok: false,
        error:
          "Invalid electric readings: use current ≥ previous (0 kWh if equal), or a rollover only when previous is very high (≥ 90,000 kWh). Otherwise correct the reads.",
      };
    }
  }

  const { data: lease, error: leaseErr } = await ctx.supabase
    .from("leases")
    .select(
      "id, room_id, advance_paid_php, deposit_held_php, is_active, lease_start",
    )
    .eq("id", p.leaseId)
    .single();

  if (leaseErr || !lease) {
    return { ok: false, error: leaseErr?.message ?? "Lease not found." };
  }
  if (lease.room_id !== p.roomId) {
    return { ok: false, error: "Lease does not match this unit." };
  }
  if (!lease.is_active) {
    return { ok: false, error: "This lease is already ended." };
  }

  const advancePaid = Number(lease.advance_paid_php);

  const elecKwh =
    p.previousReading !== undefined && p.currentReading !== undefined
      ? electricUsageKwh(p.previousReading, p.currentReading)
      : null;
  const elecCost =
    elecKwh !== null ? elecKwh * p.electricRatePerKwh : 0;
  const totalUtils = elecCost + p.waterChargePhp;
  /** Overage is owed by tenant; refund line is advance less utilities only (deposit not in this amount). */
  const balanceOwed = Math.max(0, totalUtils - advancePaid);
  const refundToTenant = Math.max(0, advancePaid - totalUtils);

  const now = new Date().toISOString();
  let utilityId: string | null = null;

  if (
    p.previousReading !== undefined &&
    p.currentReading !== undefined &&
    p.periodStart &&
    p.periodEnd
  ) {
    const { data: uIns, error: uErr } = await ctx.supabase
      .from("utility_readings")
      .insert({
        room_id: p.roomId,
        kind: "electric",
        period_start: p.periodStart,
        period_end: p.periodEnd,
        previous_reading: p.previousReading,
        current_reading: p.currentReading,
        notes: p.settlementNotes?.trim()
          ? `Checkout: ${p.settlementNotes.trim()}`
          : "Final reading at checkout",
      })
      .select("id")
      .single();

    if (uErr || !uIns) {
      return { ok: false, error: uErr?.message ?? "Could not save reading." };
    }
    utilityId = uIns.id;
  }

  const { error: leaseUpdErr } = await ctx.supabase
    .from("leases")
    .update({
      is_active: false,
      lease_end: p.checkoutDate,
      updated_at: now,
    })
    .eq("id", p.leaseId);

  if (leaseUpdErr) {
    if (utilityId) {
      await ctx.supabase.from("utility_readings").delete().eq("id", utilityId);
    }
    return { ok: false, error: leaseUpdErr.message };
  }

  const { error: roomUpdErr } = await ctx.supabase
    .from("rooms")
    .update({
      status: "vacant",
      updated_at: now,
    })
    .eq("id", p.roomId);

  if (roomUpdErr) {
    await ctx.supabase
      .from("leases")
      .update({
        is_active: true,
        lease_end: null,
        updated_at: now,
      })
      .eq("id", p.leaseId);
    if (utilityId) {
      await ctx.supabase.from("utility_readings").delete().eq("id", utilityId);
    }
    return { ok: false, error: roomUpdErr.message };
  }

  let paymentWarning = "";
  if (recordPending && balanceOwed > 0) {
    const due = addCalendarDaysIso(p.checkoutDate, 7);
    const billMonth = p.checkoutDate.slice(0, 7);
    const noteParts = [
      "Checkout utility balance (estimated).",
      p.settlementNotes?.trim(),
    ].filter(Boolean);
    const { error: payErr } = await ctx.supabase.from("payments").insert({
      room_id: p.roomId,
      amount_php: balanceOwed,
      billing_month: billMonth,
      due_date: due,
      status: "pending",
      notes: noteParts.join(" "),
      updated_at: now,
    });
    if (payErr) {
      paymentWarning = `Could not auto-create pending payment (${payErr.message}). Record ₱${balanceOwed.toLocaleString("en-PH")} manually if needed.`;
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/tenants");

  const warning = paymentWarning.trim() || undefined;

  return {
    ok: true,
    message: "Checkout complete.",
    warning,
  };
}
