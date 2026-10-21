import { countFrom, donePeriods, MissState, periodStats } from "./consistency";
import { addDays, Frequency, longestStreak, periodStart, shiftPeriod, toKey } from "./dates";
import { activeEvents, Habit, habitStart, Log } from "./model";

/** The stretch of time Stats reads. A quarter is a range only, never a habit's frequency. */
export type Span = "week" | "month" | "quarter" | "year";
export const SPANS: Span[] = ["week", "month", "quarter", "year"];

/** First day of the week (Monday), month, quarter or year that holds `d`. */
export function spanStart(d: Date, span: Span): Date {
  if (span === "quarter") return new Date(d.getFullYear(), d.getMonth() - (d.getMonth() % 3), 1);
  return periodStart(d, span === "week" ? "weekly" : span === "month" ? "monthly" : "yearly");
}

/** Start of the span `n` spans after the one starting at `start`. */
export function shiftSpan(start: Date, span: Span, n: number): Date {
  if (span === "week") return addDays(start, 7 * n);
  if (span === "year") return new Date(start.getFullYear() + n, 0, 1);
  return new Date(start.getFullYear(), start.getMonth() + n * (span === "quarter" ? 3 : 1), 1);
}

/** The last day of the span starting at `start`. */
export const spanEnd = (start: Date, span: Span) => addDays(shiftSpan(start, span, 1), -1);

/** The chart's bars: a day each for a week or a month, a week each for a quarter, a month each for a year. */
const BUCKET: Record<Span, "daily" | "weekly" | "monthly"> = { week: "daily", month: "daily", quarter: "weekly", year: "monthly" };
/** The habits a span or a bar counts: those whose period fits in it. A yearly habit says nothing about one week. */
const FITS: Record<Frequency, Frequency[]> = {
  daily: ["daily"],
  weekly: ["daily", "weekly"],
  monthly: ["daily", "weekly", "monthly"],
  yearly: ["daily", "weekly", "monthly", "yearly"],
};
const SPAN_FITS: Record<Span, Frequency[]> = { week: FITS.weekly, month: FITS.monthly, quarter: FITS.monthly, year: FITS.yearly };

/** Periods done, out of periods planned that have ended (or are done early). */
export interface Tally {
  done: number;
  planned: number;
}
export const rate = (t: Tally) => (t.planned ? t.done / t.planned : null);

interface Tracked {
  habit: Habit;
  done: Set<string>;
  /** The first period that counts (consistency.ts's countFrom). */
  from: Date;
  /** The day it was archived, after which nothing is planned. */
  until: Date | null;
}

function track(log: Log): Tracked[] {
  return log.habits.map((habit) => {
    const events = activeEvents(log, habit.id);
    const done = donePeriods(events, habit.frequency);
    return {
      habit,
      done,
      from: countFrom(habitStart(habit, events), done, habit.frequency),
      until: habit.archivedAt ? periodStart(new Date(habit.archivedAt), "daily") : null,
    };
  });
}

function tallyOne(t: Tracked, from: Date, to: Date, today: Date) {
  const start = from > t.from ? from : t.from;
  const end = t.until && t.until < to ? t.until : to;
  return start > end ? null : periodStats(t.done, t.habit.frequency, start, end, today);
}

function tally(tracked: Tracked[], freqs: Frequency[], from: Date, to: Date, today: Date): Tally {
  const sum = { done: 0, planned: 0 };
  for (const t of tracked) {
    if (!freqs.includes(t.habit.frequency)) continue;
    const s = tallyOne(t, from, to, today);
    if (s) {
      sum.done += s.done;
      sum.planned += s.elapsed;
    }
  }
  return sum;
}

/** How much of a day's daily plan was done, as one of four steps; "none" for a day with nothing planned or logged. */
export type Level = 0 | 1 | 2 | 3 | "none";
const level = (t: Tally, logged: boolean): Level => {
  if (!t.planned) return logged ? 3 : "none";
  const r = t.done / t.planned;
  return r === 0 ? 0 : r < 0.5 ? 1 : r < 1 ? 2 : 3;
};

