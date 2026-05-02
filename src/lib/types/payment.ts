import type { RoomStatus } from "@/lib/schemas/room-status";

export type PaymentMonthBucket = {
  /** `YYYY-MM` billing month */
  month: string;
  paidPhp: number;
  pendingPhp: number;
};

export type PaymentRecord = {
  id: string;
  roomId: string;
  roomTitle: string;
  roomSlug: string;
  roomStatus: RoomStatus;
  amountPhp: number;
  billingMonth: string;
  dueDate: string;
  paidDate: string | null;
  status: "pending" | "paid";
  notes: string | null;
  createdAt: string;
};

export type PaymentSnapshot = {
  totalCollectedPhp: number;
  monthCollectedPhp: number;
  pendingAmountPhp: number;
  pendingCount: number;
  records: PaymentRecord[];
  /** Chronological buckets for charts */
  chartByMonth: PaymentMonthBucket[];
};
