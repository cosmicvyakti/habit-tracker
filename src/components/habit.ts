import { useToast } from "@/components/lime/ui/toast";
import { enqueue, newId, now } from "../data";
import { Frequency, fromKey, periodKey, shiftPeriod } from "../lib/dates";
import type { Habit, HabitEvent } from "../lib/model";

export const UNIT: Record<Frequency, string> = { daily: "day", weekly: "week", monthly: "month", yearly: "year" };
/** "1 week", "2 weeks". */
export const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** "Read 20 pages": the habit's name as a title, in sentence case. */
export const title = (behavior: string) => behavior.charAt(0).toUpperCase() + behavior.slice(1);

/** Where a habit stands, as a badge: a miss is a warning, never a failure (one miss doesn't set a habit back). */
export const MISS_BADGE = {
  "not-started": { variant: "neutral", label: "Not started" },
  "on-track": { variant: "success", label: "On track" },
  "missed-once": { variant: "warn", label: "Missed once" },
  "missed-twice": { variant: "warn", label: "Missed twice" },
} as const;

export const pct = (r: number | null) => (r === null ? "No data" : `${Math.round(r * 100)}%`);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The period starting at `d` in words, such as "Thursday, October 16" or "the week of Oct 13". */
export function describe(d: Date, freq: Frequency): string {
  switch (freq) {
    case "daily":
      return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
    case "weekly": {
      const end = shiftPeriod(d, "daily", 6);
      return `the week of ${MONTHS[d.getMonth()]} ${d.getDate()} to ${MONTHS[end.getMonth()]} ${end.getDate()}`;
    }
    case "monthly":
      return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    case "yearly":
      return String(d.getFullYear());
  }
}

const text = (s: string) => s.trim() || null;

/**
 * Checking a habit off for a day, and clearing it. The log is append-only: a check is a new event, and clearing
 * retracts every event in the habit's period, with an Undo toast that logs them again.
 */
export function useCheckIns() {
  const toast = useToast();
  const retract = (eventId: string) => enqueue({ kind: "retract", retraction: { id: newId(), eventId, at: now() } });

  function toggle(h: Habit, events: HabitEvent[], day: Date) {
    const f = h.frequency;
    const key = periodKey(day, f);
    const inPeriod = events.filter((e) => periodKey(new Date(e.at), f) === key);
    if (inPeriod.length) {
      inPeriod.forEach((e) => retract(e.id));
      toast.show({
        title: `Cleared ${h.behavior}`,
        description: describe(fromKey(key), f).replace(/^./, (c) => c.toUpperCase()),
        action: {
          label: "Undo",
          // The log is append-only, so Undo logs the same entries again under new ids.
          onClick: () => inPeriod.forEach((e) => enqueue({ kind: "event", event: { ...e, id: newId() } })),
        },
      });
      return;
    }
    // In the current period the check is now; on a past day the person knows it happened, not when, so it is that
    // day's noon, marked approximate.
    const current = key === periodKey(new Date(), f);
    const noon = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12);
    const e: HabitEvent = {
      id: newId(),
      habitId: h.id,
      at: current ? now() : noon.toISOString(),
      approximate: !current,
      // Place and cue come from the plan, where an older plan has them.
      context: current ? text(h.context) : null,
      precededBy: current ? text(h.cue) : null,
      effort: null,
      payoffNoticed: null,
      payoffNote: null,
    };
    enqueue({ kind: "event", event: e });
  }

  return { toggle };
}
