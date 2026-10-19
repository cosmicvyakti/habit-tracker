import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef } from "react";
import { z } from "zod";
import { Button } from "@/components/lime/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/lime/ui/field";
import { Input } from "@/components/lime/ui/input";
import { Segmented, SegmentedItem } from "@/components/lime/ui/segmented";
import { enqueue, logQuery, newId, now, useLog } from "../data";
import { Frequency, FREQUENCIES, FREQUENCY_LABEL } from "../lib/dates";
import type { Habit } from "../lib/model";
import { Plan, planSchema } from "../lib/schema";

export const Route = createFileRoute("/plan")({
  validateSearch: z.object({ habit: z.string().optional().catch(undefined) }),
  loader: ({ context }) => context.queryClient.ensureQueryData(logQuery),
  component: PlanPage,
});

const FIELDS = [
  { name: "cue", label: "After (cue)", hint: "Something that already happens every time.", example: "I pour my morning coffee" },
  { name: "behavior", label: "I will (behavior)", hint: "Small and concrete.", example: "read 20 pages" },
  { name: "context", label: "At (place)", hint: "Where you will be.", example: "the kitchen table" },
  { name: "consequence", label: "So that (payoff, optional)", hint: "What you get from it.", example: "I start the day calm" },
] as const;

function PlanPage() {
  const { habit: habitId } = Route.useSearch();
  const habit = useLog().habits.find((h) => h.id === habitId);
  // Remount when switching between new and edit, so the form picks up the right defaults.
  return <PlanForm key={habit?.id ?? "new"} habit={habit} />;
}

function PlanForm({ habit }: { habit: Habit | undefined }) {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const defaults: Plan = habit
    ? { cue: habit.cue, behavior: habit.behavior, context: habit.context, consequence: habit.consequence, frequency: habit.frequency }
    : { cue: "", behavior: "", context: "", consequence: "", frequency: "daily" };

  const form = useForm({
    defaultValues: defaults,
    validators: { onBlur: planSchema, onSubmit: planSchema },
    onSubmit: async ({ value }) => {
      const plan = planSchema.parse(value);
      if (habit) enqueue({ kind: "plan", id: habit.id, at: now(), plan });
      else enqueue({ kind: "habit", habit: { ...plan, id: newId(), createdAt: now() } });
      await navigate({ to: "/" });
    },
    // The first error may be off screen; move focus to it so it is seen and read out.
    onSubmitInvalid: () => requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()),
  });

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-4 pb-8 sm:px-6 sm:pt-8">
      <h1 className="title-page">{habit ? "Edit plan" : "Define a habit"}</h1>
      <form
        ref={formRef}
        className="mt-8 flex flex-col gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        {FIELDS.map(({ name, label, hint, example }) => (
          <form.Field key={name} name={name}>
            {(field) => {
              // The blur and submit validators can report the same issue; show it once.
              const errors = [...new Set(field.state.meta.errors.map((e) => e?.message).filter(Boolean))];
              return (
                <Field name={name} invalid={errors.length > 0}>
                  <FieldLabel>{label}</FieldLabel>
                  <Input
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder={example}
                    autoComplete="off"
                    maxLength={120}
                  />
                  {/* The error takes the hint's place, so the controls below stay put when it appears or clears. */}
                  {errors.length > 0 ? <FieldError match>{errors.join(" ")}</FieldError> : <FieldDescription>{hint}</FieldDescription>}
                </Field>
              );
            }}
          </form.Field>
        ))}
        <form.Field name="frequency">
          {(field) => (
            <div className="flex flex-col gap-2">
              <span id="frequency-label" className="label">
                How often
              </span>
              <Segmented
                aria-labelledby="frequency-label"
                fill
                value={field.state.value}
                onValueChange={(v) => field.handleChange(v as Frequency)}
              >
                {FREQUENCIES.map((f) => (
                  <SegmentedItem key={f} value={f}>
                    {FREQUENCY_LABEL[f]}
                  </SegmentedItem>
                ))}
              </Segmented>
            </div>
          )}
        </form.Field>
        <form.Subscribe selector={(s) => s.values}>
          {(v) => (
            <p className="body text-fg-2" aria-live="polite">
              After {v.cue || "[cue]"}, I will {v.behavior || "[behavior]"} at {v.context || "[place]"}.
            </p>
          )}
        </form.Subscribe>
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(submitting) => (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button type="submit" size="lg" pending={submitting} className="w-full sm:w-auto">
                {habit ? "Save plan" : "Add habit"}
              </Button>
              <Button variant="ghost" size="lg" nativeButton={false} role="link" render={<Link to="/" />} className="w-full sm:w-auto">
                Cancel
              </Button>
            </div>
          )}
        </form.Subscribe>
      </form>
    </main>
  );
}
