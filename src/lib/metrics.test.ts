import { describe, expect, it } from "vitest";
import { donePeriods, periodStats } from "./consistency";
import { automaticity, fitAutomaticity } from "./curve";
import { longestStreak } from "./dates";
import type { CheckIn, HabitEvent } from "./model";
import { checkInDue, nextCheckInDue, srbaiPoints, srbaiScore } from "./srbai";
import { plannedCueShare, timeOfDaySpread } from "./stability";

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
const checkIn = (at: Date, items: CheckIn["items"]): CheckIn => ({ id: at.toISOString(), habitId: "h", at: at.toISOString(), items });

describe("srbaiScore", () => {
  it("is the mean of the four items, hand-computed", () => {
    expect(srbaiScore([1, 1, 1, 1])).toBe(1);
    expect(srbaiScore([7, 7, 7, 7])).toBe(7);
    expect(srbaiScore([1, 2, 3, 4])).toBe(2.5); // 10 / 4
    expect(srbaiScore([5, 6, 4, 7])).toBe(5.5); // 22 / 4
    expect(srbaiScore([2, 3, 3, 3])).toBe(2.75); // 11 / 4
  });
  it("rejects anything off the 1 to 7 scale or not four items", () => {
    expect(() => srbaiScore([0, 4, 4, 4])).toThrow();
    expect(() => srbaiScore([8, 4, 4, 4])).toThrow();
    expect(() => srbaiScore([4.5, 4, 4, 4])).toThrow();
    expect(() => srbaiScore([4, 4, 4])).toThrow();
  });
});

describe("check-in schedule", () => {
  const now = d("2026-10-15");
  it("is due when there is no check-in yet", () => {
    expect(checkInDue([], now)).toBe(true);
  });
  it("is due 14 days after the last check-in, not before", () => {
    expect(checkInDue([checkIn(d("2026-10-02"), [4, 4, 4, 4])], now)).toBe(false); // 13 days
    expect(checkInDue([checkIn(d("2026-10-01"), [4, 4, 4, 4])], now)).toBe(true); // 14 days
    expect(nextCheckInDue([checkIn(d("2026-09-01"), [4, 4, 4, 4]), checkIn(d("2026-10-02"), [4, 4, 4, 4])], now)).toEqual(
      d("2026-10-16"),
    );
  });
  it("turns check-ins into day offsets and scores", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const pts = srbaiPoints([checkIn(new Date("2026-01-15T00:00:00Z"), [3, 3, 3, 3]), checkIn(start, [1, 2, 1, 2])], start);
    expect(pts).toEqual([
      { t: 0, y: 1.5 },
      { t: 14, y: 3 },
    ]);
  });
});

describe("fitAutomaticity", () => {
  const truth = { a: 6.2, b: 4.8, c: 0.045 };
  const days = Array.from({ length: 11 }, (_, i) => i * 14); // a check-in every 14 days for 20 weeks
  const within5 = (got: number, want: number) => expect(Math.abs(got - want) / want).toBeLessThan(0.05);

  it("recovers known parameters from noise-free data", () => {
    const fit = fitAutomaticity(days.map((t) => ({ t, y: automaticity(truth, t) })))!;
    within5(fit.a, truth.a);
    within5(fit.b, truth.b);
    within5(fit.c, truth.c);
  });

  it("recovers known parameters within 5% from noisy data", () => {
    const noise = [0.03, -0.02, 0.01, -0.03, 0.02, -0.01, 0.03, -0.02, 0.0, 0.02, -0.03];
    const fit = fitAutomaticity(days.map((t, i) => ({ t, y: automaticity(truth, t) + noise[i] })))!;
    within5(fit.a, truth.a);
    within5(fit.b, truth.b);
    within5(fit.c, truth.c);
  });

  it("puts the plateau where the curve reaches 95% of its asymptote", () => {
    // ln(b / (0.05 a)) / c = ln(4.8 / 0.31) / 0.045 ≈ 60.88 days
    const fit = fitAutomaticity(days.map((t) => ({ t, y: automaticity(truth, t) })))!;
    within5(fit.plateauDay!, 60.88);
  });

  it("needs at least 3 points", () => {
    expect(fitAutomaticity([{ t: 0, y: 2 }, { t: 14, y: 3 }])).toBeNull();
    expect(fitAutomaticity([{ t: 0, y: 2 }, { t: 14, y: 3 }, { t: 28, y: 3.6 }])).not.toBeNull();
  });

  it("gives no plateau when the data has not bent yet", () => {
    const linear = days.map((t) => ({ t, y: 1 + 0.02 * t }));
    expect(fitAutomaticity(linear)!.plateauDay).toBeNull();
  });
});

describe("context stability", () => {
  const at = (h: number, m = 0) => new Date(2026, 9, 15, h, m);
  it("measures time-of-day spread on a circle", () => {
    // Two times 4 hours apart: R = cos(π/6), sd = sqrt(-2 ln R) rad ≈ 0.5364 rad ≈ 2.049 h.
    const across = timeOfDaySpread([ev(at(22)), ev(at(2))])!;
    const midday = timeOfDaySpread([ev(at(11)), ev(at(15))])!;
    expect(across).toBeCloseTo(2.049, 2);
    expect(midday).toBeCloseTo(across, 9);
    expect(timeOfDaySpread([ev(at(7, 30)), ev(at(7, 30)), ev(at(7, 30))])).toBeCloseTo(0, 9);
  });
  it("leaves out approximate events", () => {
    expect(timeOfDaySpread([ev(at(7)), ev(at(19), { approximate: true })])).toBeNull();
  });
  it("counts the share of events with the planned cue", () => {
    const events = [
      ev(at(7)),
      ev(at(8), { precededBy: " Coffee " }),
      ev(at(9), { precededBy: "shower" }),
      ev(at(10), { precededBy: null, approximate: true }),
    ];
    expect(plannedCueShare(events, "coffee")).toBeCloseTo(2 / 3, 9);
    expect(plannedCueShare([], "coffee")).toBeNull();
  });
});

describe("consistency and never miss twice", () => {
  const done = (...keys: string[]) => new Set(keys);

  it("treats the current period as pending, not missed", () => {
    const s = periodStats(done("2026-09-28", "2026-09-29", "2026-10-01"), "daily", d("2026-09-28"), d("2026-10-02"), d("2026-10-02"));
    expect(s).toEqual({ done: 3, elapsed: 4, rate: 0.75, doubleMisses: 0, state: "on-track" });
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
