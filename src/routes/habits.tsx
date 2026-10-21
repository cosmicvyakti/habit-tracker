import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Add, Icon } from "@/components/lime/icon";
import { Button } from "@/components/lime/ui/button";
import { Empty, EmptyActions, EmptyDescription, EmptyTitle } from "@/components/lime/ui/empty";
import { List, ListItem } from "@/components/lime/ui/list";
import { cn } from "@/lib/lime/utils";
import { count, title, UNIT } from "../components/habit";
import HabitForm from "../components/HabitForm";
import PageHeader from "../components/PageHeader";
import { logQuery, useLog, useToday } from "../data";
import { donePeriods } from "../lib/consistency";
import { FREQUENCY_LABEL, fromKey, periodStart, recentPeriods, toKey } from "../lib/dates";
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
    <div className={cn("flex flex-col gap-6", habits.length > 0 && "phone:pbe-20")}>
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
        <section aria-labelledby="habits-list" className="flex flex-col gap-3">
          <h2 id="habits-list" className="sr-only">
            Your habits
          </h2>
          <div className="overflow-clip rounded-panel border border-line bg-card shadow-card">
            <List>
              {habits.map((h) => (
                <Row key={h.id} habit={h} log={log} today={today} lit={lit === h.id} onOpen={() => open(h)} />
              ))}
            </List>
          </div>
        </section>
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
        }}
      />
    </div>
  );
}

/** One habit: its name, how often and since when, and its last seven periods; the row opens the form on it. */
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
    <ListItem
      className={cn(lit && "animate-highlight")}
      onClick={onOpen}
      chevron
      title={title(h.behavior)}
      description={`${FREQUENCY_LABEL[h.frequency]} · since ${since(habitStart(h, events))}`}
      trailing={
        // The last seven periods, oldest first: a filled square for each one done.
        <span
          className="flex items-center gap-1"
          role="img"
          aria-label={`Done in ${hits} of the last ${count(shown.length, UNIT[h.frequency])}`}
        >
          {periods.map((p) => (
            <span
              key={toKey(p)}
              className={cn("size-3 rounded-sm", p < first ? "bg-transparent" : done.has(toKey(p)) ? "bg-accent-line" : "bg-surface-3")}
            />
          ))}
        </span>
      }
    />
  );
}
