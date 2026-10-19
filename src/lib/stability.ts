import type { HabitEvent } from "./model";

/**
 * Context stability. Habits form when a behavior repeats in a stable context, so a habit that
 * happens at scattered times or without its cue is unlikely to become automatic.
 * Sources: Wood & Neal 2007 (context-cued responses), Lally et al. 2010 (consistent context).
 * Approximate events are left out: their timestamps and cues were reconstructed, not recorded.
 */

const HOURS = 24;

/**
 * Spread of time of day as a circular standard deviation, in hours, in the browser's local time.
 * Circular so that 23:00 and 01:00 count as 2 hours apart, not 22. Null with fewer than 2 events.
 */
export function timeOfDaySpread(events: HabitEvent[]): number | null {
  const exact = events.filter((e) => !e.approximate);
  if (exact.length < 2) return null;
  let sin = 0;
  let cos = 0;
  for (const e of exact) {
    const d = new Date(e.at);
    const angle = ((d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600) / HOURS) * 2 * Math.PI;
    sin += Math.sin(angle);
    cos += Math.cos(angle);
  }
  const r = Math.min(1, Math.hypot(sin, cos) / exact.length);
  if (r === 0) return Infinity;
  return (Math.sqrt(-2 * Math.log(r)) * HOURS) / (2 * Math.PI);
}

const norm = (s: string) => s.trim().toLowerCase();

/** Share of events preceded by the planned cue, 0 to 1. Null when there are no exact events. */
export function plannedCueShare(events: HabitEvent[], plannedCue: string): number | null {
  const exact = events.filter((e) => !e.approximate);
  if (exact.length === 0) return null;
  const cue = norm(plannedCue);
  return exact.filter((e) => cue !== "" && e.precededBy !== null && norm(e.precededBy) === cue).length / exact.length;
}
