import { z } from "zod";

import { electricUsageKwh } from "@/lib/billing/electric";

export const utilityKindSchema = z.enum(["electric", "water"]);

export const utilityReadingFormSchema = z
  .object({
    roomId: z.string().min(1, "Choose a room"),
    kind: utilityKindSchema,
    periodStart: z.string().min(1, "Start date required"),
    periodEnd: z.string().min(1, "End date required"),
    previousReading: z.coerce.number().nonnegative("Must be zero or positive"),
    currentReading: z.coerce.number().nonnegative("Must be zero or positive"),
    notes: z.string().optional(),
  })
  .refine((data) => data.periodEnd >= data.periodStart, {
    message: "End date must be on or after start",
    path: ["periodEnd"],
  })
  .superRefine((data, ctx) => {
    if (data.kind === "electric") {
      const kwh = electricUsageKwh(
        data.previousReading,
        data.currentReading,
      );
      if (kwh === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Electric: current must be ≥ previous (0 kWh if equal), or previous ≥ 90,000 for a rollover wrap. Otherwise readings look inconsistent.",
          path: ["currentReading"],
        });
      }
    } else if (data.currentReading < data.previousReading) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Current reading must be ≥ previous reading",
        path: ["currentReading"],
      });
    }
  });

export type UtilityReadingFormInput = z.infer<typeof utilityReadingFormSchema>;
