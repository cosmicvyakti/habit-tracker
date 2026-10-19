import { Link, useNavigate } from "@tanstack/react-router";
import { useId, useMemo, useState } from "react";
import { Icon, OverflowMenuHorizontal } from "@/components/lime/icon";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/lime/ui/alert-dialog";
import { Badge } from "@/components/lime/ui/badge";
import { Button } from "@/components/lime/ui/button";
import { Card, CardFooter, CardHeader } from "@/components/lime/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/lime/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/lime/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/lime/ui/field";
import { Input } from "@/components/lime/ui/input";
import { Radio, RadioGroup } from "@/components/lime/ui/radio";
import { useToast } from "@/components/lime/ui/toast";
import { enqueue, newId, now } from "../data";
import { donePeriods, MissState, periodStats } from "../lib/consistency";
import { Frequency, FREQUENCY_LABEL, fromKey, longestStreak, periodKey } from "../lib/dates";
import { activeEvents, Habit, HabitEvent, habitStart, Log } from "../lib/model";
import { checkInDue } from "../lib/srbai";
import RecentPeriods, { describe } from "./RecentPeriods";

export const UNIT: Record<Frequency, string> = { daily: "day", weekly: "week", monthly: "month", yearly: "year" };
/** "1 week", "2 weeks". */
export const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const LAST: Record<Frequency, string> = { daily: "yesterday", weekly: "last week", monthly: "last month", yearly: "last year" };
const THIS: Record<Frequency, string> = { daily: "today", weekly: "this week", monthly: "this month", yearly: "this year" };

export function intention(h: Habit): string | null {
  return h.cue && h.context ? `After ${h.cue}, I will ${h.behavior} at ${h.context}.` : null;
}

export function missText(state: MissState, f: Frequency): string {
  const unit = UNIT[f];
  if (state === "missed-once") return `Missed ${LAST[f]}. Don't miss twice: do it ${THIS[f]}.`;
  if (state === "missed-twice") return `Missed 2 or more ${unit}s in a row. Pick it back up ${THIS[f]}.`;
  return "No double misses right now.";
}

/** The word and tone for each never-miss-twice state. The word carries the state; the tone repeats it. */
export const MISS_BADGE = {
  "on-track": { variant: "success", label: "On track" },
  "missed-once": { variant: "warn", label: "Missed once" },
  "missed-twice": { variant: "danger", label: "Missed twice" },
} as const;

export const pct = (r: number | null) => (r === null ? "no data yet" : `${Math.round(r * 100)}%`);
const EFFORT = ["1", "2", "3", "4", "5"] as const;
const text = (s: string) => s.trim() || null;

