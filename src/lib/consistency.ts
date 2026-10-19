import { Frequency, periodKey, periodStart, shiftPeriod, toKey } from "./dates";
import type { HabitEvent } from "./model";

/**
 * Consistency replaces the reset-to-zero streak. Missing a single opportunity did not
 * materially affect automaticity gains, so one miss shouldn't wipe out progress, but
 * repeated misses do slow habit formation. Source: Lally et al. 2010.
 */
export type MissState = "on-track" | "missed-once" | "missed-twice";

export interface PeriodStats {
  /** Periods in range with at least one event. */
  done: number;
  /** Periods in range that have ended, plus the current one if it is already done. */
  elapsed: number;
  /** done / elapsed, or null before any period has elapsed. */
  rate: number | null;
  /** Runs of two or more missed periods in a row. */
  doubleMisses: number;
  /** Where the user stands now. Only meaningful when the range reaches today. */
  state: MissState;
}

/** Keys of periods (YYYY-MM-DD of their first day) with at least one event, in local time. */
export function donePeriods(events: HabitEvent[], freq: Frequency): Set<string> {
  return new Set(events.map((e) => periodKey(new Date(e.at), freq)));
}

/** Consistency over the periods from `from` to `to`, capped at today. The current period is pending, not missed, until it ends. */
export function periodStats(done: Set<string>, freq: Frequency, from: Date, to: Date, today: Date): PeriodStats {
  const current = periodStart(today, freq);
  const last = periodStart(to < today ? to : today, freq);
  const hits: boolean[] = [];
  for (let p = periodStart(from, freq); p <= last; p = shiftPeriod(p, freq, 1)) {
    const hit = done.has(toKey(p));
    if (p.getTime() === current.getTime() && !hit) break;
    hits.push(hit);
  }

  let doubleMisses = 0;
  let run = 0;
  for (const hit of hits) {
    run = hit ? 0 : run + 1;
    if (run === 2) doubleMisses++;
  }
  // `run` is now the number of misses at the end of the range.
  const state: MissState = run === 0 ? "on-track" : run === 1 ? "missed-once" : "missed-twice";

  const n = hits.filter(Boolean).length;
  return { done: n, elapsed: hits.length, rate: hits.length ? n / hits.length : null, doubleMisses, state };
}
