export function parseLocalDateOnly(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDatePH(date: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
  }).format(date);
}

export function formatIsoDateLocal(isoDate: string): string {
  return formatDatePH(parseLocalDateOnly(isoDate));
}

/** YYYY-MM-DD for a local calendar date (no timezone shift). */
export function formatIsoDateOnlyLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Add whole months to a YYYY-MM-DD date in local calendar terms. */
export function addCalendarMonthsIso(isoDate: string, monthsToAdd: number): string {
  const start = parseLocalDateOnly(isoDate);
  const d = new Date(
    start.getFullYear(),
    start.getMonth() + monthsToAdd,
    start.getDate(),
  );
  return formatIsoDateOnlyLocal(d);
}

export function addCalendarDaysIso(isoDate: string, days: number): string {
  const d = parseLocalDateOnly(isoDate);
  d.setDate(d.getDate() + days);
  return formatIsoDateOnlyLocal(d);
}

const clampRentDueInMonth = (year: number, month0: number, rentDueDay: number) => {
  const last = new Date(year, month0 + 1, 0).getDate();
  const day = Math.min(rentDueDay, last);
  return new Date(year, month0, day);
};

/**
 * Due date for the Nth billing month from lease start (0 = first month on the contract).
 * Never returns a day before move-in: if the first month's calendar due falls before
 * `leaseStartIso`, the first due rolls to the same due-day rule in the next month.
 */
export function dueDateForBillingMonth(
  leaseStartIso: string,
  rentDueDay: number,
  monthIndex: number,
): string {
  const start = parseLocalDateOnly(leaseStartIso);
  const anchor = parseLocalDateOnly(addCalendarMonthsIso(leaseStartIso, monthIndex));
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  let candidate = clampRentDueInMonth(y, m, rentDueDay);

  if (monthIndex === 0 && candidate < start) {
    const m2 = m + 1;
    const y2 = m2 > 11 ? y + 1 : y;
    const month2 = m2 > 11 ? 0 : m2;
    candidate = clampRentDueInMonth(y2, month2, rentDueDay);
  }

  return formatIsoDateOnlyLocal(candidate);
}

/**
 * Billing-period window (`period_start` / `period_end`) for utility rows tied to an
 * invoice month. Matches `RoomPaymentInvoiceDialog` and `recordUtilityReadingAction`.
 */
export function invoiceUtilityPeriodFromDueDateIso(dueDateIso: string): {
  start: string;
  end: string;
} {
  const d = parseLocalDateOnly(dueDateIso);
  const y = d.getFullYear();
  const m = d.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return { start: formatIsoDateOnlyLocal(start), end: formatIsoDateOnlyLocal(end) };
}

/**
 * The next day the tenant is scheduled to pay (per billing month index), on or after `from`.
 * Aligns with invoice line "Due" dates from {@link dueDateForBillingMonth}.
 */
export function computeNextRentDueDate(
  rentDueDay: number,
  leaseStartIso: string,
  from: Date = new Date(),
): Date {
  const fromDay = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i < 48; i++) {
    const iso = dueDateForBillingMonth(leaseStartIso, rentDueDay, i);
    const d = parseLocalDateOnly(iso);
    if (d >= fromDay) return d;
  }
  return parseLocalDateOnly(dueDateForBillingMonth(leaseStartIso, rentDueDay, 0));
}

/**
 * Next due date for recurring monthly charges (rent, utilities on invoice),
 * skipping month index 0 (setup: advance / deposit only). Matches owner UX:
 * "next payment" on the room card is the first full billing cycle, not the
 * setup-window due right after move-in.
 */
export function computeNextRecurringPaymentDueDate(
  rentDueDay: number,
  leaseStartIso: string,
  from: Date = new Date(),
): Date {
  const fromDay = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 1; i < 48; i++) {
    const iso = dueDateForBillingMonth(leaseStartIso, rentDueDay, i);
    const d = parseLocalDateOnly(iso);
    if (d >= fromDay) return d;
  }
  return parseLocalDateOnly(dueDateForBillingMonth(leaseStartIso, rentDueDay, 1));
}

/**
 * 0-based index of how many whole calendar months have passed from the lease
 * start month through `today` (lease start month = 0, next = 1, …), clamped to
 * `[0, monthCount - 1]`. Used to know which invoice months are “current or past”
 * vs still in the future.
 */
export function currentLeaseMonthIndex(
  leaseStartIso: string,
  monthCount: number,
  today: Date = new Date(),
): number {
  if (monthCount <= 0) return 0;
  const start = parseLocalDateOnly(leaseStartIso);
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (t < start) return 0;
  const m =
    (t.getFullYear() - start.getFullYear()) * 12 + (t.getMonth() - start.getMonth());
  return Math.min(Math.max(m, 0), monthCount - 1);
}
