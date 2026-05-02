export type TenantHistoryRow = {
  leaseId: string;
  roomId: string;
  roomTitle: string;
  roomSlug: string;
  tenantName: string;
  tenantPhone: string | null;
  monthlyRentPhp: number;
  rentDueDay: number;
  leaseStartDisplay: string;
  leaseEndDisplay: string | null;
  isActive: boolean;
  notes: string | null;
};
