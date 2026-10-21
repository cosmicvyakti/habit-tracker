import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CSSProperties, useLayoutEffect, useRef, useState } from "react";
import { z } from "zod";
import { ChevronLeft, ChevronRight, Icon } from "@/components/lime/icon";
import { Badge } from "@/components/lime/ui/badge";
import { Button } from "@/components/lime/ui/button";
import { Empty, EmptyActions, EmptyDescription, EmptyTitle } from "@/components/lime/ui/empty";
import { Segmented, SegmentedItem } from "@/components/lime/ui/segmented";
import { cn } from "@/lib/lime/utils";
import { count, MISS_BADGE, pct, title, UNIT } from "../components/habit";
import PageHeader from "../components/PageHeader";
import { logQuery, useLog, useToday } from "../data";
import { FREQUENCY_LABEL, fromKey, toKey } from "../lib/dates";
import { dateKey } from "../lib/schema";
import { Level, rate, shiftSpan, Span, spanEnd, spanStart, spanStats, SpanStats, SPANS, Tally, TIMES } from "../lib/stats";

export const Route = createFileRoute("/stats")({
  head: () => ({ meta: [{ title: "Stats · Habit tracker" }] }),
  // `range` is the stretch of time; `at` is any day in the one shown, absent for the one that holds today.
  validateSearch: z.object({ range: z.enum(SPANS).catch("week").default("week"), at: dateKey.optional().catch(undefined) }),
  loader: ({ context }) => context.queryClient.ensureQueryData(logQuery),
  component: Stats,
});

const SPAN_LABEL: Record<Span, string> = { week: "Week", month: "Month", quarter: "Quarter", year: "Year" };
const LEVELS: Level[] = [0, 1, 2, 3];
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function rangeLabel(from: Date, span: Span) {
  if (span === "week")
    return new Intl.DateTimeFormat([], { month: "short", day: "numeric", year: "numeric" }).formatRange(from, spanEnd(from, span));
  if (span === "month") return from.toLocaleDateString([], { month: "long", year: "numeric" });
  if (span === "quarter") return `Q${from.getMonth() / 3 + 1} ${from.getFullYear()}`;
  return String(from.getFullYear());
}

/** Up or down from the span before, in percentage points: a comparison, not a verdict, so it stays in plain ink. */
function delta(now: Tally, before: Tally, span: Span) {
  const a = rate(now);
  const b = rate(before);
  if (a === null || b === null) return null;
  const points = Math.round((a - b) * 100);
  const then = `the ${span} before`;
  return points === 0 ? `Same as ${then}` : `${points > 0 ? "Up" : "Down"} ${count(Math.abs(points), "point")} from ${then}`;
}

/**
 * How the habits went over a week, month, quarter or year, after what habit apps lead with: one completion rate with
 * its change (Habitify), a chart of it over the range, a calendar heat map (HabitKit, Loop), each habit's rate and best
 * run (Streaks), and which weekdays and times of day work.
 */
