import { Link, useNavigate } from "@tanstack/react-router";
import { useId, useMemo, useState } from "react";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/lime/ui/dialog";
import { Field, FieldLabel } from "@/components/lime/ui/field";
import { Input } from "@/components/lime/ui/input";
import { Radio, RadioGroup } from "@/components/lime/ui/radio";
import { useToast } from "@/components/lime/ui/toast";
import { enqueue, newId, now, useToday } from "../data";
import { countFrom, donePeriods, MissState, periodStats } from "../lib/consistency";
import { Frequency, FREQUENCY_LABEL, fromKey, periodKey } from "../lib/dates";
import { activeEvents, Habit, HabitEvent, habitStart, Log } from "../lib/model";
import { checkInDue, checksIn } from "../lib/srbai";
import RecentPeriods, { describe } from "./RecentPeriods";

export const UNIT: Record<Frequency, string> = { daily: "day", weekly: "week", monthly: "month", yearly: "year" };
/** "1 week", "2 weeks". */
export const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const LAST: Record<Frequency, string> = { daily: "yesterday", weekly: "last week", monthly: "last month", yearly: "last year" };
const THIS: Record<Frequency, string> = { daily: "today", weekly: "this week", monthly: "this month", yearly: "this year" };

/** "Read 20 pages": the behavior as a title, in sentence case. */
export const title = (behavior: string) => behavior.charAt(0).toUpperCase() + behavior.slice(1);

// A place typed with its own preposition ("in the kitchen") keeps it; a bare one ("the bedroom") gets "at".
const PREPOSITION = /^(at|in|on|by|near|under|inside|outside|around|beside|behind|from|with|during|before|after|over)\s/i;
export const where = (place: string) => (PREPOSITION.test(place.trim()) ? place.trim() : `at ${place.trim()}`);

export function intention(h: Habit): string | null {
  return h.cue && h.context ? `After ${h.cue}, I will ${h.behavior} ${where(h.context)}.` : null;
}

export function missText(state: MissState, f: Frequency): string {
  const unit = UNIT[f];
  // Facts and the next step, never blame: one miss doesn't set a habit back (Lally et al. 2010).
  if (state === "missed-once") return `Missed ${LAST[f]}. Doing it ${THIS[f]} keeps it on track.`;
  if (state === "missed-twice") return `It's been a few ${unit}s. Doing it ${THIS[f]} is what counts.`;
  if (state === "not-started") return `Log it for the first time ${THIS[f]}.`;
  return "No double misses right now.";
}

/**
 * The word and tone for each never-miss-twice state. The word carries the state; the tone repeats it. Two misses get a
 * warning, not an error: red would say the habit failed, and picking it back up is all that matters.
 */
export const MISS_BADGE = {
  "not-started": { variant: "neutral", label: "Not started" },
  "on-track": { variant: "success", label: "On track" },
  "missed-once": { variant: "warn", label: "Missed once" },
  "missed-twice": { variant: "warn", label: "Missed twice" },
} as const;

export const pct = (r: number | null) => (r === null ? "Not yet" : `${Math.round(r * 100)}%`);
const EFFORT = ["1", "2", "3", "4", "5"] as const;
const text = (s: string) => s.trim() || null;


type Details = Pick<HabitEvent, "context" | "precededBy" | "effort" | "payoffNoticed" | "payoffNote">;

/** Logging and clearing a habit's periods, each with an Undo toast. Shared by Today's rows and the habit sheet. */
export function useHabitActions(h: Habit, log: Log) {
  const toast = useToast();
  const events = activeEvents(log, h.id);
  const f = h.frequency;
  const retract = (eventId: string) => enqueue({ kind: "retract", retraction: { id: newId(), eventId, at: now() } });

  // Place and cue come from the plan unless the sheet's details say otherwise.
  function logNow(details: Partial<Details> = {}) {
    const e: HabitEvent = {
      id: newId(),
      habitId: h.id,
      at: now(),
      approximate: false,
      context: text(h.context),
      precededBy: text(h.cue),
      effort: null,
      payoffNoticed: null,
      payoffNote: null,
      ...details,
    };
    enqueue({ kind: "event", event: e });
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
    if (key === periodKey(new Date(), f)) return logNow();
    // Backfill: the user knows it happened that period, not when or after what.
    const noon = fromKey(key);
    noon.setHours(12);
    const e: HabitEvent = {
      id: newId(),
      habitId: h.id,
      at: noon.toISOString(),
      approximate: true,
      context: null,
      precededBy: null,
      effort: null,
      payoffNoticed: null,
      payoffNote: null,
    };
    enqueue({ kind: "event", event: e });
    toast.show({
      title: `Logged ${h.behavior}`,
      description: `${describe(noon, f).replace(/^./, (c) => c.toUpperCase())}, approximate`,
      action: { label: "Undo", onClick: () => retract(e.id) },
    });
  }

  return { events, logNow, togglePeriod };
}

