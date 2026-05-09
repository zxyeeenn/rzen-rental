import { z } from "zod";

const monthElectricSchema = z.object({
  prev: z.string(),
  curr: z.string(),
  applied: z.boolean(),
});

export const invoiceUiStateSchema = z
  .object({
    paidLineIds: z.array(z.string()).optional(),
    manualUnlockedMonths: z.array(z.number().int().min(0)).optional(),
    electricByMonth: z.record(z.string(), monthElectricSchema).optional(),
  })
  .passthrough();

export type InvoiceUiState = z.infer<typeof invoiceUiStateSchema>;

export type MonthElectricPersisted = z.infer<typeof monthElectricSchema>;

export function parseInvoiceUiState(raw: unknown): InvoiceUiState {
  const parsed = invoiceUiStateSchema.safeParse(raw ?? {});
  if (!parsed.success) return {};
  return parsed.data;
}

export function invoiceUiStateHasData(state: InvoiceUiState | undefined): boolean {
  if (!state) return false;
  if ((state.paidLineIds?.length ?? 0) > 0) return true;
  if ((state.manualUnlockedMonths?.length ?? 0) > 0) return true;
  return Object.keys(state.electricByMonth ?? {}).length > 0;
}

/** Alias for client components (invoice dialog). */
export type InvoiceMonthElectric = MonthElectricPersisted;

export function electricStateFromPersisted(
  raw: Record<string, MonthElectricPersisted> | undefined,
): Record<number, InvoiceMonthElectric> {
  const out: Record<number, InvoiceMonthElectric> = {};
  if (raw) {
    for (const [k, v] of Object.entries(raw)) {
      const i = Number(k);
      if (!Number.isInteger(i) || i < 0) continue;
      out[i] = { prev: v.prev, curr: v.curr, applied: v.applied };
    }
  }
  if (Object.keys(out).length === 0) {
    return { 0: { prev: "", curr: "", applied: false } };
  }
  return out;
}

export function electricStateToPersisted(
  m: Record<number, InvoiceMonthElectric>,
): Record<string, MonthElectricPersisted> {
  const out: Record<string, MonthElectricPersisted> = {};
  for (const [k, v] of Object.entries(m)) {
    const i = Number(k);
    if (!Number.isInteger(i) || i < 0) continue;
    out[String(i)] = { prev: v.prev, curr: v.curr, applied: v.applied };
  }
  return out;
}

/**
 * Supabase/PostgREST error when `leases.invoice_ui_state` was never migrated.
 */
export function isMissingLeasesInvoiceUiStateColumnError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("invoice_ui_state") ||
    (m.includes("schema cache") && m.includes("leases"))
  );
}
