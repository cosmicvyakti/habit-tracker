import { opSchema } from "../lib/schema";
import { applyOp } from "./db.server";

/**
 * Applies a batch of changes in order, each on its own, so one the server refuses doesn't block
 * the rest. Validates here rather than at the server function, for the same reason.
 */
export function applyOps(ops: unknown[]): ("ok" | "rejected")[] {
  return ops.map((raw) => {
    const op = opSchema.safeParse(raw);
    try {
      if (!op.success) throw op.error;
      applyOp(op.data);
      return "ok";
    } catch (e) {
      console.warn("Rejected a synced change:", e instanceof Error ? e.message : e);
      return "rejected";
    }
  });
}