/** One habit on Today. `lead` makes its Log the view's one primary action. */
export default function HabitCard({ habit: h, log, lead }: { habit: Habit; log: Log; lead: boolean }) {
  const id = useId();
  const toast = useToast();
  const navigate = useNavigate();
  const today = useMemo(() => new Date(), []);
  const events = activeEvents(log, h.id);
  const f = h.frequency;
  const done = donePeriods(events, f);
  const stats = periodStats(done, f, habitStart(h, events), today, today);
  const doneNow = done.has(periodKey(today, f));
  const due = checkInDue(
    log.checkIns.filter((c) => c.habitId === h.id),
    today,
  );
  const plan = intention(h);
  const badge = MISS_BADGE[stats.state];

  // Prefilled from the plan, editable before the tap.
  const [context, setContext] = useState(h.context);
  const [cue, setCue] = useState(h.cue);
  const [effort, setEffort] = useState<HabitEvent["effort"]>(null);
  const [payoff, setPayoff] = useState<boolean | null>(null);
  const [note, setNote] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);

  const retract = (eventId: string) => enqueue({ kind: "retract", retraction: { id: newId(), eventId, at: now() } });

  function logNow() {
    const e: HabitEvent = {
      id: newId(),
      habitId: h.id,
      at: now(),
      approximate: false,
      context: text(context),
      precededBy: text(cue),
      effort,
      payoffNoticed: payoff,
      payoffNote: text(note),
    };
    enqueue({ kind: "event", event: e });
    setEffort(null);
    setPayoff(null);
    setNote("");
    toast.show({
      title: `Logged ${h.behavior}`,
      action: {
        label: "Undo",
        onClick: () => {
          retract(e.id);
          toast.show({ title: `Removed that log of ${h.behavior}` });
        },
      },
    });
  }

  function togglePeriod(key: string) {
    const inPeriod = events.filter((e) => periodKey(new Date(e.at), f) === key);
    if (inPeriod.length) {
      inPeriod.forEach((e) => retract(e.id));
      const n = inPeriod.length;
      toast.show({
        title: `Removed ${n === 1 ? "the log" : `${n} logs`} of ${h.behavior}`,
        description: describe(fromKey(key), f).replace(/^./, (c) => c.toUpperCase()),
        action: {
          label: "Undo",
          // The log is append-only, so Undo logs the same entries again under new ids.
          onClick: () => inPeriod.forEach((e) => enqueue({ kind: "event", event: { ...e, id: newId() } })),
        },
      });
      return;
    }
    if (key === periodKey(today, f)) return logNow();
    // Backfill: the user knows it happened that period, not when or after what.
    const noon = fromKey(key);
    noon.setHours(12);
    enqueue({
      kind: "event",
      event: {
        id: newId(),
        habitId: h.id,
        at: noon.toISOString(),
        approximate: true,
        context: null,
        precededBy: null,
        effort: null,
        payoffNoticed: null,
        payoffNote: null,
      },
    });
  }

  return (
    <li>
      {/* Outline, so the grey fields and period track inside keep their edges. */}
      <Card variant="outline">
        <CardHeader className="flex-row items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {/* Card titles are h3; under the page's h1 each habit is a section, so it takes an h2 at the title size. */}
            <h2 className="text-lg leading-tight font-semibold break-words">{h.behavior}</h2>
            <div>
              <Badge variant="outline">{FREQUENCY_LABEL[f]}</Badge>
            </div>
          </div>
          <Button variant={lead ? "primary" : "solid"} onClick={logNow}>
            {doneNow ? "Log again" : "Log"}
            <span className="sr-only"> {h.behavior}</span>
          </Button>
        </CardHeader>

        {plan ? (
          <p className="body text-fg-2 break-words">{plan}</p>
        ) : (
          <p className="body text-fg-2">
            No implementation intention yet.{" "}
            <Link to="/plan" search={{ habit: h.id }} className="text-fg underline underline-offset-4">
              Finish the plan
            </Link>
          </p>
        )}

        <Collapsible>
          <CollapsibleTrigger>Edit details for the next log</CollapsibleTrigger>
          <CollapsibleContent>
            <div className="flex flex-col gap-4 pt-2 pb-1">
              <Field name="context">
                <FieldLabel>Place</FieldLabel>
                <Input value={context} onChange={(e) => setContext(e.target.value)} autoComplete="off" maxLength={200} />
              </Field>
              <Field name="cue">
                <FieldLabel>After (cue)</FieldLabel>
                <Input value={cue} onChange={(e) => setCue(e.target.value)} autoComplete="off" maxLength={200} />
              </Field>
              <div className="flex flex-col gap-2">
                <span id={`${id}-effort`} className="label">
                  Effort, from 1 (none) to 5 (a lot). Optional.
                </span>
                <RadioGroup
                  aria-labelledby={`${id}-effort`}
                  value={effort === null ? "" : String(effort)}
                  onValueChange={(v) => setEffort(Number(v) as HabitEvent["effort"])}
                  className="flex-row flex-wrap gap-4"
                >
                  {EFFORT.map((n) => (
                    <label key={n} className="body flex items-center gap-2">
                      <Radio value={n} /> {n}
                    </label>
                  ))}
                </RadioGroup>
              </div>
              <div className="flex flex-col gap-2">
                <span id={`${id}-payoff`} className="label">
                  Did you notice the payoff{h.consequence ? ` (${h.consequence})` : ""}? Optional.
                </span>
                <RadioGroup
                  aria-labelledby={`${id}-payoff`}
                  value={payoff === null ? "" : payoff ? "yes" : "no"}
                  onValueChange={(v) => setPayoff(v === "yes")}
                  className="flex-row flex-wrap gap-4"
                >
                  <label className="body flex items-center gap-2">
                    <Radio value="yes" /> Yes
                  </label>
                  <label className="body flex items-center gap-2">
                    <Radio value="no" /> No
                  </label>
                </RadioGroup>
              </div>
              <Field name="payoffNote">
                <FieldLabel>Payoff note</FieldLabel>
                <Input value={note} onChange={(e) => setNote(e.target.value)} autoComplete="off" maxLength={200} />
              </Field>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="flex flex-col gap-2">
          <p className="body text-fg-2">
            Consistency {pct(stats.rate)}, {stats.done} of {count(stats.elapsed, UNIT[f])}. Longest streak {longestStreak(done, f)}.
          </p>
          <p className="body flex flex-wrap items-center gap-2 text-fg-2">
            <Badge variant={badge.variant}>{badge.label}</Badge>
            {missText(stats.state, f)}
          </p>
        </div>

        <RecentPeriods frequency={f} done={done} today={today} label={`Recent ${UNIT[f]}s of ${h.behavior}`} onToggle={togglePeriod} />

        <CardFooter className="flex-wrap">
          {due && (
            <Button variant="outline" size="sm" nativeButton={false} role="link" render={<Link to="/check-in" search={{ habit: h.id }} />}>
              Check in on automaticity
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" aria-label={`More actions for ${h.behavior}`} className="ms-auto" />}
            >
              <Icon icon={OverflowMenuHorizontal} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate({ to: "/insights", search: { habit: h.id } })}>See insights</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/log", search: { habit: h.id } })}>See raw log</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/plan", search: { habit: h.id } })}>Edit plan</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onClick={() => setArchiveOpen(true)}>
                Archive habit
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardFooter>
      </Card>

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {h.behavior}?</AlertDialogTitle>
            <AlertDialogDescription>
              It leaves Today. Its log and check-ins stay, and you can still see them in Insights and the raw log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>Keep habit</AlertDialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                enqueue({ kind: "archive", id: h.id, at: now() });
                setArchiveOpen(false);
              }}
            >
              Archive habit
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
