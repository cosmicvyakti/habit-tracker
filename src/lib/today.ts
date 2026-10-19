import { donePeriods } from "./consistency";
import { addDays, periodKey, periodStart } from "./dates";
import { activeEvents, Habit, HabitEvent, Log } from "./model";

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
  return Math.round((((angle / (2 * Math.PI)) * DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES);
}

export interface TodayHabit {
  habit: Habit;
  events: HabitEvent[];
  /** Logged in the current day, week, month or year. */
  doneNow: boolean;
  /** The last log made today, if any. */
  loggedAt: Date | null;
  usual: number | null;
}

export interface TodayPlan {
  /** The one habit to do next, shown first with the view's primary action. */
  next: TodayHabit | null;
  /** Daily habits still open today, in their usual order. */
  todo: TodayHabit[];
  /** Everything logged today. */
  done: TodayHabit[];
  /** Weekly, monthly and yearly habits not logged today: still open this period, or already done. */
  later: TodayHabit[];
}

/**
 * Sorts Today by what needs the person now. Next is the open daily habit usually done earliest in the day; habits
 * with no recorded time yet come after, in the order they were made. With every daily habit done, next is the first
 * open weekly, monthly or yearly habit.
 */
export function planToday(log: Log, today: Date): TodayPlan {
  const items: TodayHabit[] = log.habits
    .filter((h) => !h.archivedAt)
    .map((habit) => {
      const events = activeEvents(log, habit.id);
      const todayKey = periodKey(today, "daily");
      const todays = events.filter((e) => periodKey(new Date(e.at), "daily") === todayKey);
      return {
        habit,
        events,
        doneNow: donePeriods(events, habit.frequency).has(periodKey(today, habit.frequency)),
        loggedAt: todays.length ? new Date(todays[todays.length - 1].at) : null,
        usual: usualMinute(events, today),
      };
    });
  const byUsual = (a: TodayHabit, b: TodayHabit) => (a.usual ?? DAY_MINUTES) - (b.usual ?? DAY_MINUTES);

  const done = items.filter((i) => i.loggedAt).sort((a, b) => a.loggedAt!.getTime() - b.loggedAt!.getTime());
  const todo = items.filter((i) => i.habit.frequency === "daily" && !i.doneNow).sort(byUsual);
  const later = items.filter((i) => i.habit.frequency !== "daily" && !i.loggedAt);
  const next = todo.shift() ?? later.find((i) => !i.doneNow) ?? null;
  return { next, todo, done, later: later.filter((i) => i !== next) };
}
