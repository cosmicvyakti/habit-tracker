import { FREQUENCIES, Frequency, fromKey } from "./dates";
import type { Habit, HabitEvent } from "./model";

export const V1_KEY = "habit-tracker:v1";
/** The v1 data is kept under this key after a successful import, never deleted. */
export const V1_MIGRATED_KEY = "habit-tracker:v1:migrated";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Convert `habit-tracker:v1` localStorage data into habits and events. Runs in the browser so
 * dates resolve in the user's own time zone.
 *
 * v1 stored only which periods were done, so each event lands at local noon on the period's first
 * day and is marked approximate. v1 had no cue, place or payoff, so those stay empty. Event IDs are
 * derived from the habit and period, so importing the same data twice adds nothing.
 */
export function migrateV1(raw: unknown): { habits: Habit[]; events: HabitEvent[] } {
  const habits: Habit[] = [];
  const events: HabitEvent[] = [];
  if (!Array.isArray(raw)) return { habits, events };

  for (const h of raw) {
    if (typeof h !== "object" || h === null || typeof h.id !== "string" || typeof h.name !== "string") continue;
    // Habits saved before frequencies existed are daily habits.
    const frequency: Frequency = FREQUENCIES.includes(h.frequency) ? h.frequency : "daily";
    const done: string[] = Array.isArray(h.done) ? h.done.filter((k: unknown) => typeof k === "string" && DATE_KEY.test(k)) : [];
    const created = typeof h.createdAt === "string" && DATE_KEY.test(h.createdAt) ? h.createdAt : [...done].sort()[0];

    habits.push({
      id: h.id,
      frequency,
      createdAt: (created ? fromKey(created) : new Date()).toISOString(),
      context: "",
      cue: "",
      behavior: h.name,
      consequence: "",
      archivedAt: null,
    });
    for (const key of new Set(done)) {
      const noon = fromKey(key);
      noon.setHours(12);
      events.push({
        id: `v1:${h.id}:${key}`,
        habitId: h.id,
        at: noon.toISOString(),
        approximate: true,
        context: null,
        precededBy: null,
        effort: null,
        payoffNoticed: null,
        payoffNote: null,
      });
    }
  }
  return { habits, events };
}
