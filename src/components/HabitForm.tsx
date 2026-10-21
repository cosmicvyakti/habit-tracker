import { useId, useState } from "react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/lime/ui/alert-dialog";
import { Button } from "@/components/lime/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/lime/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/lime/ui/field";
import { Input } from "@/components/lime/ui/input";
import { Segmented, SegmentedItem } from "@/components/lime/ui/segmented";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/lime/ui/sheet";
import { enqueue, newId, now } from "../data";
import { Frequency, FREQUENCIES, FREQUENCY_LABEL } from "../lib/dates";
import type { Habit } from "../lib/model";
import { planSchema } from "../lib/schema";
import { usePhone } from "../phone";

/**
 * A habit's two questions: what it is, and how often. Most habit apps ask little more to start (Streaks: a habit and a
 * schedule; HabitKit: a name and a target), and a long setup is the one people don't finish. A plan made before this
 * form keeps its cue and place; editing here leaves them as they were.
 *
 * A dialog on the desktop and a sheet from the foot on a phone, as Spendly's entry form is. Mounted by its page and
 * opened with `open`, so it plays its exit and hands focus back.
 */
export default function HabitForm({
  habit,
  open,
  onOpenChange,
  onSaved,
}: {
  /** The habit to edit, or none for a new one. */
  habit: Habit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (id: string, message: string) => void;
}) {
  const phone = usePhone();
  const id = useId();
  const [behavior, setBehavior] = useState(habit?.behavior ?? "");
  const [frequency, setFrequency] = useState<Frequency>(habit?.frequency ?? "daily");
  // The error shows once the field is left or the form sent, and clears as soon as it is fixed.
  const [touched, setTouched] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const problem = planSchema.shape.behavior.safeParse(behavior).error?.issues[0]?.message;
  const shown = touched ? problem : undefined;

  function save() {
    setTouched(true);
    if (problem) return document.getElementById(`${id}-name`)?.focus();
    const plan = {
      behavior: behavior.trim(),
      frequency,
      cue: habit?.cue ?? "",
      context: habit?.context ?? "",
      consequence: habit?.consequence ?? "",
    };
    const habitId = habit?.id ?? newId();
    if (habit) enqueue({ kind: "plan", id: habitId, at: now(), plan });
    else
      enqueue({
        kind: "habit",
        habit: { ...plan, id: habitId, createdAt: now() },
      });
    onOpenChange(false);
    onSaved(habitId, habit ? "Habit saved" : `Added ${plan.behavior}`);
  }

  const title = habit ? "Edit habit" : "New habit";
  const fields = (
    <form
      id={`${id}-form`}
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Field name="behavior" invalid={!!shown}>
        <FieldLabel>Name</FieldLabel>
        <Input
          id={`${id}-name`}
          value={behavior}
          onChange={(e) => setBehavior(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="Read 20 pages"
          autoComplete="off"
          maxLength={120}
        />
        {/* The error takes the hint's place, so the controls below stay put when it appears or clears. */}
        {shown ? <FieldError match>{shown}</FieldError> : <FieldDescription>Small enough to do on a bad day.</FieldDescription>}
      </Field>
      <div className="flex flex-col gap-2">
        <span id={`${id}-often`} className="label">
          How often
        </span>
        <Segmented aria-labelledby={`${id}-often`} fill value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
          {FREQUENCIES.map((f) => (
            <SegmentedItem key={f} value={f}>
              {FREQUENCY_LABEL[f]}
            </SegmentedItem>
          ))}
        </Segmented>
      </div>
    </form>
  );
  const archive = habit && (
    <Button variant="outline" onClick={() => setArchiving(true)} className="me-auto">
      Archive habit
    </Button>
  );
  const commit = (
    <Button type="submit" form={`${id}-form`}>
      {habit ? "Save changes" : "Add habit"}
    </Button>
  );

  return (
    <>
      {phone ? (
        <Sheet side="bottom" open={open} onOpenChange={onOpenChange}>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>{title}</SheetTitle>
            </SheetHeader>
            <SheetBody className="pbs-1">{fields}</SheetBody>
            <SheetFooter>
              {commit}
              {archive}
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            {fields}
            <DialogFooter className="mbs-2 flex-row items-center justify-end">
              {archive}
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              {commit}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={archiving} onOpenChange={setArchiving}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {habit?.behavior}?</AlertDialogTitle>
            <AlertDialogDescription>It leaves Today and Habits. Its check-ins stay, and Stats still counts them.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>Keep habit</AlertDialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                if (!habit) return;
                enqueue({ kind: "archive", id: habit.id, at: now() });
                setArchiving(false);
                onOpenChange(false);
                onSaved("", `Archived ${habit.behavior}`);
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
