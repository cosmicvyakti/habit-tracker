import { describe, expect, it } from "vitest";
import { currentStreak, heatmapWeeks, longestStreak, toKey } from "./dates";

const d = (s: string) => {
  const [y, m, day] = s.split("-").map(Number);
  return new Date(y, m - 1, day);
};

describe("currentStreak", () => {
  it("counts back from today", () => {
    expect(currentStreak(new Set(["2026-10-13", "2026-10-14", "2026-10-15"]), d("2026-10-15"))).toBe(3);
  });
  it("still counts from yesterday when today is not done", () => {
    expect(currentStreak(new Set(["2026-10-13", "2026-10-14"]), d("2026-10-15"))).toBe(2);
  });
  it("is zero after a missed day", () => {
    expect(currentStreak(new Set(["2026-10-12"]), d("2026-10-15"))).toBe(0);
  });
  it("crosses month boundaries", () => {
    expect(currentStreak(new Set(["2026-09-30", "2026-10-01"]), d("2026-10-01"))).toBe(2);
  });
});

describe("longestStreak", () => {
  it("finds the longest run", () => {
    const s = new Set(["2026-01-01", "2026-01-02", "2026-01-05", "2026-01-06", "2026-01-07"]);
    expect(longestStreak(s)).toBe(3);
  });
  it("is zero when empty", () => {
    expect(longestStreak(new Set())).toBe(0);
  });
});

describe("heatmapWeeks", () => {
  it("ends on today with future days null", () => {
    const today = d("2026-10-15"); // Thursday
    const weeks = heatmapWeeks(today, 4);
    expect(weeks).toHaveLength(4);
    const last = weeks[3];
    expect(toKey(last[4]!)).toBe("2026-10-15");
    expect(last[5]).toBeNull();
    expect(weeks[0][0]!.getDay()).toBe(0);
  });
});
