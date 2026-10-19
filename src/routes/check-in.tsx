import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/lime/ui/button";
import { Empty, EmptyActions, EmptyDescription, EmptyTitle } from "@/components/lime/ui/empty";
import { Radio, RadioGroup } from "@/components/lime/ui/radio";
import { useToast } from "@/components/lime/ui/toast";
import { title } from "../components/HabitCard";
import { enqueue, logQuery, newId, now, useLog } from "../data";
import { checksIn, SRBAI_ITEMS, SRBAI_MAX, SRBAI_MIN, srbaiScore } from "../lib/srbai";

export const Route = createFileRoute("/check-in")({
  validateSearch: z.object({ habit: z.string().optional().catch(undefined) }),
  loader: ({ context }) => context.queryClient.ensureQueryData(logQuery),
  component: CheckInPage,
});

const SCALE = Array.from({ length: SRBAI_MAX - SRBAI_MIN + 1 }, (_, i) => String(SRBAI_MIN + i));

function CheckInPage() {
  const { habit: habitId } = Route.useSearch();
  const log = useLog();
  const navigate = useNavigate();
  const toast = useToast();
  const [answers, setAnswers] = useState<(number | null)[]>(SRBAI_ITEMS.map(() => null));
  const habit = log.habits.find((h) => h.id === habitId);

  if (!habit) {
    return (
      <main className="mx-auto w-full max-w-md px-4 pt-4 pb-8 sm:px-6 sm:pt-8">
        <h1 className="title-page">Automaticity check-in</h1>
        <Empty className="mt-8">
          <EmptyTitle aria-level={2}>No habit picked</EmptyTitle>
          <EmptyDescription>Open a habit's check-in from Today to answer its four questions.</EmptyDescription>
          <EmptyActions>
            <Button nativeButton={false} role="link" render={<Link to="/" />}>
              Go to Today
            </Button>
          </EmptyActions>
        </Empty>
      </main>
    );
  }

  if (!checksIn(habit.frequency)) {
    return (
      <main className="mx-auto w-full max-w-md px-4 pt-4 pb-8 sm:px-6 sm:pt-8">
        <h1 className="title-page">Automaticity check-in</h1>
        <Empty className="mt-8">
          <EmptyTitle aria-level={2}>No check-ins for this habit</EmptyTitle>
          <EmptyDescription>
            Check-ins are for daily and weekly habits. This one is measured by how consistently you do it.
          </EmptyDescription>
          <EmptyActions>
            <Button nativeButton={false} role="link" render={<Link to="/insights" search={{ habit: habit.id }} />}>
              See its insights
            </Button>
          </EmptyActions>
        </Empty>
      </main>
    );
  }

  const missing = answers.filter((a) => a === null).length;

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-4 pb-8 sm:px-6 sm:pt-8">
      <h1 className="title-page">Automaticity check-in</h1>
      <form
        className="mt-8 flex flex-col gap-8"
        onSubmit={async (e) => {
          e.preventDefault();
          if (missing) return;
          const items = answers as [number, number, number, number];
          enqueue({ kind: "checkIn", checkIn: { id: newId(), habitId: habit.id, at: now(), items } });
          toast.show({
            title: "Saved check-in",
            description: `Score ${srbaiScore(items).toFixed(2)} out of 7, the larger dot on the chart.`,
          });
          await navigate({ to: "/insights", search: { habit: habit.id } });
        }}
      >
        <section className="flex flex-col gap-6">
          <h2 className="text-lg leading-tight font-semibold break-words">{title(habit.behavior)} is something…</h2>
          {SRBAI_ITEMS.map((item, i) => (
            <div key={item} className="flex flex-col gap-2">
              <span id={`item-${i}`} className="label">
                {item}
              </span>
              {/* Seven points, one past Radio's usual limit: the whole scale stays visible, as the instrument shows it. */}
              <RadioGroup
                aria-labelledby={`item-${i}`}
                value={answers[i] === null ? "" : String(answers[i])}
                onValueChange={(v) => setAnswers((a) => a.map((x, j) => (j === i ? Number(v) : x)))}
                className="flex-row justify-between"
              >
                {SCALE.map((n) => (
                  <label key={n} className="body flex flex-col items-center gap-1">
                    <Radio value={n} />
                    {n}
                    {n === String(SRBAI_MIN) && <span className="sr-only">, strongly disagree</span>}
                    {n === String(SRBAI_MAX) && <span className="sr-only">, strongly agree</span>}
                  </label>
                ))}
              </RadioGroup>
              <p className="caption flex justify-between text-fg-3" aria-hidden="true">
                <span>Strongly disagree</span>
                <span>Strongly agree</span>
              </p>
            </div>
          ))}
        </section>
        <p className="body text-fg-2" aria-live="polite">
          {missing ? `Answer ${missing} more to see your score.` : `Score: ${srbaiScore(answers as number[]).toFixed(2)} out of 7`}
        </p>
        <Button type="submit" size="lg" disabled={missing > 0} className="w-full sm:w-auto sm:self-start">
          Save check-in
        </Button>
      </form>
    </main>
  );
}
