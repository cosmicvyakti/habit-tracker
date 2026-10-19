export type Frequency = "daily" | "weekly" | "monthly" | "yearly";

export const FREQUENCIES: Frequency[] = ["daily", "weekly", "monthly", "yearly"];

export const FREQUENCY_LABEL: Record<Frequency, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" };

/** Format a Date as a local YYYY-MM-DD key. */
export function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** First day of the period containing `d`. Weeks start on Monday. */
export function periodStart(d: Date, freq: Frequency): Date {
  switch (freq) {
    case "daily":
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    case "weekly":
      return addDays(d, -((d.getDay() + 6) % 7));
    case "monthly":
      return new Date(d.getFullYear(), d.getMonth(), 1);
    case "yearly":
      return new Date(d.getFullYear(), 0, 1);
  }
}

/** Start of the period `n` periods after the one starting at `start`. */
export function shiftPeriod(start: Date, freq: Frequency, n: number): Date {
  switch (freq) {
    case "daily":
      return addDays(start, n);
    case "weekly":
      return addDays(start, 7 * n);
    case "monthly":
      return new Date(start.getFullYear(), start.getMonth() + n, 1);
    case "yearly":
      return new Date(start.getFullYear() + n, 0, 1);
  }
}

/** Key for the period containing `d`: the YYYY-MM-DD of its first day. */
export function periodKey(d: Date, freq: Frequency): string {
  return toKey(periodStart(d, freq));
}

export function longestStreak(done: Set<string>, freq: Frequency): number {
  let best = 0;
  for (const key of done) {
    const start = fromKey(key);
    if (done.has(toKey(shiftPeriod(start, freq, -1)))) continue; // not a run start
    let len = 0;
    let p = start;
    while (done.has(toKey(p))) {
      len++;
      p = shiftPeriod(p, freq, 1);
    }
    best = Math.max(best, len);
  }
  return best;
}

/** The last `count` period starts, oldest first, ending with the current period. */
export function recentPeriods(today: Date, freq: Frequency, count: number): Date[] {
  const current = periodStart(today, freq);
  return Array.from({ length: count }, (_, i) => shiftPeriod(current, freq, i - count + 1));
}

/** An inclusive local-day range from YYYY-MM-DD search params, defaulting to `start` through `today`. */
export function dayRange(from: string | undefined, to: string | undefined, start: Date, today: Date) {
  const lo = from ? fromKey(from) : periodStart(start, "daily");
  const hi = to ? fromKey(to) : periodStart(today, "daily");
  const end = addDays(hi, 1);
  return { from: lo, to: hi, contains: (at: string) => new Date(at) >= lo && new Date(at) < end };
}
