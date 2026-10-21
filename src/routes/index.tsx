import { Checkbox } from "@base-ui/react/checkbox";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { z } from "zod";
import { Checkmark, ChevronLeft, ChevronRight, Icon } from "@/components/lime/icon";
import { Button } from "@/components/lime/ui/button";
import { Empty, EmptyActions, EmptyDescription, EmptyTitle } from "@/components/lime/ui/empty";
import { cn } from "@/lib/lime/utils";
import { Card, CardTitle } from "../components/Card";
import { title, useCheckIns } from "../components/habit";
import PageHeader from "../components/PageHeader";
import { logQuery, useLog, useToday } from "../data";
import { addDays, Frequency, fromKey, periodStart, toKey } from "../lib/dates";
import { dateKey } from "../lib/schema";
import { spanStats } from "../lib/stats";
import { DayHabit, planDay } from "../lib/today";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Today · Habit tracker" }] }),
  // `?day` picks another day of the week strip; without it the page shows today.
  validateSearch: z.object({ day: dateKey.optional().catch(undefined) }),
  loader: ({ context }) => context.queryClient.ensureQueryData(logQuery),
  component: Today,
});

/** How long a checked row stays where it was, its check drawn, before it moves down to Completed. */
const SETTLE_MS = 600;
const ONCE: Record<Frequency, string> = { daily: "Daily", weekly: "Once a week", monthly: "Once a month", yearly: "Once a year" };
const THIS: Record<Frequency, string> = { daily: "today", weekly: "this week", monthly: "this month", yearly: "this year" };
const clock = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const minuteClock = (m: number) => clock(new Date(2000, 0, 1, Math.floor(m / 60), m % 60));

