/**
 * Canonical note line for a paid invoice bill: `Invoice · <month title> · <bill label>`.
 * Bill label may itself contain spaces; only the first two segments are structured.
 */
export function buildInvoicePaymentNote(
  monthTitle: string,
  billLabel: string,
): string {
  return `Invoice · ${monthTitle.trim()} · ${billLabel.trim()}`;
}

export function parseInvoicePaymentNote(notes: string | null): {
  monthTitle: string;
  billLabel: string;
} | null {
  const n = (notes ?? "").trim();
  if (!n.toLowerCase().startsWith("invoice")) return null;
  const parts = n.split("·").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3 || parts[0]?.toLowerCase() !== "invoice") return null;
  const monthTitle = parts[1] ?? "";
  const billLabel = parts.slice(2).join(" · ");
  if (!monthTitle || !billLabel) return null;
  return { monthTitle, billLabel };
}
