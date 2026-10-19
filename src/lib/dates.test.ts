import { describe, expect, it } from "vitest";
import { dayRange, longestStreak, periodKey, recentPeriods, toKey } from "./dates";

const d = (s: string) => {
  const [y, m, day] = s.split("-").map(Number);
  return new Date(y, m - 1, day);
};
const today = d("2026-10-15"); // Thursday

describe("periodKey", () => {
  it("uses the first day of each period", () => {
    expect(periodKey(today, "daily")).toBe("2026-10-15");
    expect(periodKey(today, "weekly")).toBe("2026-10-12"); // Monday
    expect(periodKey(d("2026-10-18"), "weekly")).toBe("2026-10-12"); // Sunday belongs to the same week
    expect(periodKey(today, "monthly")).toBe("2026-10-01");
    expect(periodKey(today, "yearly")).toBe("2026-01-01");
  });
});

describe("longestStreak", () => {
  it("finds the longest daily run", () => {
    const s = new Set(["2026-01-01", "2026-01-02", "2026-01-05", "2026-01-06", "2026-01-07"]);
    expect(longestStreak(s, "daily")).toBe(3);
  });
  it("finds the longest monthly run", () => {
    const s = new Set(["2026-01-01", "2026-02-01", "2026-03-01", "2026-05-01"]);
    expect(longestStreak(s, "monthly")).toBe(3);
  });
  it("is zero when empty", () => {
    expect(longestStreak(new Set(), "weekly")).toBe(0);
  });
});

describe("recentPeriods", () => {
  it("ends with the current period, oldest first", () => {
    expect(recentPeriods(today, "monthly", 3).map(toKey)).toEqual(["2026-08-01", "2026-09-01", "2026-10-01"]);
    expect(recentPeriods(today, "weekly", 2).map(toKey)).toEqual(["2026-10-05", "2026-10-12"]);
  });
});

describe("dayRange", () => {
  it("includes the whole last day and defaults to start through today", () => {
    const r = dayRange("2026-10-01", "2026-10-15", today, today);
    expect(r.contains(new Date(2026, 9, 15, 23, 59).toISOString())).toBe(true);
    expect(r.contains(new Date(2026, 9, 16, 0, 0).toISOString())).toBe(false);
    expect(r.contains(new Date(2026, 8, 30, 23, 59).toISOString())).toBe(false);
    const all = dayRange(undefined, undefined, d("2026-01-01"), today);
    expect([toKey(all.from), toKey(all.to)]).toEqual(["2026-01-01", "2026-10-15"]);
  });
});