/** Morning 5-12, afternoon 12-17, evening 17-21, night 21-5, by the hour a check-in was made. */
export const TIMES = ["Morning", "Afternoon", "Evening", "Night"] as const;
const timeOf = (hour: number) => (hour >= 5 && hour < 12 ? 0 : hour >= 12 && hour < 17 ? 1 : hour >= 17 && hour < 21 ? 2 : 3);

export interface HabitRow {
  habit: Habit;
  tally: Tally;
  /** Where it stands now; only read when the span reaches today. */
  state: MissState;
  /** The longest run of done periods inside the span. */
  longest: number;
}

export interface SpanStats {
  from: Date;
  to: Date;
  total: Tally;
  /** The span before, for the comparison under the lead figure. */
  previous: Tally;
  bars: { start: Date; end: Date; tally: Tally }[];
  days: { day: Date; tally: Tally; level: Level }[];
  /** Days when every daily habit was done. */
  perfectDays: number;
  /** Logs made in the span, of any habit, archived ones included. */
  checkIns: number;
  habits: HabitRow[];
  /** Daily habits by weekday, Monday first. */
  weekdays: Tally[];
  /** Recorded check-ins by time of day, in TIMES order. Backfills are left out: their time was made up. */
  times: number[];
}

export function spanStats(log: Log, span: Span, start: Date, today: Date): SpanStats {
  const tracked = track(log);
  const from = spanStart(start, span);
  const to = spanEnd(from, span);
  const fits = SPAN_FITS[span];
  const lastDay = to < today ? to : periodStart(today, "daily");

  const unit = BUCKET[span];
  const bars = [];
  // A quarter's first week can start before the quarter does; each bar counts only the days inside the span.
  for (let b = periodStart(from, unit); b <= to; b = shiftPeriod(b, unit, 1)) {
    const end = addDays(shiftPeriod(b, unit, 1), -1);
    bars.push({ start: b, end, tally: tally(tracked, FITS[unit], b < from ? from : b, end > to ? to : end, today) });
  }

  const events = activeEvents(log).filter((e) => {
    const at = new Date(e.at);
    return at >= from && at < addDays(to, 1);
  });
  const loggedDays = new Set(events.map((e) => toKey(new Date(e.at))));
  const days = [];
  const weekdays = Array.from({ length: 7 }, () => ({ done: 0, planned: 0 }));
  let perfectDays = 0;
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const t = tally(tracked, ["daily"], day, day, today);
    days.push({ day, tally: t, level: day > lastDay ? ("none" as const) : level(t, loggedDays.has(toKey(day))) });
    const w = weekdays[(day.getDay() + 6) % 7];
    w.done += t.done;
    w.planned += t.planned;
    if (t.planned && t.done === t.planned) perfectDays++;
  }

  const times = [0, 0, 0, 0];
  for (const e of events) if (!e.approximate) times[timeOf(new Date(e.at).getHours())]++;

  const habits: HabitRow[] = [];
  for (const t of tracked) {
    if (!fits.includes(t.habit.frequency)) continue;
    const s = tallyOne(t, from, to, today);
    // An archived habit stays in the span it was planned in, and leaves the ones after.
    if (!s || (t.habit.archivedAt && !s.elapsed && !s.done)) continue;
    const inSpan = new Set([...t.done].filter((k) => k >= toKey(periodStart(from, t.habit.frequency)) && k <= toKey(to)));
    habits.push({
      habit: t.habit,
      tally: { done: s.done, planned: s.elapsed },
      state: s.state,
      longest: longestStreak(inSpan, t.habit.frequency),
    });
  }

  const previousFrom = shiftSpan(from, span, -1);
  return {
    from,
    to,
    total: tally(tracked, fits, from, to, today),
    previous: tally(tracked, fits, previousFrom, spanEnd(previousFrom, span), today),
    bars,
    days,
    perfectDays,
    checkIns: events.length,
    habits,
    weekdays,
    times,
  };
}
