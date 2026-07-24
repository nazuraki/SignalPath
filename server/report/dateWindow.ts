/**
 * "Previous workday" window logic — a server-side port of standup-prep Step 0.
 * Pure and deterministic given an input `today`, so it can be unit-tested and
 * driven by an explicit `?date=` override from the report page.
 */

export interface DateWindow {
  /** YYYY-MM-DD, inclusive. For a single workday, equals endDate. */
  startDate: string;
  /** YYYY-MM-DD, inclusive. */
  endDate: string;
  /** True when the reported workday falls on a Friday. */
  isFriday: boolean;
}

/** Format a Date as YYYY-MM-DD in the host's local timezone. */
export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** The calendar day after a YYYY-MM-DD string (used for exclusive upper bounds). */
export function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return ymd(d);
}

/**
 * Compute the previous-workday window relative to `today` (local time):
 * - Monday       → last Friday
 * - Tuesday–Fri  → yesterday
 * - Sat / Sun    → last Friday
 *
 * `override` (YYYY-MM-DD), when given, is used verbatim as a single-day window.
 */
export function previousWorkday(today: Date, override?: string): DateWindow {
  if (override) {
    const d = new Date(`${override}T00:00:00`);
    return { startDate: override, endDate: override, isFriday: d.getDay() === 5 };
  }
  const dow = today.getDay(); // 0=Sun … 6=Sat
  let back: number;
  if (dow === 1)
    back = 3; // Mon → Fri
  else if (dow === 0)
    back = 2; // Sun → Fri
  else back = 1; // Sat → Fri, Tue–Fri → yesterday
  const prev = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
  const s = ymd(prev);
  return { startDate: s, endDate: s, isFriday: prev.getDay() === 5 };
}
