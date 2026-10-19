import type { Frequency } from "./dates";

/**
 * A habit, modelled as Wood's context, cue, behavior and consequence loop.
 * The plan reads as an implementation intention: "After [cue], I will [behavior] at [context]".
 * The plan is the only mutable record. Everything the user does goes into the append-only log.
 */
export interface Habit {
  id: string;
  /** How often the user plans to do it. The app's own choice of period, not from a paper; consistency counts these periods. */
  frequency: Frequency;
  /** When the habit was defined (ISO). Day 0 of the automaticity curve. Source: Lally et al. 2010. */
  createdAt: string;
  /** Context: the place where the behavior happens. Habits are context-response associations. Source: Wood & Neal 2007. */
  context: string;
  /** Cue: the event that triggers the behavior, the "if" part of the plan. Source: Gollwitzer 1999. */
  cue: string;
  /** Behavior: what the user does, the "then" part of the plan. Source: Gollwitzer 1999. */
  behavior: string;
  /** Consequence: the payoff the user expects. Behavior followed by reinforcement recurs. Source: Skinner 1938. */
  consequence: string;
  /** Archived habits are hidden. Their log stays. */
  archivedAt: string | null;
}

/** One performance of a habit. Never updated or deleted; a mistaken entry gets a Retraction. */
export interface HabitEvent {
  id: string;
  habitId: string;
  /** When the behavior happened (ISO). Repetition over time is what builds automaticity. Source: Lally et al. 2010. */
  at: string;
  /** True when `at` is a reconstruction (backfilled), not a recorded moment. */
  approximate: boolean;
  /** Context: where it happened. Stable contexts carry habits. Source: Wood & Neal 2007. */
  context: string | null;
  /** The cue that preceded the behavior. Cues trigger habitual responses. Source: Wood & Neal 2007. */
  precededBy: string | null;
  /**
   * Felt effort, 1 (none) to 5 (a lot). A proxy for automaticity between check-ins, not a measure
   * from the paper: automaticity rises with repetition, so effort should fall. Source: Lally et al. 2010.
   */
  effort: 1 | 2 | 3 | 4 | 5 | null;
  /** Whether the user noticed the payoff this time. Reinforcement follows the response. Source: Skinner 1938. */
  payoffNoticed: boolean | null;
  /** Optional note on the payoff. Source: Skinner 1938. */
  payoffNote: string | null;
}

/** Withdraws one HabitEvent, for example after a mis-tap. Append-only, like the events. */
export interface Retraction {
  id: string;
  eventId: string;
  at: string;
}

/** One SRBAI check-in: the four automaticity items, each 1 to 7. Source: Gardner et al. 2012. */
export interface CheckIn {
  id: string;
  habitId: string;
  at: string;
  items: [number, number, number, number];
}

export interface Log {
  habits: Habit[];
  events: HabitEvent[];
  retractions: Retraction[];
  checkIns: CheckIn[];
}

/** Events that have not been retracted, oldest first. */
export function activeEvents(log: Pick<Log, "events" | "retractions">, habitId?: string): HabitEvent[] {
  const retracted = new Set(log.retractions.map((r) => r.eventId));
  return log.events
    .filter((e) => !retracted.has(e.id) && (habitId === undefined || e.habitId === habitId))
    .sort((a, b) => a.at.localeCompare(b.at));
}

/** The earlier of the habit's creation and its first event. Migrated data can predate creation. */
export function habitStart(habit: Habit, events: HabitEvent[]): Date {
  const first = events.reduce((min, e) => (e.at < min ? e.at : min), habit.createdAt);
  return new Date(first);
}
