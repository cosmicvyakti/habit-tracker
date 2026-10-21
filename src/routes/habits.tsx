import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Add, ChevronRight, Icon } from "@/components/lime/icon";
import { Button } from "@/components/lime/ui/button";
import { Empty, EmptyActions, EmptyDescription, EmptyTitle } from "@/components/lime/ui/empty";
import { useToast } from "@/components/lime/ui/toast";
import { cn } from "@/lib/lime/utils";
import { Card, CardTitle } from "../components/Card";
import { count, title, UNIT } from "../components/habit";
import HabitForm from "../components/HabitForm";
import PageHeader from "../components/PageHeader";
import { logQuery, useLog, useToday } from "../data";
import { donePeriods } from "../lib/consistency";
import { FREQUENCIES, FREQUENCY_LABEL, fromKey, periodStart, recentPeriods, toKey } from "../lib/dates";
import { activeEvents, Habit, habitStart } from "../lib/model";

export const Route = createFileRoute("/habits")({
  head: () => ({ meta: [{ title: "Habits · Habit tracker" }] }),
  // `?new` opens the form on arrival, for Today's empty state.
  validateSearch: z.object({ new: z.boolean().optional().catch(undefined) }),
  loader: ({ context }) => context.queryClient.ensureQueryData(logQuery),
  component: Habits,
});

const RECENT = 7;
const since = (d: Date) => d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

// The epicenter is the list of habits; its verb, Add habit, is the view's one lime.
function Habits() {
  const log = useLog();
  const today = fromKey(useToday());
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const habits = log.habits.filter((h) => !h.archivedAt);
  // The form stays mounted after it closes, so it can play its exit and hand focus back. Keyed by what it opened on.
  const [form, setForm] = useState<{ habit: Habit | null; open: boolean; key: number }>({ habit: null, open: false, key: 0 });
  const [lit, setLit] = useState<string | null>(null);
  const [said, setSaid] = useState("");
  const toast = useToast();
  const open = (habit: Habit | null) => setForm((f) => ({ habit, open: true, key: f.key + 1 }));

  useEffect(() => {
    if (!search.new) return;
    open(null);
    void navigate({ search: {}, replace: true });
  }, [search.new, navigate]);

  const add = (
    <Button onClick={() => open(null)}>
      <Icon icon={Add} size={16} />
      Add habit
    </Button>
  );

  return (
    // On a phone Add habit is pinned at the foot, so the last row scrolls clear of it.
    <div className={cn("flex flex-col gap-5", habits.length > 0 && "phone:pbe-20")}>
      <PageHeader title="Habits" aside={habits.length > 0 && <div className="phone:hidden">{add}</div>} />
      {/* What a save or an archive did, for a screen reader; the eye sees the row light up or leave. */}
      <p role="status" className="sr-only">
        {said}
      </p>

      {habits.length === 0 ? (
        <Empty>
          <EmptyTitle aria-level={2}>No habits yet</EmptyTitle>
          <EmptyDescription>Add one you want to do daily, weekly, monthly or yearly, then check it off on Today.</EmptyDescription>
          <EmptyActions>{add}</EmptyActions>
        </Empty>
      ) : (
        // One card for each frequency in use, as Spendly groups its accounts by kind.
        FREQUENCIES.map((f) => {
          const group = habits.filter((h) => h.frequency === f);
          return (
            group.length > 0 && (
              <Card key={f} labelledBy={`habits-${f}`}>
                <CardTitle id={`habits-${f}`} title={FREQUENCY_LABEL[f]} count={group.length} />
                <ul className="-mx-3 -mbs-2 flex flex-col divide-y divide-line">
                  {group.map((h) => (
                    <Row key={h.id} habit={h} log={log} today={today} lit={lit === h.id} onOpen={() => open(h)} />
                  ))}
                </ul>
              </Card>
            )
          );
        })
      )}

      {habits.length > 0 && (
        <div className="fixed inset-x-0 inset-be-0 z-20 hidden bg-ground px-4 pbs-3 pbe-safe-5 phone:block">
          <Button size="lg" onClick={() => open(null)} className="w-full">
            <Icon icon={Add} size={16} />
            Add habit
          </Button>
        </div>
      )}

      <HabitForm
        key={form.key}
        habit={form.habit}
        open={form.open}
        onOpenChange={(o) => setForm((f) => ({ ...f, open: o }))}
        onSaved={(id, message) => {
          // Off for a frame, then on, so a second save of the same habit lights it again. The row itself stays
          // mounted, so the form can hand focus back to it.
          setLit(null);
          requestAnimationFrame(() => setLit(id));
          setSaid(message);
          // An archived habit leaves the screen, so its result is said where it can still be seen.
          if (!id) toast.show({ title: message });
        }}
      />
    </div>
  );
}

/**
 * One habit: its name and since when, its last seven periods as dots, and how many of them were done as the row's
 * figure. The whole row opens the form on it; a phone also shows the chevron, as a row that opens a page does.
 */
function Row({
  habit: h,
  log,
  today,
  lit,
  onOpen,
}: {
  habit: Habit;
  log: ReturnType<typeof useLog>;
  today: Date;
  lit: boolean;
  onOpen: () => void;
}) {
  const events = activeEvents(log, h.id);
  const done = donePeriods(events, h.frequency);
  const first = periodStart(habitStart(h, events), h.frequency);
  const periods = recentPeriods(today, h.frequency, RECENT);
  const shown = periods.filter((p) => p >= first);
  const hits = shown.filter((p) => done.has(toKey(p))).length;
  return (
    <li>
      <ButtonPrimitive
        onClick={onOpen}
        className={cn(
          "flex min-h-14 w-full items-center gap-x-3 rounded-md px-3 py-2 text-start transition-colors duration-(--dur-instant) ease-out hover:bg-surface-2 focus-visible:-outline-offset-2",
          lit && "animate-highlight",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-fg">{title(h.behavior)}</span>
          {/* The lines are blocks, so a screen reader would run them together without the comma. */}
          <span className="sr-only">, </span>
          <span className="block truncate text-xs text-fg-3">Since {since(habitStart(h, events))}</span>
        </span>
        {/* The last seven periods, oldest first: an ink dot for each one done, as done is drawn everywhere. A phone keeps
            the room for the name; the figure beside it says the same. */}
        <span aria-hidden="true" className="flex shrink-0 items-center gap-1 phone:hidden">
          {periods.map((p) => (
            <span
              key={toKey(p)}
              className={cn("size-2 rounded-full", p < first ? "bg-transparent" : done.has(toKey(p)) ? "bg-ink" : "bg-line-strong")}
            />
          ))}
        </span>
        <span className="w-14 shrink-0 text-end font-medium whitespace-nowrap text-fg tabular-nums">
          <span aria-hidden="true">
            {hits} of {shown.length}
          </span>
          <span className="sr-only">
            , done in {hits} of the last {count(shown.length, UNIT[h.frequency])}
          </span>
        </span>
        <Icon icon={ChevronRight} size={16} className="hidden shrink-0 text-fg-3 phone:block" />
      </ButtonPrimitive>
    </li>
  );
}
