import { z } from "zod";

export const createLeaseOccupancySchema = z
  .object({
    roomId: z.string().uuid("Invalid room"),
    tenantName: z.string().min(1, "Tenant name is required"),
    tenantPhone: z
      .string()
      .regex(/^\d{11}$/, "Phone must be exactly 11 digits"),
    leaseStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Move-in must be YYYY-MM-DD"),
    contractMonths: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? undefined : v),
      z.coerce.number().int().min(1).max(120).optional(),
    ),
    leaseEnd: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? undefined : v),
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be YYYY-MM-DD")
        .optional(),
    ),
    monthlyRentPhp: z.coerce.number().positive("Rent must be greater than zero"),
    advanceMonths: z.coerce.number().int().min(0).max(12),
    depositMonths: z.coerce.number().int().min(0).max(12),
    rentDueDay: z.coerce.number().int().min(1).max(28),
    advancePaidPhp: z.coerce.number().min(0),
    depositHeldPhp: z.coerce.number().min(0),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.contractMonths && data.leaseEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use either contract length (months) or a fixed end date, not both.",
        path: ["leaseEnd"],
      });
    }
  });

export type CreateLeaseOccupancyInput = z.infer<typeof createLeaseOccupancySchema>;

export const checkoutVacateSchema = z.object({
  roomId: z.string().uuid(),
  leaseId: z.string().uuid(),
  checkoutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  electricRatePerKwh: z.coerce.number().positive(),
  waterChargePhp: z.coerce.number().min(0),
  previousReading: z.coerce.number().min(0).optional(),
  currentReading: z.coerce.number().min(0).optional(),
  periodStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  periodEnd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  settlementNotes: z.string().optional(),
  recordPendingBalance: z.boolean().optional(),
});

export type CheckoutVacateInput = z.infer<typeof checkoutVacateSchema>;

export const updateRoomMonthlyRentSchema = z.object({
  roomId: z.string().uuid(),
  monthlyRentPhp: z.coerce.number().positive("Rate must be greater than zero"),
});

export type UpdateRoomMonthlyRentInput = z.infer<
  typeof updateRoomMonthlyRentSchema
>;