/**
 * Everything about one habit that Today leaves out: the plan, where it stands, its recent periods, details for the
 * next log, the check-in and the habit's other actions. Opens from a habit on Today.
 */
export default function HabitSheet({
  habit: h,
  log,
  open,
  onOpenChange,
}: {
  habit: Habit;
  log: Log;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const id = useId();
  const navigate = useNavigate();
  const day = useToday();
  const today = useMemo(() => new Date(), [day]);
  const { events, logNow, togglePeriod } = useHabitActions(h, log);
  const f = h.frequency;
  const done = donePeriods(events, f);
  const start = habitStart(h, events);
  const stats = periodStats(done, f, countFrom(start, done, f), today, today);
  const doneNow = done.has(periodKey(today, f));
  const due = checksIn(f) && checkInDue(log.checkIns.filter((c) => c.habitId === h.id), today);
  const plan = intention(h);
  const badge = MISS_BADGE[stats.state];

  // Prefilled from the plan, editable before logging from here.
  const [context, setContext] = useState(h.context);
  const [cue, setCue] = useState(h.cue);
  const [effort, setEffort] = useState<HabitEvent["effort"]>(null);
  const [payoff, setPayoff] = useState<boolean | null>(null);
  const [note, setNote] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const go = (to: "/insights" | "/log" | "/plan") => {
    onOpenChange(false);
    navigate({ to, search: { habit: h.id } });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="break-words">{title(h.behavior)}</DialogTitle>
            <DialogDescription>{FREQUENCY_LABEL[f]}</DialogDescription>
          </DialogHeader>

          {plan ? (
            <p className="lead-sentence break-words">{plan}</p>
          ) : (
            <p className="body text-fg-2">
              No implementation intention yet.{" "}
              <Link to="/plan" search={{ habit: h.id }} className="text-fg underline underline-offset-4">
                Finish the plan
              </Link>
            </p>
          )}

          <p className="body flex flex-wrap items-center gap-2 text-fg-2">
            <Badge variant={badge.variant}>{badge.label}</Badge>
            {missText(stats.state, f)}
          </p>

          <RecentPeriods
            frequency={f}
            done={done}
            today={today}
            start={start}
            label={`Recent ${UNIT[f]}s of ${h.behavior}`}
            onToggle={togglePeriod}
          />

          {detailsOpen ? (
            <div className="flex flex-col gap-4">
              <h3 className="text-base font-semibold text-fg">Details for the next log</h3>
              <Field name="context">
                <FieldLabel>Place</FieldLabel>
                <Input value={context} onChange={(e) => setContext(e.target.value)} autoComplete="off" maxLength={200} autoFocus />
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
          ) : (
            <div>
              <Button variant="link" onClick={() => setDetailsOpen(true)}>
                Add details to the next log
              </Button>
            </div>
          )}

          <Button
            variant="solid"
            size="lg"
            onClick={() => {
              logNow({ context: text(context), precededBy: text(cue), effort, payoffNoticed: payoff, payoffNote: text(note) });
              setEffort(null);
              setPayoff(null);
              setNote("");
              setDetailsOpen(false);
              onOpenChange(false);
            }}
          >
            {doneNow ? "Log again" : "Log"}
            <span className="sr-only"> {h.behavior}</span>
          </Button>

          {/* A check-in is an invitation, never a debt: no count of days late. */}
          {due && (
            <Button
              variant="outline"
              nativeButton={false}
              role="link"
              render={<Link to="/check-in" search={{ habit: h.id }} />}
              onClick={() => onOpenChange(false)}
            >
              Check in on automaticity
              <span className="sr-only"> for {h.behavior}</span>
            </Button>
          )}

          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <Button variant="link" onClick={() => go("/insights")}>
              See insights
            </Button>
            <Button variant="link" onClick={() => go("/log")}>
              See log
            </Button>
            <Button variant="link" onClick={() => go("/plan")}>
              Edit plan
            </Button>
            <Button variant="link" onClick={() => setArchiveOpen(true)} className="ms-auto">
              Archive habit
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {h.behavior}?</AlertDialogTitle>
            <AlertDialogDescription>
              It leaves Today. Its log and check-ins stay, and you can still see them in Insights and the log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>Keep habit</AlertDialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                enqueue({ kind: "archive", id: h.id, at: now() });
                setArchiveOpen(false);
                onOpenChange(false);
              }}
            >
              Archive habit
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
