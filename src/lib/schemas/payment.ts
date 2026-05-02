import { z } from "zod";

export const paymentStatusSchema = z.enum(["pending", "paid"]);

export const recordPaidInvoiceLineSchema = z.object({
  roomId: z.string().uuid(),
  amountPhp: z.coerce.number().positive("Amount must be positive"),
  billingMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Billing month must be YYYY-MM"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().min(1).max(500),
});
