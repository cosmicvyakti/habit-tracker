import { beforeAll, describe, expect, it } from "vitest";
import type { HabitEvent } from "../lib/model";
import { withOps } from "../lib/ops";
import type { Op } from "../lib/schema";
import { readLog } from "./db.server";
import { applyOps } from "./ops.server";

const plan = { cue: "I pour coffee", behavior: "read", context: "the kitchen", consequence: "", frequency: "daily" as const };
const habit: Op = { kind: "habit", habit: { ...plan, id: "h1", createdAt: "2026-10-01T07:00:00.000Z" } };
const e1: HabitEvent = {
  id: "e1",
  habitId: "h1",
  at: "2026-10-02T07:00:00.000Z",
  approximate: false,
  context: null,
  precededBy: null,
  effort: 2,
  payoffNoticed: null,
  payoffNote: null,
};
const event: Op = { kind: "event", event: e1 };
const event2: Op = { kind: "event", event: { ...e1, id: "e2" } };
const retract = (id: string, eventId: string): Op => ({ kind: "retract", retraction: { id, eventId, at: "2026-10-02T08:00:00.000Z" } });

// Every test shares one in-memory database, in order: each builds on the last.
beforeAll(() => {
  process.env.HABITS_DB = ":memory:";
});

describe("applyOps on the server", () => {
  it("adds nothing when the same changes arrive twice", () => {
    expect(applyOps([habit, event, retract("r1", "e1")])).toEqual(["ok", "ok", "ok"]);
    expect(applyOps([habit, event, retract("r1", "e1"), retract("r2", "e1")])).toEqual(["ok", "ok", "ok", "ok"]);
    const log = readLog();
    expect([log.habits.length, log.events.length, log.retractions.length]).toEqual([1, 1, 1]);
  });

  it("refuses one bad change without blocking the ones after it", () => {
    expect(applyOps([retract("r3", "missing"), { kind: "nonsense" }, event2])).toEqual(["rejected", "rejected", "ok"]);
    expect(readLog().events.map((e) => e.id)).toEqual(["e1", "e2"]);
  });

  it("keeps the latest plan edit, even when an older one arrives last", () => {
    applyOps([{ kind: "plan", id: "h1", at: "2026-10-05T00:00:00.000Z", plan: { ...plan, behavior: "read 20 pages" } }]);
    applyOps([{ kind: "plan", id: "h1", at: "2026-10-04T00:00:00.000Z", plan: { ...plan, behavior: "read 5 pages" } }]);
    expect(readLog().habits[0].behavior).toBe("read 20 pages");
  });

  it("keeps the first archive time", () => {
    applyOps([{ kind: "archive", id: "h1", at: "2026-10-06T00:00:00.000Z" }]);
    applyOps([{ kind: "archive", id: "h1", at: "2026-10-07T00:00:00.000Z" }]);
    expect(readLog().habits[0].archivedAt).toBe("2026-10-06T00:00:00.000Z");
    expect(applyOps([{ kind: "archive", id: "nope", at: "2026-10-07T00:00:00.000Z" }])).toEqual(["rejected"]);
  });
});

describe("withOps in the browser", () => {
  const empty = { habits: [], events: [], retractions: [], checkIns: [] };

  it("shows queued changes the way the server stores them", () => {
    const server = readLog();
    const local = withOps(empty, [habit, event, retract("r1", "e1"), event2]);
    expect(local.events.map((e) => e.id)).toEqual(server.events.map((e) => e.id));
    expect(local.retractions.map((r) => r.eventId)).toEqual(["e1"]);
  });

  it("applies a change the log already has as a no-op", () => {
    const once = withOps(empty, [habit, event]);
    expect(withOps(once, [habit, event])).toEqual(once);
  });

  it("keeps events oldest first when an earlier backfill is queued", () => {
    const backfill: Op = { kind: "event", event: { ...e1, id: "e0", at: "2026-09-30T12:00:00.000Z", approximate: true } };
    expect(withOps(withOps(empty, [habit, event]), [backfill]).events.map((e) => e.id)).toEqual(["e0", "e1"]);
  });
});
