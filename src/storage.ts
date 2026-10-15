import { Frequency, FREQUENCIES } from "./dates";

export interface Habit {
  id: string;
  name: string;
  frequency: Frequency;
  createdAt: string;
  /** Completed periods, keyed by the YYYY-MM-DD of each period's first day. */
  done: string[];
}

const KEY = "habit-tracker:v1";

export function loadHabits(): Habit[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    // Habits saved before frequencies existed are daily habits.
    return parsed.map((h) => ({
      ...h,
      frequency: FREQUENCIES.includes(h.frequency) ? h.frequency : "daily",
    }));
  } catch {
    return [];
  }
}

export function saveHabits(habits: Habit[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(habits));
  } catch {
    /* storage unavailable; keep in memory only */
  }
}
