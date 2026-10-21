import { describe, expect, it } from "vitest";
import { toKey } from "./dates";
import type { Habit, HabitEvent, Log } from "./model";
import { rate, shiftSpan, spanEnd, spanStart, spanStats } from "./stats";

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);
const habit = (id: string, frequency: Habit["frequency"], created = at(2026, 9, 1, 9)): Habit => ({
  id,
  frequency,
  createdAt: created.toISOString(),
  context: "",
  cue: "",
  behavior: id,
  consequence: "",
  archivedAt: null,
});
const ev = (habitId: string, when: Date, approximate = false): HabitEvent => ({
  id: `${habitId}-${when.toISOString()}`,
  habitId,
  at: when.toISOString(),
  approximate,
  context: null,
  precededBy: null,
  effort: null,
  payoffNoticed: null,
  payoffNote: null,
});
const log = (habits: Habit[], events: HabitEvent[]): Log => ({ habits, events, retractions: [], checkIns: [] });

describe("spans", () => {
  it("start on Monday, the 1st, the quarter's first month and January", () => {
    const d = at(2026, 11, 19); // a Thursday in the fourth quarter
    expect(["week", "month", "quarter", "year"].map((s) => toKey(spanStart(d, s as never)))).toEqual([
      "2026-11-16",
      "2026-11-01",
      "2026-10-01",
      "2026-01-01",
    ]);
    expect(toKey(spanEnd(spanStart(d, "quarter"), "quarter"))).toBe("2026-12-31");
    expect(toKey(shiftSpan(spanStart(d, "quarter"), "quarter", -1))).toBe("2026-07-01");
  });
});

describe("spanStats", () => {
  // Wednesday, October 21, 2026. The week runs Monday 19 to Sunday 25.
  const today = at(2026, 10, 21, 20);
  const stretch = habit("stretch", "daily");
  const call = habit("call", "weekly");
  const budget = habit("budget", "monthly");
  const events = [
    ev("stretch", at(2026, 10, 19, 7)),
    ev("stretch", at(2026, 10, 21, 7)),
    ev("call", at(2026, 10, 20, 18)),
    ev("stretch", at(2026, 10, 14, 7)),
    ev("budget", at(2026, 10, 2), true),
  ];

  it("counts a week's daily and weekly periods, leaving a monthly habit out of a week", () => {
    const s = spanStats(log([stretch, call, budget], events), "week", today, today);
    // Stretch: Mon done, Tue missed, Wed done (today). Call: this week done early. Budget doesn't fit a week.
    expect(s.total).toEqual({ done: 3, planned: 4 });
    expect(s.habits.map((h) => h.habit.id)).toEqual(["stretch", "call"]);
    expect(s.bars.map((b) => b.tally)).toEqual([
      { done: 1, planned: 1 },
      { done: 0, planned: 1 },
      { done: 1, planned: 1 },
      ...Array(4).fill({ done: 0, planned: 0 }),
    ]);
    expect(s.perfectDays).toBe(2);
    expect(s.days.map((d) => d.level)).toEqual([3, 0, 3, "none", "none", "none", "none"]);
    // Last week: stretch on 1 of 7 days; the call was missed.
    expect(s.previous).toEqual({ done: 1, planned: 8 });
    expect(s.checkIns).toBe(3);
    expect(s.times).toEqual([2, 0, 1, 0]);
    expect(s.weekdays.slice(0, 3)).toEqual([
      { done: 1, planned: 1 },
      { done: 0, planned: 1 },
      { done: 1, planned: 1 },
    ]);
  });

  it("draws a year as months, and counts monthly habits in it", () => {
    const s = spanStats(log([budget], events), "year", today, today);
    expect(s.bars).toHaveLength(12);
    // Created in September, so October is its first period, logged by a backfill.
    expect(s.bars[9].tally).toEqual({ done: 1, planned: 1 });
    expect(rate(s.total)).toBe(1);
    // Three mornings and an evening; the budget's backfill has no real time of day.
    expect(s.times).toEqual([3, 0, 1, 0]);
  });

  it("leaves an archived habit out of spans after it", () => {
    const old = { ...habit("old", "daily", at(2026, 8, 1)), archivedAt: at(2026, 8, 31).toISOString() };
    expect(spanStats(log([old], []), "week", today, today).habits).toEqual([]);
    // Made at noon on August 1, so August 2 is its first counted day.
    expect(spanStats(log([old], []), "month", at(2026, 8, 15), today).total.planned).toBe(30);
  });
});
