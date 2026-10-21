import { describe, expect, it } from "vitest";
import { countFrom, donePeriods, periodStats } from "./consistency";
import { longestStreak } from "./dates";
import type { HabitEvent } from "./model";

const d = (s: string) => {
  const [y, m, day] = s.split("-").map(Number);
  return new Date(y, m - 1, day);
};
const ev = (at: Date, extra: Partial<HabitEvent> = {}): HabitEvent => ({
  id: at.toISOString(),
  habitId: "h",
  at: at.toISOString(),
  approximate: false,
  context: "kitchen",
  precededBy: "coffee",
  effort: null,
  payoffNoticed: null,
  payoffNote: null,
  ...extra,
});

describe("consistency and never miss twice", () => {
  const done = (...keys: string[]) => new Set(keys);

  it("treats the current period as pending, not missed", () => {
    const s = periodStats(done("2026-09-28", "2026-09-29", "2026-10-01"), "daily", d("2026-09-28"), d("2026-10-02"), d("2026-10-02"));
    expect(s).toEqual({ done: 3, elapsed: 4, rate: 0.75, doubleMisses: 0, state: "on-track" });
  });

  it("is not started before the first log, rather than missed", () => {
    const s = periodStats(done(), "daily", d("2026-10-17"), d("2026-10-19"), d("2026-10-19"));
    expect(s).toMatchObject({ done: 0, elapsed: 2, state: "not-started" });
  });

  it("counts from the first full period when the first one wasn't logged", () => {
    const evening = new Date(2026, 9, 17, 21);
    expect(countFrom(evening, done(), "daily")).toEqual(d("2026-10-18"));
    expect(countFrom(evening, done("2026-10-17"), "daily")).toEqual(d("2026-10-17"));
    expect(countFrom(d("2026-10-17"), done(), "daily")).toEqual(d("2026-10-17"));
    // Created in April: this year is its first period, and it hasn't ended.
    expect(countFrom(new Date(2026, 3, 9), done(), "yearly")).toEqual(d("2027-01-01"));
  });

  it("counts the current period once it is done", () => {
    const s = periodStats(done("2026-10-01", "2026-10-02"), "daily", d("2026-10-01"), d("2026-10-02"), d("2026-10-02"));
    expect(s).toMatchObject({ done: 2, elapsed: 2, rate: 1 });
  });

  it("flags two daily misses in a row across a month boundary", () => {
    const s = periodStats(done("2026-09-29"), "daily", d("2026-09-29"), d("2026-10-02"), d("2026-10-02"));
    expect(s).toMatchObject({ done: 1, elapsed: 3, doubleMisses: 1, state: "missed-twice" });
  });

  it("flags one weekly miss across a year boundary", () => {
    // Weeks start 2025-12-22 (done), 2025-12-29 (missed), 2026-01-05 (current, pending).
    const s = periodStats(done("2025-12-22"), "weekly", d("2025-12-22"), d("2026-01-07"), d("2026-01-07"));
    expect(s).toMatchObject({ done: 1, elapsed: 2, doubleMisses: 0, state: "missed-once" });
  });

  it("flags two monthly misses across a year boundary, then recovers", () => {
    const missed = periodStats(done("2025-11-01"), "monthly", d("2025-11-01"), d("2026-02-03"), d("2026-02-03"));
    expect(missed).toMatchObject({ done: 1, elapsed: 3, doubleMisses: 1, state: "missed-twice" });
    const back = periodStats(done("2025-11-01", "2026-02-01"), "monthly", d("2025-11-01"), d("2026-02-03"), d("2026-02-03"));
    expect(back).toMatchObject({ done: 2, elapsed: 4, rate: 0.5, doubleMisses: 1, state: "on-track" });
  });

  it("counts yearly periods and stops at the end of the range", () => {
    const s = periodStats(done("2023-01-01", "2025-01-01"), "yearly", d("2023-03-01"), d("2025-06-01"), d("2026-10-15"));
    expect(s).toMatchObject({ done: 2, elapsed: 3, doubleMisses: 0, state: "on-track" });
  });

  it("buckets events into local periods, Sunday night belonging to the week that started Monday", () => {
    const sundayNight = new Date(2026, 0, 4, 23, 30); // Sunday 2026-01-04
    expect([...donePeriods([ev(sundayNight)], "weekly")]).toEqual(["2025-12-29"]);
    expect([...donePeriods([ev(sundayNight)], "yearly")]).toEqual(["2026-01-01"]);
  });

  it("keeps the longest streak for reference", () => {
    expect(longestStreak(done("2025-12-30", "2025-12-31", "2026-01-01", "2026-01-03"), "daily")).toBe(3);
  });
});
