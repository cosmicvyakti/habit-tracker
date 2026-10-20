import { createFileRoute, Link } from "@tanstack/react-router";
import { CSSProperties, useId, useState } from "react";
import { Checkmark, Icon } from "@/components/lime/icon";
import { Button } from "@/components/lime/ui/button";
import { Card } from "@/components/lime/ui/card";
import { Empty, EmptyActions, EmptyDescription, EmptyTitle } from "@/components/lime/ui/empty";
import { List, ListItem } from "@/components/lime/ui/list";
import HabitSheet, { intention, missText, title, useHabitActions } from "../components/HabitSheet";
import { logQuery, useLog, useToday } from "../data";
import { countFrom, donePeriods, periodStats } from "../lib/consistency";
import { Frequency, FREQUENCY_LABEL, fromKey, periodKey } from "../lib/dates";
import { habitStart, Log } from "../lib/model";
import { planToday, TodayHabit } from "../lib/today";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Today · Habit tracker" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(logQuery),
  component: Today,
});

const THIS: Record<Frequency, string> = { daily: "today", weekly: "this week", monthly: "this month", yearly: "this year" };
const clock = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const minuteClock = (m: number) => clock(new Date(2000, 0, 1, Math.floor(m / 60), m % 60));

function Today() {
  const log = useLog();
  const now = fromKey(useToday());
  const plan = planToday(log, now);
  const dailies = log.habits.filter((h) => !h.archivedAt && h.frequency === "daily");
  const dailyDone = dailies.filter((h) => plan.done.some((i) => i.habit === h)).length;
  // The sheet stays mounted after it closes, so it can play its exit and hand focus back.
  const [sheet, setSheet] = useState<{ id: string; open: boolean } | null>(null);
  const sheetHabit = sheet && log.habits.find((h) => h.id === sheet.id);
  const open = (id: string) => setSheet({ id, open: true });
  const empty = !plan.next && !plan.todo.length && !plan.done.length && !plan.later.length;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-4 pb-8 sm:px-6 sm:pt-8">
      <h1 className="title-page">Today</h1>
      {empty ? (
        <Empty className="mt-8">
          <EmptyTitle aria-level={2}>No habits yet</EmptyTitle>
          <EmptyDescription>Write a plan for when and where you'll do it, then log it here each time.</EmptyDescription>
          <EmptyActions>
            {/* Base UI marks a non-button render as role="button"; these navigate, so they stay links. */}
            <Button nativeButton={false} role="link" render={<Link to="/plan" />}>
              New habit
            </Button>
          </EmptyActions>
        </Empty>
      ) : (
        <div className="mt-6 flex flex-col gap-8">
          {plan.next ? (
            <NextUp item={plan.next} log={log} onOpen={() => open(plan.next!.habit.id)} />
          ) : (
            <p className="text-base font-medium">Everything planned for today is done.</p>
          )}

          {dailies.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="label text-fg-2">
                {dailyDone} of {dailies.length} done today
              </p>
              {/* The sentence carries the count; the bar repeats it at a glance. */}
              <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-control bg-surface-3">
                <div
                  className="h-full w-(--done) rounded-control bg-accent-line transition-[width] duration-(--dur-base) ease-out"
                  style={{ "--done": `${(dailyDone / dailies.length) * 100}%` } as CSSProperties}
                />
              </div>
            </div>
          )}

          <Group heading="Still to do" items={plan.todo} log={log} onOpen={open} describeItem={(i) => (i.habit.cue ? `After ${i.habit.cue}` : "Daily")} />
          <Group heading="Done today" items={plan.done} log={log} onOpen={open} describeItem={(i) => `Logged ${clock(i.loggedAt!)}`} />
          <Group
            heading="Later"
            items={plan.later}
            log={log}
            onOpen={open}
            describeItem={(i) => (i.doneNow ? `Done ${THIS[i.habit.frequency]}` : `${FREQUENCY_LABEL[i.habit.frequency]}, not yet ${THIS[i.habit.frequency]}`)}
          />

          <div>
            <Button variant={plan.next ? "outline" : "primary"} nativeButton={false} role="link" render={<Link to="/plan" />}>
              New habit
            </Button>
          </div>
        </div>
      )}
      {sheetHabit && (
        <HabitSheet
          key={`${sheetHabit.id}:${sheetHabit.cue}:${sheetHabit.context}`}
          habit={sheetHabit}
          log={log}
          open={sheet.open}
          onOpenChange={(o) => setSheet({ id: sheetHabit.id, open: o })}
        />
      )}
    </main>
  );
}

