import type { CheckIn } from "./model";

/**
 * Self-Report Behavioural Automaticity Index. Source: Gardner et al. 2012.
 * Each item completes the stem "[Behavior] is something...". The paper's datasets use a
 * 7-point agreement scale, and the index is the mean of the four items.
 */
export const SRBAI_ITEMS = [
  "I do automatically.",
  "I do without having to consciously remember.",
  "I do without thinking.",
  "I start doing before I realize I'm doing it.",
] as const;

export const SRBAI_MIN = 1;
export const SRBAI_MAX = 7;
export const CHECK_IN_EVERY_DAYS = 14;

const DAY_MS = 86_400_000;

/** Mean of the four items, on the 1 to 7 scale. Throws on anything else, so a bad row can't skew the curve. */
export function srbaiScore(items: readonly number[]): number {
  if (items.length !== SRBAI_ITEMS.length) throw new Error(`SRBAI needs ${SRBAI_ITEMS.length} items`);
  for (const x of items) {
    if (!Number.isInteger(x) || x < SRBAI_MIN || x > SRBAI_MAX) throw new Error(`SRBAI item out of range: ${x}`);
  }
  return items.reduce((s, x) => s + x, 0) / items.length;
}

/** When the next check-in is due: now if there is none yet, else 14 days after the last one. */
export function nextCheckInDue(checkIns: CheckIn[], now: Date): Date {
  const last = checkIns.reduce<string | null>((max, c) => (max === null || c.at > max ? c.at : max), null);
  return last === null ? now : new Date(new Date(last).getTime() + CHECK_IN_EVERY_DAYS * DAY_MS);
}

export function checkInDue(checkIns: CheckIn[], now: Date): boolean {
  return nextCheckInDue(checkIns, now) <= now;
}

/** SRBAI history as (days since start, score) points for the curve fit. */
export function srbaiPoints(checkIns: CheckIn[], start: Date): { t: number; y: number }[] {
  return checkIns
    .map((c) => ({ t: (new Date(c.at).getTime() - start.getTime()) / DAY_MS, y: srbaiScore(c.items) }))
    .sort((a, b) => a.t - b.t);
}
