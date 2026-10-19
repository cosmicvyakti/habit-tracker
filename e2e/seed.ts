// Fresh database for the e2e run: one habit with five SRBAI check-ins, so the curve has data.
import { rmSync } from "node:fs";
import { applyOp } from "../src/server/db.server.ts";

const path = process.env.HABITS_DB;
if (!path) throw new Error("Set HABITS_DB");
for (const suffix of ["", "-wal", "-shm"]) rmSync(path + suffix, { force: true });

const DAY = 86_400_000;
const start = Date.now() - 60 * DAY;
const at = (day: number, hour = 7) => new Date(start + day * DAY + hour * 3_600_000).toISOString();

applyOp({
  kind: "habit",
  habit: {
    id: "seed-stretch",
    frequency: "daily",
    createdAt: new Date(start).toISOString(),
    context: "the bedroom",
    cue: "I get out of bed",
    behavior: "stretch for 5 minutes",
    consequence: "my back feels loose",
  },
});
for (let i = 0; i < 50; i++)
  applyOp({
    kind: "event",
    event: {
      id: `seed-event-${i}`,
      habitId: "seed-stretch",
      at: at(i, 7 + (i % 3) * 0.25),
      approximate: false,
      context: "the bedroom",
      precededBy: i % 5 ? "I get out of bed" : "my alarm",
      effort: (5 - Math.floor(i / 12)) as 1 | 2 | 3 | 4 | 5,
      payoffNoticed: i % 2 === 0,
      payoffNote: null,
    },
  });
const scores: [number, number, number, number][] = [
  [1, 2, 1, 1],
  [3, 4, 3, 2],
  [5, 5, 4, 4],
  [6, 5, 5, 5],
  [6, 6, 5, 6],
];
scores.forEach((items, i) => applyOp({ kind: "checkIn", checkIn: { id: `seed-check-in-${i}`, habitId: "seed-stretch", at: at(i * 14), items } }));