/** The habit to do next, as its plan sentence, with the view's one primary action. */
function NextUp({ item, log, onOpen }: { item: TodayHabit; log: Log; onOpen: () => void }) {
  const h = item.habit;
  const { logNow } = useHabitActions(h, log);
  const done = donePeriods(item.events, h.frequency);
  const today = new Date();
  const stats = periodStats(done, h.frequency, countFrom(habitStart(h, item.events), done, h.frequency), today, today);
  const note =
    stats.state === "missed-once" || stats.state === "missed-twice"
      ? missText(stats.state, h.frequency)
      : item.usual !== null && h.frequency === "daily"
        ? `${FREQUENCY_LABEL[h.frequency]}, usually around ${minuteClock(item.usual)}`
        : `${FREQUENCY_LABEL[h.frequency]}, not yet ${THIS[h.frequency]}`;

  return (
    <section aria-labelledby="next-up">
      <h2 id="next-up" className="sr-only">
        Next up
      </h2>
      <Card className="gap-3">
        <p className="lead-sentence break-words">{intention(h) ?? title(h.behavior)}</p>
        <p className="body text-fg-2">{note}</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button size="lg" className="w-full sm:w-auto" onClick={() => logNow()}>
            Log
            <span className="sr-only"> {h.behavior}</span>
          </Button>
          <Button variant="ghost" size="lg" onClick={onOpen}>
            See details
            <span className="sr-only"> for {h.behavior}</span>
          </Button>
        </div>
      </Card>
    </section>
  );
}

function Group({
  heading,
  items,
  log,
  onOpen,
  describeItem,
}: {
  heading: string;
  items: TodayHabit[];
  log: Log;
  onOpen: (id: string) => void;
  describeItem: (i: TodayHabit) => string;
}) {
  const id = useId();
  if (!items.length) return null;
  return (
    <section className="flex flex-col gap-1" aria-labelledby={id}>
      <h2 id={id} className="text-lg font-semibold">
        {heading}
      </h2>
      {/* Rows run to the column's edges; the list's own padding lines their text up with the heading. */}
      <List className="-ms-4 -me-3">
        {items.map((i) => (
          <Row key={i.habit.id} item={i} log={log} description={describeItem(i)} onOpen={() => onOpen(i.habit.id)} />
        ))}
      </List>
    </section>
  );
}

/** One habit as a row: the row opens its sheet, and the round button beside it logs or clears the current period. */
function Row({ item, log, description, onOpen }: { item: TodayHabit; log: Log; description: string; onOpen: () => void }) {
  const h = item.habit;
  const { togglePeriod } = useHabitActions(h, log);
  return (
    <ListItem
      title={title(h.behavior)}
      description={description}
      onClick={onOpen}
      menu={
        <Button
          // Logged reads as a filled grey with an olive check: a state, so it stays clear of the lime, which is the action.
          variant={item.doneNow ? "secondary" : "outline"}
          size="icon"
          aria-pressed={item.doneNow}
          aria-label={`Log ${h.behavior} ${THIS[h.frequency]}`}
          onClick={() => togglePeriod(periodKey(new Date(), h.frequency))}
        >
          {item.doneNow && (
            <Icon icon={Checkmark} size={20} className="text-accent-line transition-[opacity,scale] duration-(--dur-fast) ease-out starting:scale-(--scale-enter) starting:opacity-0" />
          )}
        </Button>
      }
    />
  );
}
