/** Format a Date as a local YYYY-MM-DD key. */
export function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

/** Consecutive completed days ending today, or yesterday if today isn't done yet. */
export function currentStreak(done: Set<string>, today: Date): number {
  let day = done.has(toKey(today)) ? today : addDays(today, -1);
  let n = 0;
  while (done.has(toKey(day))) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export function longestStreak(done: Set<string>): number {
  let best = 0;
  for (const key of done) {
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    if (done.has(toKey(addDays(date, -1)))) continue; // not a run start
    let len = 0;
    let cur = date;
    while (done.has(toKey(cur))) {
      len++;
      cur = addDays(cur, 1);
    }
    best = Math.max(best, len);
  }
  return best;
}

/**
 * Weeks (columns, Sunday-first) covering the last `weeks` weeks up to today.
 * Days after today are null.
 */
export function heatmapWeeks(today: Date, weeks: number): (Date | null)[][] {
  const start = addDays(today, -today.getDay() - (weeks - 1) * 7);
  const cols: (Date | null)[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: (Date | null)[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, w * 7 + i);
      col.push(d > today ? null : d);
    }
    cols.push(col);
  }
  return cols;
}
