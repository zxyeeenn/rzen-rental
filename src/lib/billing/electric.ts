/** Default electricity rate in PHP per kWh (matches dashboard invoice & checkout). */
export const ELECTRIC_RATE_PHP_PER_KWH = 16;

/**
 * Smallest "previous" reading at which we assume current &lt; previous is a **meter
 * rollover** (5-digit style dial: 00000–99999, then wraps).
 * Below this, current &lt; previous is treated as invalid (likely typo / new meter).
 */
export const ELECTRIC_KWH_ROLLOVER_MIN_PREVIOUS = 90_000;

/** Value **above** the maximum display (e.g. 100_000 for five 0–9 digits). */
export const ELECTRIC_KWH_ROLLOVER_EXCLUSIVE = 100_000;

/**
 * Billable kWh between two cumulative readings.
 *
 * - **Current ≥ previous:** usage = current − previous (**including 0** when equal).
 * - **Current &lt; previous:** only valid if `previous ≥ ELECTRIC_KWH_ROLLOVER_MIN_PREVIOUS`,
 *   then usage = `(ELECTRIC_KWH_ROLLOVER_EXCLUSIVE - previous) + current` (rollover wrap).
 * - Otherwise returns **`null`** (cannot bill automatically — fix readings or enter a different prior read).
 */
export function electricUsageKwh(
  previousReading: number,
  currentReading: number,
): number | null {
  if (
    !Number.isFinite(previousReading) ||
    !Number.isFinite(currentReading) ||
    previousReading < 0 ||
    currentReading < 0
  ) {
    return null;
  }

  if (currentReading >= previousReading) {
    return currentReading - previousReading;
  }

  if (previousReading >= ELECTRIC_KWH_ROLLOVER_MIN_PREVIOUS) {
    const delta =
      ELECTRIC_KWH_ROLLOVER_EXCLUSIVE - previousReading + currentReading;
    return delta >= 0 ? delta : null;
  }

  return null;
}

export function electricChargePhp(
  previousReading: number,
  currentReading: number,
  ratePerKwh: number = ELECTRIC_RATE_PHP_PER_KWH,
): number | null {
  const kwh = electricUsageKwh(previousReading, currentReading);
  if (kwh === null) return null;
  return kwh * ratePerKwh;
}
