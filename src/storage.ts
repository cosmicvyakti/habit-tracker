export interface Habit {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  /** Completed days as YYYY-MM-DD keys. */
  done: string[];
}

const KEY = "habit-tracker:v1";

export function loadHabits(): Habit[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
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
