import { describe, expect, it } from "vitest";
import type { Habit, HabitEvent, Log } from "./model";
import { planDay, usualMinute } from "./today";

const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min);
const ev = (habitId: string, when: Date, extra: Partial<HabitEvent> = {}): HabitEvent => ({
  id: `${habitId}-${when.toISOString()}`,
  habitId,
  at: when.toISOString(),
  approximate: false,
  context: null,
  precededBy: null,
  effort: null,
  payoffNoticed: null,
  payoffNote: null,
  ...extra,
});
const habit = (id: string, frequency: Habit["frequency"]): Habit => ({
  id,
  frequency,
  createdAt: at(2026, 9, 1, 9).toISOString(),
  context: "home",
  cue: "I wake up",
  behavior: id,
  consequence: "",
  archivedAt: null,
});
const today = at(2026, 10, 19, 12); // a Monday

describe("usualMinute", () => {
  it("averages around midnight rather than across the day", () => {
    const events = [ev("h", at(2026, 10, 17, 23, 30)), ev("h", at(2026, 10, 18, 0, 30))];
    const m = usualMinute(events, today)!;
    expect(Math.min(m, 1440 - m)).toBeLessThanOrEqual(1);
  });

  it("leaves out backfilled logs and logs older than 60 days", () => {
    const events = [ev("h", at(2026, 10, 18, 7)), ev("h", at(2026, 10, 17, 12), { approximate: true }), ev("h", at(2026, 6, 1, 20))];
    expect(usualMinute(events, today)).toBe(7 * 60);
  });

  it("is null with no recorded log", () => {
    expect(usualMinute([], today)).toBeNull();
  });
});

describe("planDay", () => {
  const log = (habits: Habit[], events: HabitEvent[]): Log => ({ habits, events, retractions: [], checkIns: [] });
  const ids = (items: { habit: Habit }[]) => items.map((i) => i.habit.id);

  it("runs daily habits by usual time, then the longer periods, and puts what is logged under done in log order", () => {
    const habits = [
      habit("read", "daily"),
      habit("budget", "monthly"),
      habit("stretch", "daily"),
      habit("water", "daily"),
      habit("new", "daily"),
    ];
    const events = [
      ev("read", at(2026, 10, 18, 22)),
      ev("stretch", at(2026, 10, 18, 7)),
      ev("water", at(2026, 10, 18, 10)),
      ev("stretch", today),
    ];
    const day = planDay(log(habits, events), today, today);
    expect(ids(day.todo)).toEqual(["water", "read", "new", "budget"]);
    expect(ids(day.done)).toEqual(["stretch"]);
    expect(day.done[0].loggedAt).toEqual(today);
  });

  it("counts a weekly habit done on any day of its week, and a past day by its own logs", () => {
    const habits = [habit("call", "weekly"), habit("stretch", "daily")];
    const events = [ev("call", at(2026, 10, 21, 18)), ev("stretch", at(2026, 10, 20, 7))];
    const monday = planDay(log(habits, events), today, at(2026, 10, 22, 12));
    expect(ids(monday.done)).toEqual(["call"]);
    expect(monday.done[0].loggedAt).toBeNull();
    const tuesday = planDay(log(habits, events), at(2026, 10, 20, 12), at(2026, 10, 22, 12));
    expect(ids(tuesday.done)).toEqual(["stretch", "call"]);
  });

  it("leaves out archived habits, and days before a habit's first period", () => {
    const late = { ...habit("late", "daily"), createdAt: at(2026, 10, 19, 9).toISOString() };
    const old = { ...habit("old", "daily"), archivedAt: today.toISOString() };
    expect(ids(planDay(log([late, old], []), at(2026, 10, 18, 12), today).todo)).toEqual([]);
    expect(ids(planDay(log([late, old], []), today, today).todo)).toEqual(["late"]);
  });
});
