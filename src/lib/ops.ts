import type { Log } from "./model";
import type { Op } from "./schema";

const byAt = (a: { at: string }, b: { at: string }) => a.at.localeCompare(b.at);

/**
 * The log as the server will have it once the queued changes sync. Mirrors the server's applyOp: a change
 * the log already has does nothing, so applying one twice is safe. Keeps readLog's oldest-first order.
 */
export function withOps(log: Log, ops: Op[]): Log {
  if (ops.length === 0) return log;
  const habits = new Map(log.habits.map((h) => [h.id, h]));
  const events = new Map(log.events.map((e) => [e.id, e]));
  const retractions = new Map(log.retractions.map((r) => [r.eventId, r]));
  const checkIns = new Map(log.checkIns.map((c) => [c.id, c]));
  for (const op of ops) {
    switch (op.kind) {
      case "habit":
        if (!habits.has(op.habit.id)) habits.set(op.habit.id, { ...op.habit, archivedAt: null });
        break;
      case "plan": {
        // A queued edit is always newer than what the server sent.
        const h = habits.get(op.id);
        if (h) habits.set(op.id, { ...h, ...op.plan });
        break;
      }
      case "archive": {
        const h = habits.get(op.id);
        if (h && !h.archivedAt) habits.set(op.id, { ...h, archivedAt: op.at });
        break;
      }
      case "event":
        if (!events.has(op.event.id)) events.set(op.event.id, op.event);
        break;
      case "retract":
        if (events.has(op.retraction.eventId) && !retractions.has(op.retraction.eventId))
          retractions.set(op.retraction.eventId, op.retraction);
        break;
      case "checkIn":
        if (!checkIns.has(op.checkIn.id)) checkIns.set(op.checkIn.id, op.checkIn);
        break;
    }
  }
  return {
    habits: [...habits.values()],
    events: [...events.values()].sort(byAt),
    retractions: [...retractions.values()].sort(byAt),
    checkIns: [...checkIns.values()].sort(byAt),
  };
}
