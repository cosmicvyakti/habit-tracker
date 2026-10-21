import { z } from "zod";
import { FREQUENCIES } from "./dates";
import { SRBAI_MAX, SRBAI_MIN } from "./srbai";

const field = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters.`);

/**
 * A habit's plan. The form asks for the behavior and how often; cue, context and consequence are what older plans
 * carry, the implementation intention "After [cue], I will [behavior] at [context]" (Gollwitzer 1999), kept as they are.
 */
export const planSchema = z.object({
  cue: field(120),
  behavior: field(120).min(1, "Name the habit."),
  context: field(120),
  consequence: field(120),
  frequency: z.enum(FREQUENCIES),
});
export type Plan = z.infer<typeof planSchema>;

const id = z.string().min(1).max(200);
// Normalized to UTC so stored timestamps sort as strings.
const iso = z.iso.datetime({ offset: true }).transform((s) => new Date(s).toISOString());
const effort = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).nullable();

const item = z.int().min(SRBAI_MIN).max(SRBAI_MAX);

const eventSchema = z.object({
  id,
  habitId: id,
  at: iso,
  approximate: z.boolean(),
  context: z.string().max(200).nullable(),
  precededBy: z.string().max(200).nullable(),
  effort,
  payoffNoticed: z.boolean().nullable(),
  payoffNote: z.string().max(200).nullable(),
});

/**
 * One change to the log, made in the browser and synced later. The browser picks the ID and the
 * time, so a change made offline keeps its real time and sending it twice adds nothing.
 */
export const opSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("habit"), habit: planSchema.extend({ id, createdAt: iso }) }),
  z.object({ kind: z.literal("plan"), id, at: iso, plan: planSchema }),
  z.object({ kind: z.literal("archive"), id, at: iso }),
  z.object({ kind: z.literal("event"), event: eventSchema }),
  z.object({ kind: z.literal("retract"), retraction: z.object({ id, eventId: id, at: iso }) }),
  z.object({ kind: z.literal("checkIn"), checkIn: z.object({ id, habitId: id, at: iso, items: z.tuple([item, item, item, item]) }) }),
]);
export type Op = z.infer<typeof opSchema>;

/** A local day as YYYY-MM-DD, the form a route keeps a day in its address. */
export const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
