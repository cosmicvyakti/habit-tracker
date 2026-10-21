import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CSSProperties, useLayoutEffect, useRef, useState } from "react";
import { z } from "zod";
import { ChevronLeft, ChevronRight, Icon } from "@/components/lime/icon";
import { Button } from "@/components/lime/ui/button";
import { Empty, EmptyActions, EmptyDescription, EmptyTitle } from "@/components/lime/ui/empty";
import { Segmented, SegmentedItem } from "@/components/lime/ui/segmented";
import { cn } from "@/lib/lime/utils";
import { Card, CardFoot, CardTitle } from "../components/Card";
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
    <div className="flex flex-col gap-5">
      <PageHeader title="Stats" />

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
          {/* The range heads every card below it, as Spendly's Cash flow heads its cards: the range with a step either
              side, and the pill that picks how long it is, hugging its words rather than stretched like a form field. */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <div className="-ms-2 flex min-w-0 items-center gap-1">
              <Button variant="ghost" size="icon-sm" aria-label={`Previous ${range}`} onClick={() => go(shiftSpan(from, range, -1))}>
                <Icon icon={ChevronLeft} size={16} />
              </Button>
              <p aria-live="polite" className="min-w-0 truncate text-lg leading-tight font-semibold tabular-nums">
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
            <Segmented
              aria-label="Range"
              value={range}
              onValueChange={(v) => navigate({ search: (s) => ({ ...s, range: v as Span }), replace: true })}
            >
              {SPANS.map((s) => (
                <SegmentedItem key={s} value={s}>
                  {SPAN_LABEL[s]}
                </SegmentedItem>
              ))}
            </Segmented>
          </div>
          {/* Spendly's Overview grid: past 56rem of room the lead card and what follows it take three fifths, and the
              two small breakdowns stand in the two fifths beside them. Narrower, every card takes the full width. */}
          <div className="@container">
            <div className="grid gap-5 @4xl:grid-cols-5 @4xl:items-start">
              <div className="flex min-w-0 flex-col gap-5 @4xl:col-span-3">
                <Completion stats={stats} span={range} today={today} />
                {range !== "week" && <Calendar stats={stats} span={range} />}
                <Habits stats={stats} span={range} current={current} />
              </div>
              <div className="grid gap-5 @2xl:grid-cols-2 @4xl:col-span-2 @4xl:grid-cols-1">
                <Weekdays weekdays={stats.weekdays} />
                <Times times={stats.times} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
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

/**
 * The card the page leads with, as Spendly's spending card: the share of planned check-ins done as the figure, a line
 * under it, then the rate over the range as bars, one per day, week or month, and two facts at the foot. Pointing at a
 * bar steps the others back and reads it out in the line, in place; a screen reader gets the same figures as a list.
 */
function Completion({ stats, span, today }: { stats: SpanStats; span: Span; today: Date }) {
  const [hover, setHover] = useState<number | null>(null);
  const r = rate(stats.total);
  const change = delta(stats.total, stats.previous, span);
  const summary =
    r === null
      ? `Nothing was planned this ${span}.`
      : `${stats.total.done} of ${stats.total.planned} planned check-ins done.${change ? ` ${change}.` : ""}`;
  const read = (b: SpanStats["bars"][number]) =>
    b.start > today ? "Not yet" : b.tally.planned ? `${pct(rate(b.tally))}, ${b.tally.done} of ${b.tally.planned} done` : "Nothing planned";
  const shown = hover === null ? null : stats.bars[hover];
  return (
    <Card labelledBy="completion">
      <CardTitle id="completion" title="Completion" />
      <p className="text-xl font-semibold tracking-tight tabular-nums">{pct(r)}</p>
      <p aria-hidden="true" className="min-h-6 text-fg-3 tabular-nums">
        {shown ? `${barName[span](shown.start)}: ${read(shown)}` : summary}
      </p>
      <p className="sr-only">{summary}</p>
      {/* With nothing planned in the range there is nothing to draw: the line above says so. Keyed by the range, so a
          new one draws in again. */}
      {r !== null && (
        <div key={`${span}-${toKey(stats.from)}`} aria-hidden="true" className="draw-in mbs-5 flex flex-col gap-2">
          <div className="linked flex h-40 items-end gap-0.5 border-be border-line" onPointerLeave={() => setHover(null)}>
            {stats.bars.map((b, i) => {
              const br = rate(b.tally);
              return (
                <div
                  key={toKey(b.start)}
                  onPointerEnter={() => setHover(i)}
                  className="flex h-full min-w-0 flex-1 items-end justify-center"
                >
                  {br !== null && b.start <= today && (
                    // Thin marks: a bar never grows past 40px, however few share the row.
                    <div
                      className="h-(--pct) min-h-0.5 w-full max-w-10 rounded-ss-sm rounded-se-sm bg-series-1"
                      style={{ "--pct": `${br * 100}%` } as CSSProperties}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-0.5">
            {stats.bars.map((b, i) => (
              <span key={toKey(b.start)} className="min-w-0 flex-1 overflow-visible text-center text-xs whitespace-nowrap text-fg-3">
                {tick[span](b.start, i)}
              </span>
            ))}
          </div>
        </div>
      )}
      <ul className="sr-only">
        {stats.bars.map((b) => (
          <li key={toKey(b.start)}>
            {barName[span](b.start)}: {read(b)}
          </li>
        ))}
      </ul>
      <CardFoot>
        <span className="tabular-nums">
          {count(stats.checkIns, "check-in")} · {count(stats.perfectDays, "perfect day")}
        </span>
        <span className="sr-only">, days when every daily habit was done</span>
      </CardFoot>
    </Card>
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
    <Card labelledBy="calendar">
      <CardTitle id="calendar" title="Daily habits" />
      <div className="-mbs-2 flex flex-col gap-3">
        <p className="min-h-6 text-fg-3 tabular-nums" aria-hidden="true">
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
        {/* A quarter or a year can run wider than its card, so it scrolls, and a keyboard can reach it to scroll it. */}
        <div
          ref={scroller}
          tabIndex={month ? undefined : 0}
          className={cn(!month && "overflow-x-auto")}
          onPointerLeave={() => setHover(null)}
        >
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
                {/* The two darker steps take the light figure, so it stays readable on the ink. */}
                {month && <span className={cn((d.level === 2 || d.level === 3) && "text-fg-inverse")}>{d.day.getDate()}</span>}
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
    </Card>
  );
}

// A habit's standing, as Spendly's budgets wear theirs: in the figure and the meter's fill, and nothing said when it is
// fine. Each tone also has its words under the figure, so it is never colour alone.
const TONE = {
  fine: { text: "text-fg", fill: "bg-fg-3", word: "text-fg-3" },
  "missed-once": { text: "text-warn-text", fill: "bg-warn", word: "text-warn-text" },
  "missed-twice": { text: "text-danger-text", fill: "bg-danger/45", word: "text-danger-text" },
};

/**
 * Each habit planned in the range, as Spendly's budget rows: its name, how many periods and its best run, its rate as a
 * meter, then the rate as a figure over where it stands now. Pointing at a row steps the others back.
 */
function Habits({ stats, span, current }: { stats: SpanStats; span: Span; current: boolean }) {
  return (
    <Card labelledBy="by-habit">
      <CardTitle id="by-habit" title="By habit" />
      {stats.habits.length === 0 ? (
        <p className="text-fg-2">No habit was planned this {span}.</p>
      ) : (
        <ul className="card-rows linked -mbs-2">
          {stats.habits.map(({ habit: h, tally, state, longest }) => {
            const r = rate(tally);
            const standing = !h.archivedAt && current && (state === "missed-once" || state === "missed-twice") ? state : "fine";
            const tone = TONE[standing];
            const word = h.archivedAt
              ? "Archived"
              : r === null
                ? "Not due"
                : current && state !== "on-track"
                  ? MISS_BADGE[state].label
                  : null;
            return (
              <li key={h.id} className="flex min-h-11 items-center gap-x-3 py-2">
                {/* The name wraps rather than lose the part it was chosen for; the meters and figures keep one width on
                    every row, so they line up down the list. */}
                <div className="min-w-0 flex-1">
                  <p className="font-medium wrap-break-word text-fg">{title(h.behavior)}</p>
                  <p className="text-xs text-fg-3 tabular-nums">
                    {FREQUENCY_LABEL[h.frequency]}
                    {tally.planned > 0 && ` · ${tally.done} of ${count(tally.planned, UNIT[h.frequency])}`}
                    {longest > 0 && ` · longest run ${count(longest, UNIT[h.frequency])}`}
                  </p>
                </div>
                <div aria-hidden="true" className="h-2.5 w-32 shrink-0 overflow-clip rounded-full bg-line phone:w-16">
                  <div
                    className={cn("h-full w-(--pct) rounded-full", tone.fill)}
                    style={{ "--pct": `${(r ?? 0) * 100}%` } as CSSProperties}
                  />
                </div>
                <div className="flex w-24 shrink-0 flex-col items-end">
                  {r !== null && <p className={cn("text-xl font-semibold tracking-tight tabular-nums", tone.text)}>{pct(r)}</p>}
                  {word && <p className={cn("text-xs whitespace-nowrap", tone.word)}>{word}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** Rows of meters, for the two small breakdowns. Pointing at a row steps the others back. */
function Meters({ id, heading, rows }: { id: string; heading: string; rows: { label: string; value: number; text: string }[] }) {
  return (
    <Card labelledBy={id}>
      <CardTitle id={id} title={heading} />
      <ul className="linked -mbs-1 flex flex-col">
        {rows.map((row) => (
          <li key={row.label} className="flex min-h-9 items-center gap-3">
            <span className="w-24 shrink-0 text-fg-2">{row.label}</span>
            <span aria-hidden="true" className="h-2.5 flex-1 overflow-clip rounded-full bg-line">
              <span className="block h-full w-(--pct) rounded-full bg-fg-3" style={{ "--pct": `${row.value * 100}%` } as CSSProperties} />
            </span>
            <span className="w-24 shrink-0 text-end text-fg tabular-nums">{row.text}</span>
          </li>
        ))}
      </ul>
    </Card>
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