function Today() {
  const log = useLog();
  const todayKey = useToday();
  const today = fromKey(todayKey);
  const search = Route.useSearch();
  // A day after today has nothing to check yet, so it falls back to today.
  const dayKey = search.day && search.day < todayKey ? search.day : todayKey;
  const day = fromKey(dayKey);
  const isToday = dayKey === todayKey;
  const plan = planDay(log, day, today);
  const { toggle } = useCheckIns();

  // Rows just checked, held in To do at the place they were checked in until they settle.
  const [settling, setSettling] = useState<Map<string, number>>(new Map());
  const [said, setSaid] = useState("");
  const timers = useRef(new Map<string, number>());
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    // A new day starts with nothing settling.
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    setSettling(new Map());
  }, [dayKey]);

  const held = [...settling].map(([id, at]) => ({ at, item: plan.done.find((i) => i.habit.id === id) })).filter((h) => h.item);
  const todo = [...plan.todo];
  for (const { at, item } of held.sort((a, b) => a.at - b.at)) todo.splice(at, 0, item!);
  const done = plan.done.filter((i) => !settling.has(i.habit.id));

  function check(item: DayHabit, index: number) {
    const id = item.habit.id;
    toggle(item.habit, item.events, day);
    setSaid(`Checked off ${item.habit.behavior}.`);
    setSettling((s) => new Map(s).set(id, index));
    timers.current.set(
      id,
      window.setTimeout(() => {
        timers.current.delete(id);
        const hadFocus = document.activeElement === row(id);
        moveRows(
          () => setSettling((s) => (s.delete(id), new Map(s))),
          () => {
            if (!hadFocus) return;
            // Focus stays in To do, on the row that took this one's place, so a keyboard can check the next one.
            const left = document.querySelectorAll<HTMLElement>('[data-list="todo"] [data-habit]');
            (left[index] ?? left[left.length - 1] ?? row(id))?.focus({ preventScroll: true });
          },
        );
      }, SETTLE_MS),
    );
  }

  function uncheck(item: DayHabit) {
    const hadFocus = document.activeElement === row(item.habit.id);
    moveRows(
      () => toggle(item.habit, item.events, day),
      () => hadFocus && row(item.habit.id)?.focus({ preventScroll: true }),
    );
  }

  const active = log.habits.some((h) => !h.archivedAt);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={dayTitle(day, today)}
        aside={
          !isToday && (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              role="link"
              render={<Link to="/" search={{}} replace />}
              className="self-start"
            >
              Go to today
            </Button>
          )
        }
      />
      <Week day={day} today={today} log={log} />
      <p role="status" className="sr-only">
        {said}
      </p>

      {!active ? (
        <Empty>
          <EmptyTitle aria-level={2}>No habits yet</EmptyTitle>
          <EmptyDescription>Add a habit, then check it off here each time you do it.</EmptyDescription>
          <EmptyActions>
            {/* Base UI marks a non-button render as role="button"; this one navigates, so it stays a link. */}
            <Button nativeButton={false} role="link" render={<Link to="/habits" search={{ new: true }} />}>
              Add habit
            </Button>
          </EmptyActions>
        </Empty>
      ) : !todo.length && !done.length ? (
        <p className="text-fg-2">No habits had started yet on this day.</p>
      ) : (
        <>
          <Card labelledBy="todo">
            <CardTitle id="todo" title="To do" count={todo.length} />
            {todo.length ? (
              <ul data-list="todo" className={ROWS}>
                {todo.map((item, i) => {
                  const fresh = settling.has(item.habit.id);
                  return (
                    <Row key={item.habit.id} item={item} checked={fresh} fresh={fresh} onToggle={() => !fresh && check(item, i)}>
                      {item.habit.frequency === "daily" && item.usual !== null
                        ? `Daily · usually ${minuteClock(item.usual)}`
                        : ONCE[item.habit.frequency]}
                    </Row>
                  );
                })}
              </ul>
            ) : (
              <p className="text-fg-2">Everything for {isToday ? "today" : "this day"} is checked off.</p>
            )}
          </Card>

          {done.length > 0 && (
            <Card labelledBy="done">
              <CardTitle id="done" title="Completed" count={done.length} />
              <ul className={ROWS}>
                {done.map((item) => (
                  // The time it was done stands at the row's end, where Spendly puts a row's figure.
                  <Row key={item.habit.id} item={item} checked onToggle={() => uncheck(item)} at={item.loggedAt && clock(item.loggedAt)}>
                    {item.loggedAt || item.habit.frequency === "daily" ? ONCE[item.habit.frequency] : `Done ${THIS[item.habit.frequency]}`}
                  </Row>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// A card's rows: pulled into its padding, so a row's hover fill stops just short of the card's edge, a hairline between each.
const ROWS = "-mx-3 -mbs-2 flex flex-col divide-y divide-line";

const row = (id: string) => document.querySelector<HTMLElement>(`[data-habit="${id}"]`);

/**
 * Runs a change that moves rows between the lists as one view transition, so each row glides to its new place, then
 * `after` once the new rows are in the page.
 */
function moveRows(change: () => void, after: () => void) {
  const run = () => {
    flushSync(change);
    after();
  };
  if (!document.startViewTransition) return run();
  document.startViewTransition(run);
}

/**
 * One habit for the day, as a checkbox: the round mark, then its name and when, and the time it was done at the end. At
 * rest the mark's check is drawn faint; checking fills it with ink and draws the check in (app.css, `.check-mark`).
 */
function Row({
  item,
  checked,
  fresh,
  at,
  onToggle,
  children,
}: {
  item: DayHabit;
  checked: boolean;
  fresh?: boolean;
  at?: string | null;
  onToggle: () => void;
  children: string;
}) {
  const h = item.habit;
  return (
    // Named for the view transition that carries it between the lists (app.css, `.habit-row`).
    // Opaque, so a row gliding between the lists stays solid while the page behind it crossfades.
    <li className="habit-row bg-card" style={{ "--row": `h-${h.id}` } as CSSProperties}>
      <Checkbox.Root
        checked={checked}
        onCheckedChange={onToggle}
        data-habit={h.id}
        className="group flex min-h-14 w-full cursor-pointer items-center gap-x-3 rounded-md px-3 py-2 text-start transition-colors duration-(--dur-instant) ease-out select-none hover:bg-surface-2 focus-visible:-outline-offset-2"
      >
        {/* The mark's column is Spendly's 32px, so the names line up with a row that leads with a tile. */}
        <span className="grid size-8 shrink-0 place-items-center">
          <span
            data-fresh={fresh || undefined}
            className={cn(
              "check-mark grid size-6 place-items-center rounded-full border-2 transition-colors duration-(--dur-fast) ease-out",
              checked ? "border-ink bg-ink text-fg-inverse" : "border-control text-line-strong group-hover:text-fg-3",
            )}
          >
            {/* Keyed, so checking mounts a new check that draws itself in. */}
            <Icon key={String(checked)} icon={Checkmark} size={16} strokeWidth={checked ? 3 : 2} />
          </span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={cn("truncate font-medium", checked ? "text-fg-2" : "text-fg")}>{title(h.behavior)}</span>
          <span className="truncate text-xs text-fg-3">{children}</span>
        </span>
        {at && <span className="shrink-0 whitespace-nowrap text-fg-3 tabular-nums">{at}</span>}
      </Checkbox.Root>
    </li>
  );
}

/** "Today", "Yesterday", or the day's date, with the year when it isn't this one. */
function dayTitle(day: Date, today: Date) {
  const key = toKey(day);
  if (key === toKey(today)) return "Today";
  if (key === toKey(addDays(today, -1))) return "Yesterday";
  const year = day.getFullYear() === today.getFullYear() ? undefined : "numeric";
  return day.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year });
}

/**
 * The week that holds the day, Monday first, as a card: the month as its title, a step to the week before or after, then
 * the seven days. Each day wears a ring of how much of its daily plan was done; the day shown is selected, and days
 * after today are out of reach.
 */
function Week({ day, today, log }: { day: Date; today: Date; log: ReturnType<typeof useLog> }) {
  const navigate = useNavigate({ from: "/" });
  const monday = periodStart(day, "weekly");
  const sunday = addDays(monday, 6);
  const days = spanStats(log, "week", monday, today).days;
  const thisWeek = toKey(monday) === toKey(periodStart(today, "weekly"));
  const go = (d: Date) => navigate({ search: toKey(d) === toKey(today) ? {} : { day: toKey(d) }, replace: true });
  const month = new Intl.DateTimeFormat([], { month: "long", year: "numeric" });

  return (
    <Card labelledBy="week">
      <CardTitle
        id="week"
        title={month.formatRange(monday, sunday)}
        action={
          <div className="-me-2 flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Previous week" onClick={() => go(addDays(day, -7))}>
              <Icon icon={ChevronLeft} size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next week"
              disabled={thisWeek}
              onClick={() => {
                const next = addDays(day, 7);
                go(next > today ? today : next);
              }}
            >
              <Icon icon={ChevronRight} size={16} />
            </Button>
          </div>
        }
      />
      {/* A radio group: one day is shown at a time, and the arrow keys move between the days. */}
      <RadioGroup
        aria-label="Day"
        value={toKey(day)}
        onValueChange={(key) => go(fromKey(key as string))}
        className="-mx-2 -mbs-2 grid grid-cols-7 gap-1"
      >
        {days.map(({ day: d, tally }) => {
          const key = toKey(d);
          const isToday = key === toKey(today);
          const future = d > today;
          const share = tally.planned ? tally.done / tally.planned : 0;
          const name = d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
          return (
            <Radio.Root
              key={key}
              value={key}
              disabled={future}
              aria-current={isToday ? "date" : undefined}
              aria-label={
                future
                  ? name
                  : `${name}, ${tally.planned ? `${tally.done} of ${tally.planned} daily habits done` : "nothing daily planned"}`
              }
              className="flex cursor-pointer flex-col items-center gap-1 rounded-md py-2 transition-colors duration-(--dur-instant) ease-out not-data-checked:hover:bg-surface-2 data-checked:selected data-disabled:cursor-not-allowed data-disabled:text-fg-disabled"
            >
              <span className={cn("text-xs", isToday ? "font-semibold text-fg" : "text-fg-3")}>
                {d.toLocaleDateString([], { weekday: "short" })}
              </span>
              <span className="relative grid size-9 place-items-center">
                {!future && <Ring share={share} />}
                <span className={cn("text-base tabular-nums", isToday ? "font-semibold" : "font-medium")}>{d.getDate()}</span>
              </span>
            </Radio.Root>
          );
        })}
      </RadioGroup>
    </Card>
  );
}

/** A day's share of its daily plan done, as a ring drawn clockwise from the top in ink, what done wears everywhere. */
function Ring({ share }: { share: number }) {
  const r = 16;
  const length = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 36 36" aria-hidden="true" className="absolute inset-0 -rotate-90">
      <circle cx="18" cy="18" r={r} fill="none" strokeWidth="2.5" className="stroke-line" />
      {share > 0 && (
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${share * length} ${length}`}
          className="stroke-ink"
        />
      )}
    </svg>
  );
}
