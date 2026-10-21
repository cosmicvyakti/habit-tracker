import { donePeriods } from "./consistency";
import { addDays, FREQUENCIES, periodKey, periodStart } from "./dates";
import { activeEvents, Habit, HabitEvent, habitStart, Log } from "./model";

const DAY_MINUTES = 24 * 60;
const RECENT_DAYS = 60;

/**
 * The habit's usual time of day, in minutes after midnight local time: the circular mean of its recorded logs over the
 * last 60 days, so 23:30 and 00:30 average to midnight. Approximate (backfilled) logs are left out, their times were
 * reconstructed. Null without a recorded log.
 */
export function usualMinute(events: HabitEvent[], today: Date): number | null {
  const since = addDays(periodStart(today, "daily"), -RECENT_DAYS);
  let sin = 0;
  let cos = 0;
  let n = 0;
  for (const e of events) {
    const d = new Date(e.at);
    if (e.approximate || d < since) continue;
    const angle = ((d.getHours() * 60 + d.getMinutes()) / DAY_MINUTES) * 2 * Math.PI;
    sin += Math.sin(angle);
    cos += Math.cos(angle);
    n++;
  }
  if (!n) return null;
  const angle = Math.atan2(sin, cos);
  return Math.round(((angle / (2 * Math.PI)) * DAY_MINUTES + DAY_MINUTES) % DAY_MINUTES);
}

export interface DayHabit {
  habit: Habit;
  events: HabitEvent[];
  /** Logged in the day, week, month or year that holds the day. */
  done: boolean;
  /** The last recorded log on the day itself, if any. */
  loggedAt: Date | null;
  usual: number | null;
}

/**
 * One day's habits, split into what is still to do and what is done. A habit counts from the period it started in, so a
 * day before it existed doesn't list it. To do runs daily habits first, each by its usual time of day (habits with no
 * recorded time last), then weekly, monthly and yearly. Done runs in the order the habits were logged.
 */
export function planDay(log: Log, day: Date, today: Date): { todo: DayHabit[]; done: DayHabit[] } {
  const dayKey = periodKey(day, "daily");
  const items: DayHabit[] = log.habits
    .filter((h) => !h.archivedAt)
    .map((habit) => ({ habit, events: activeEvents(log, habit.id) }))
    .filter(({ habit, events }) => periodKey(day, habit.frequency) >= periodKey(habitStart(habit, events), habit.frequency))
    .map(({ habit, events }) => {
      const todays = events.filter((e) => !e.approximate && periodKey(new Date(e.at), "daily") === dayKey);
      return {
        habit,
        events,
        done: donePeriods(events, habit.frequency).has(periodKey(day, habit.frequency)),
        loggedAt: todays.length ? new Date(todays[todays.length - 1].at) : null,
        usual: usualMinute(events, today),
      };
    });
  const rank = (i: DayHabit) => FREQUENCIES.indexOf(i.habit.frequency) * DAY_MINUTES + (i.usual ?? DAY_MINUTES - 1);
  // A log with no time on the day (a backfill, or one on another day of the period) sorts after the timed ones.
  const at = (i: DayHabit) => i.loggedAt?.getTime() ?? Infinity;
  return {
    todo: items.filter((i) => !i.done).sort((a, b) => rank(a) - rank(b)),
    done: items.filter((i) => i.done).sort((a, b) => at(a) - at(b) || 0),
  };
}
