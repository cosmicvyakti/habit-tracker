import { describe, expect, it } from "vitest";
import { periodKey, toKey } from "./dates";
import { migrateV1 } from "./migrate";

const v1 = [
  { id: "a", name: "Read 20 minutes", frequency: "weekly", createdAt: "2026-01-05", done: ["2026-01-05", "2026-01-12", "2026-01-12"] },
  // Saved before frequencies existed, with a check-in before its creation date.
  { id: "b", name: "Floss", createdAt: "2025-12-31", done: ["2025-12-30", "2025-12-31", "2026-01-01"] },
  { id: "c", name: "Health checkup", frequency: "yearly", createdAt: "2026-03-02", done: [] },
  { name: "no id" },
  "junk",
];

describe("migrateV1", () => {
  const { habits, events } = migrateV1(JSON.parse(JSON.stringify(v1)));

  it("keeps every habit with its name, frequency and creation date", () => {
    expect(habits.map((h) => [h.id, h.behavior, h.frequency, toKey(new Date(h.createdAt))])).toEqual([
      ["a", "Read 20 minutes", "weekly", "2026-01-05"],
      ["b", "Floss", "daily", "2025-12-31"],
      ["c", "Health checkup", "yearly", "2026-03-02"],
    ]);
    expect(habits.every((h) => h.cue === "" && h.context === "" && h.archivedAt === null)).toBe(true);
  });

  it("turns every done period into one approximate event at local noon in that period", () => {
    expect(events).toHaveLength(5); // the duplicate 2026-01-12 collapses into one
    for (const e of events) {
      expect(e.approximate).toBe(true);
      expect(new Date(e.at).getHours()).toBe(12);
      expect(e.precededBy).toBeNull();
    }
    const byHabit = (id: string) => events.filter((e) => e.habitId === id);
    expect(byHabit("a").map((e) => periodKey(new Date(e.at), "weekly"))).toEqual(["2026-01-05", "2026-01-12"]);
    expect(byHabit("b").map((e) => toKey(new Date(e.at)))).toEqual(["2025-12-30", "2025-12-31", "2026-01-01"]);
  });

  it("is idempotent: the same input gives the same event IDs", () => {
    expect(migrateV1(v1).events.map((e) => e.id)).toEqual(events.map((e) => e.id));
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
  });

  it("ignores data that is not a v1 habit list", () => {
    expect(migrateV1(null)).toEqual({ habits: [], events: [] });
    expect(migrateV1({ habits: [] })).toEqual({ habits: [], events: [] });
  });
});
