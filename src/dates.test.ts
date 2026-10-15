import { describe, expect, it } from "vitest";
import { currentStreak, longestStreak, periodKey, recentPeriods, toKey } from "./dates";

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

describe("currentStreak", () => {
  it("counts daily runs ending today", () => {
    expect(currentStreak(new Set(["2026-10-13", "2026-10-14", "2026-10-15"]), today, "daily")).toBe(3);
  });
  it("counts from the previous period when the current one is not done yet", () => {
    expect(currentStreak(new Set(["2026-10-13", "2026-10-14"]), today, "daily")).toBe(2);
    expect(currentStreak(new Set(["2026-09-28", "2026-10-05"]), today, "weekly")).toBe(2);
  });
  it("is zero after a missed period", () => {
    expect(currentStreak(new Set(["2026-10-12"]), today, "daily")).toBe(0);
    expect(currentStreak(new Set(["2026-08-01"]), today, "monthly")).toBe(0);
  });
  it("crosses month and year boundaries", () => {
    expect(currentStreak(new Set(["2026-09-30", "2026-10-01"]), d("2026-10-01"), "daily")).toBe(2);
    expect(currentStreak(new Set(["2025-12-01", "2026-01-01"]), d("2026-01-20"), "monthly")).toBe(2);
    expect(currentStreak(new Set(["2024-01-01", "2025-01-01", "2026-01-01"]), today, "yearly")).toBe(3);
  });
  it("counts weekly runs across a year boundary", () => {
    expect(currentStreak(new Set(["2025-12-22", "2025-12-29", "2026-01-05"]), d("2026-01-07"), "weekly")).toBe(3);
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
