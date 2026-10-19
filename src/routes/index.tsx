import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/lime/ui/button";
import { Empty, EmptyActions, EmptyDescription, EmptyTitle } from "@/components/lime/ui/empty";
import HabitCard from "../components/HabitCard";
import { logQuery, useLog } from "../data";
import { donePeriods } from "../lib/consistency";
import { periodKey } from "../lib/dates";
import { activeEvents } from "../lib/model";

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(logQuery),
  component: Today,
});

function Today() {
  const log = useLog();
  const now = new Date();
  const habits = log.habits.filter((h) => !h.archivedAt);
  // One primary action per view: Log on the first habit still open this period, else adding a habit.
  const lead = habits.find((h) => !donePeriods(activeEvents(log, h.id), h.frequency).has(periodKey(now, h.frequency)));

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-4 pb-8 sm:px-6 sm:pt-8">
      <h1 className="title-page">Today</h1>
      {habits.length === 0 ? (
        <Empty className="mt-8">
          <EmptyTitle aria-level={2}>No habits yet</EmptyTitle>
          <EmptyDescription>Write a plan for when and where you'll do it, then log it here each time.</EmptyDescription>
          <EmptyActions>
            {/* Base UI marks a non-button render as role="button"; these navigate, so they stay links. */}
            <Button nativeButton={false} role="link" render={<Link to="/plan" />}>
              Define a habit
            </Button>
          </EmptyActions>
        </Empty>
      ) : (
        <>
          <ul className="mt-8 flex flex-col gap-4">
            {habits.map((h) => (
              <HabitCard key={h.id} habit={h} log={log} lead={h === lead} />
            ))}
          </ul>
          <Button
            variant={lead ? "outline" : "primary"}
            nativeButton={false}
            role="link"
            render={<Link to="/plan" />}
            className="mt-4"
          >
            Add a habit
          </Button>
        </>
      )}
    </main>
  );
}
