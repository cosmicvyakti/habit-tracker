import type { HabitEvent } from "./model";

/**
 * Effort and payoff, as the user reported them at log time. Effort is a proxy for automaticity between check-ins,
 * not a measure from the paper: automaticity rises with repetition, so effort should fall. Source: Lally et al. 2010.
 * Payoff noticed is the reinforcement that follows the behavior. Source: Skinner 1938.
 */

const DAY_MS = 86_400_000;
/** Each end of the comparison covers this many days. */
export const EFFORT_WINDOW_DAYS = 28;

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

/**
 * Mean effort over the first and the last 4 weeks of the range. Null ends when they have no ratings; when the range is
 * shorter than both windows together, only `all` is set, so the two ends never share an event.
 */
export function effortTrend(events: HabitEvent[], from: Date, to: Date) {
  const rated = events.filter((e) => e.effort !== null);
  const all = mean(rated.map((e) => e.effort!));
  const span = (to.getTime() - from.getTime()) / DAY_MS;
  if (span < 2 * EFFORT_WINDOW_DAYS) return { all, first: null, last: null };
  const firstEnd = from.getTime() + EFFORT_WINDOW_DAYS * DAY_MS;
  const lastStart = to.getTime() - EFFORT_WINDOW_DAYS * DAY_MS;
  const at = (e: HabitEvent) => new Date(e.at).getTime();
  return {
    all,
    first: mean(rated.filter((e) => at(e) < firstEnd).map((e) => e.effort!)),
    last: mean(rated.filter((e) => at(e) >= lastStart).map((e) => e.effort!)),
  };
}

/** Logs where the user noticed the payoff, out of logs where they answered. */
export function payoffNoticed(events: HabitEvent[]) {
  const answered = events.filter((e) => e.payoffNoticed !== null);
  return { yes: answered.filter((e) => e.payoffNoticed).length, answered: answered.length };
}