function Stats() {
  const log = useLog();
  const today = fromKey(useToday());
  const { range, at } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const from = spanStart(at ? fromKey(at) : today, range);
  const current = spanStart(today, range).getTime() === from.getTime();
  const stats = spanStats(log, range, from, today);
  const go = (start: Date) =>
    navigate({
      search: (s) => ({ ...s, at: spanStart(start, range) >= spanStart(today, range) ? undefined : toKey(start) }),
      replace: true,
    });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Stats"
        aside={
          <Segmented
            aria-label="Range"
            value={range}
            onValueChange={(v) => navigate({ search: (s) => ({ ...s, range: v as Span }), replace: true })}
            className="phone:w-full phone:*:flex-1"
          >
            {SPANS.map((s) => (
              <SegmentedItem key={s} value={s}>
                {SPAN_LABEL[s]}
              </SegmentedItem>
            ))}
          </Segmented>
        }
        below={
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label={`Previous ${range}`} onClick={() => go(shiftSpan(from, range, -1))}>
              <Icon icon={ChevronLeft} size={16} />
            </Button>
            <p aria-live="polite" className="min-w-0 truncate text-base font-semibold tabular-nums">
              {rangeLabel(from, range)}
            </p>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Next ${range}`}
              disabled={current}
              onClick={() => go(shiftSpan(from, range, 1))}
            >
              <Icon icon={ChevronRight} size={16} />
            </Button>
          </div>
        }
      />

      {log.habits.length === 0 ? (
        <Empty>
          <EmptyTitle aria-level={2}>Nothing to count yet</EmptyTitle>
          <EmptyDescription>Stats fill in as you check habits off on Today.</EmptyDescription>
          <EmptyActions>
            <Button nativeButton={false} role="link" render={<Link to="/habits" search={{ new: true }} />}>
              Add habit
            </Button>
          </EmptyActions>
        </Empty>
      ) : (
        <>
          <Lead stats={stats} span={range} />
          <Chart stats={stats} span={range} today={today} />
          {range !== "week" && <Calendar stats={stats} span={range} />}
          <Habits stats={stats} span={range} current={current} />
          <div className="@container">
            <div className="grid gap-8 @2xl:grid-cols-2">
              <Weekdays weekdays={stats.weekdays} />
              <Times times={stats.times} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** The figure the page leads with: the share of planned check-ins done, its change, and two facts beside it. */
function Lead({ stats, span }: { stats: SpanStats; span: Span }) {
  const r = rate(stats.total);
  const change = delta(stats.total, stats.previous, span);
  return (
    <section aria-labelledby="lead" className="flex flex-col gap-1">
      <h2 id="lead" className="text-lg font-semibold">
        Completion
      </h2>
      <p className="text-3xl font-semibold tracking-tight tabular-nums">{pct(r)}</p>
      <p className="text-base text-fg-2">
        {r === null ? `Nothing was planned this ${span}.` : `${stats.total.done} of ${stats.total.planned} planned check-ins done.`}
        {change && ` ${change}.`}
      </p>
      <p className="text-base text-fg-2 tabular-nums">
        {count(stats.checkIns, "check-in")} · {count(stats.perfectDays, "perfect day")}
        <span className="sr-only">, days when every daily habit was done</span>
      </p>
    </section>
  );
}

const barName: Record<Span, (d: Date) => string> = {
  week: (d) => d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" }),
  month: (d) => d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" }),
  quarter: (d) => `Week of ${d.toLocaleDateString([], { month: "short", day: "numeric" })}`,
  year: (d) => d.toLocaleDateString([], { month: "long", year: "numeric" }),
};
/** The axis under the bars: every day of a week, each Monday of a month, a quarter's months, a year's months. */
const tick: Record<Span, (d: Date, i: number) => string | null> = {
  week: (d) => d.toLocaleDateString([], { weekday: "short" }),
  month: (d) => (d.getDay() === 1 ? String(d.getDate()) : null),
  quarter: (d, i) => (i === 0 || d.getDate() <= 7 ? d.toLocaleDateString([], { month: "short" }) : null),
  year: (d) => d.toLocaleDateString([], { month: "narrow" }),
};
const BAR_UNIT: Record<Span, string> = { week: "day", month: "day", quarter: "week", year: "month" };

/**
 * The rate over the range as bars, one per day, week or month. Hovering a bar reads it out on the line above the bars,
 * in place; a screen reader gets the same figures as a list.
 */
function Chart({ stats, span, today }: { stats: SpanStats; span: Span; today: Date }) {
  const [hover, setHover] = useState<number | null>(null);
  // Until a bar is pointed at, the line reads the latest one with something planned.
  const latest = stats.bars.filter((b) => b.start <= today && b.tally.planned).pop();
  const shown = hover === null ? latest : stats.bars[hover];
  const read = (b: SpanStats["bars"][number]) =>
    b.start > today ? "Not yet" : b.tally.planned ? `${pct(rate(b.tally))}, ${b.tally.done} of ${b.tally.planned} done` : "Nothing planned";
  return (
    <section aria-labelledby="chart" className="flex flex-col gap-3">
      <h2 id="chart" className="text-lg font-semibold">
        By {BAR_UNIT[span]}
      </h2>
      <div className="flex flex-col gap-3 rounded-panel border border-line bg-card p-5 shadow-card">
        <p aria-hidden="true" className="min-h-5 text-sm text-fg-2 tabular-nums">
          {shown ? `${barName[span](shown.start)}: ${read(shown)}` : `Nothing planned this ${span}.`}
        </p>
        <div aria-hidden="true" className="flex h-40 items-end gap-0.5 border-be border-line" onPointerLeave={() => setHover(null)}>
          {stats.bars.map((b, i) => {
            const r = rate(b.tally);
            return (
              <div
                key={toKey(b.start)}
                onPointerEnter={() => setHover(i)}
                className={cn("flex h-full min-w-0 flex-1 items-end justify-center rounded-t-sm", hover === i && "bg-surface-2")}
              >
                {r !== null && b.start <= today && (
                  // Thin marks: a bar never grows past 40px, however few share the row.
                  <div
                    className="h-(--pct) min-h-0.5 w-full max-w-10 rounded-t-sm bg-series-1"
                    style={{ "--pct": `${r * 100}%` } as CSSProperties}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div aria-hidden="true" className="flex gap-0.5">
          {stats.bars.map((b, i) => (
            <span key={toKey(b.start)} className="min-w-0 flex-1 overflow-visible text-center text-xs whitespace-nowrap text-fg-3">
              {tick[span](b.start, i)}
            </span>
          ))}
        </div>
        <ul className="sr-only">
          {stats.bars.map((b) => (
            <li key={toKey(b.start)}>
              {barName[span](b.start)}: {read(b)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * Each day of the range as a cell, shaded by how much of its daily plan was done. A month is laid out as a calendar;
 * a quarter or a year as columns of weeks, Monday at the top, as a contribution graph is.
 */
function Calendar({ stats, span }: { stats: SpanStats; span: Span }) {
  const [hover, setHover] = useState<number | null>(null);
  const lead = (stats.from.getDay() + 6) % 7;
  const weeks = Math.ceil((lead + stats.days.length) / 7);
  const shown = hover === null ? null : stats.days[hover];
  const month = span === "month";
  // A year runs wider than a phone: it opens on its latest weeks, as a contribution graph does.
  const scroller = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth;
  }, [span, stats.from]);
  return (
    <section aria-labelledby="calendar" className="flex flex-col gap-3">
      <h2 id="calendar" className="text-lg font-semibold">
        Daily habits
      </h2>
      <div className="flex flex-col gap-3 rounded-panel border border-line bg-card p-5 shadow-card">
        <p className="min-h-5 text-sm text-fg-2 tabular-nums" aria-hidden="true">
          {shown
            ? `${shown.day.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}: ${shown.tally.planned ? `${shown.tally.done} of ${shown.tally.planned} done` : "nothing daily planned"}`
            : `${count(stats.perfectDays, "perfect day")} this ${span}.`}
        </p>
        {month && (
          <div aria-hidden="true" className="grid max-w-md grid-cols-7 gap-0.5 text-center text-xs text-fg-3">
            {WEEKDAYS.map((w) => (
              <span key={w}>{w.slice(0, 3)}</span>
            ))}
          </div>
        )}
        <div ref={scroller} className={cn(!month && "overflow-x-auto")} onPointerLeave={() => setHover(null)}>
          <div
            role="img"
            aria-label={`${count(stats.perfectDays, "day")} with every daily habit done this ${span}.`}
            className={cn("grid gap-0.5", month ? "max-w-md grid-cols-7" : "heat-weeks grid-flow-col grid-rows-7")}
            style={month ? undefined : ({ "--weeks": weeks } as CSSProperties)}
          >
            {/* The days before the first fall in the first week too: blanks keep the weekdays in their rows. */}
            {Array.from({ length: lead }, (_, i) => (
              <span key={`lead-${i}`} />
            ))}
            {stats.days.map((d, i) => (
              <span
                key={toKey(d.day)}
                data-level={d.level}
                onPointerEnter={() => setHover(i)}
                className={cn(
                  "heat aspect-square",
                  month && "rounded-sm",
                  month && "grid place-items-center text-xs text-fg-2 tabular-nums",
                  hover === i && "ring-2 ring-fg-3",
                )}
              >
                {month && <span className={cn(d.level === 3 && "text-on-accent")}>{d.day.getDate()}</span>}
              </span>
            ))}
          </div>
        </div>
        <div aria-hidden="true" className="flex items-center gap-1 text-xs text-fg-3">
          Less
          {LEVELS.map((l) => (
            <span key={l} data-level={l} className="heat size-3" />
          ))}
          More
        </div>
      </div>
    </section>
  );
}

/** Each habit planned in the range: its rate as a meter, how many periods, where it stands now, and its best run. */
function Habits({ stats, span, current }: { stats: SpanStats; span: Span; current: boolean }) {
  return (
    <section aria-labelledby="by-habit" className="flex flex-col gap-3">
      <h2 id="by-habit" className="text-lg font-semibold">
        By habit
      </h2>
      {stats.habits.length === 0 ? (
        <p className="text-base text-fg-2">No habit was planned this {span}.</p>
      ) : (
        <ul className="card-rows overflow-clip rounded-panel border border-line bg-card shadow-card">
          {stats.habits.map(({ habit: h, tally, state, longest }) => {
            const r = rate(tally);
            const badge = h.archivedAt ? { variant: "neutral" as const, label: "Archived" } : current ? MISS_BADGE[state] : null;
            return (
              <li key={h.id} className="flex flex-col gap-2 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-base font-medium">{title(h.behavior)}</span>
                  {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
                  <span className="shrink-0 text-end text-base font-semibold whitespace-nowrap tabular-nums">
                    {r === null ? "Not due" : pct(r)}
                  </span>
                </div>
                <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full w-(--pct) rounded-full bg-series-1" style={{ "--pct": `${(r ?? 0) * 100}%` } as CSSProperties} />
                </div>
                <p className="text-sm text-fg-3 tabular-nums">
                  {FREQUENCY_LABEL[h.frequency]} ·{" "}
                  {tally.planned ? `${tally.done} of ${count(tally.planned, UNIT[h.frequency])} done` : `nothing due yet this ${span}`}
                  {longest > 0 && ` · longest run ${count(longest, UNIT[h.frequency])}`}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Rows of meters, for the two small breakdowns. */
function Meters({ id, heading, rows }: { id: string; heading: string; rows: { label: string; value: number; text: string }[] }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-lg font-semibold">
        {heading}
      </h2>
      <ul className="flex flex-col gap-3 rounded-panel border border-line bg-card p-5 shadow-card">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-sm text-fg-2">{row.label}</span>
            <span aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
              <span
                className="block h-full w-(--pct) rounded-full bg-series-1"
                style={{ "--pct": `${row.value * 100}%` } as CSSProperties}
              />
            </span>
            <span className="w-24 shrink-0 text-end text-sm text-fg tabular-nums">{row.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Weekdays({ weekdays }: { weekdays: Tally[] }) {
  return (
    <Meters
      id="weekdays"
      heading="By weekday"
      rows={weekdays.map((t, i) => ({ label: WEEKDAYS[i], value: rate(t) ?? 0, text: pct(rate(t)) }))}
    />
  );
}

function Times({ times }: { times: number[] }) {
  const most = Math.max(1, ...times);
  return (
    <Meters
      id="times"
      heading="Time of day"
      rows={TIMES.map((label, i) => ({ label, value: times[i] / most, text: count(times[i], "check-in") }))}
    />
  );
}
