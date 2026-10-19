import { describe, expect, it } from "vitest";
import type { Habit, HabitEvent, Log } from "./model";
import { planToday, usualMinute } from "./today";

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

describe("planToday", () => {
  const log = (habits: Habit[], events: HabitEvent[]): Log => ({ habits, events, retractions: [], checkIns: [] });

  it("leads with the open daily habit usually done earliest, and sorts the rest", () => {
    const habits = [habit("read", "daily"), habit("stretch", "daily"), habit("water", "daily"), habit("new", "daily")];
    const events = [ev("read", at(2026, 10, 18, 22)), ev("stretch", at(2026, 10, 18, 7)), ev("water", at(2026, 10, 18, 10)), ev("stretch", today)];
    const plan = planToday(log(habits, events), today);
    expect(plan.next?.habit.id).toBe("water");
    expect(plan.todo.map((i) => i.habit.id)).toEqual(["read", "new"]);
    expect(plan.done.map((i) => i.habit.id)).toEqual(["stretch"]);
  });

  it("puts weekly and later habits under later, and leads with one once every daily habit is done", () => {
    const habits = [habit("stretch", "daily"), habit("call", "weekly"), habit("budget", "monthly")];
    const events = [ev("stretch", today), ev("budget", at(2026, 10, 2, 19))];
    const plan = planToday(log(habits, events), today);
    expect(plan.next?.habit.id).toBe("call");
    expect(plan.later.map((i) => [i.habit.id, i.doneNow])).toEqual([["budget", true]]);
  });

  it("leaves archived habits out", () => {
    const plan = planToday(log([{ ...habit("old", "daily"), archivedAt: today.toISOString() }], []), today);
    expect(plan.next).toBeNull();
  });
});
