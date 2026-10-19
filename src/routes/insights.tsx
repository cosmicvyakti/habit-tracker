import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { Badge } from "@/components/lime/ui/badge";
import { Button } from "@/components/lime/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/lime/ui/collapsible";
import { Empty, EmptyActions, EmptyDescription, EmptyTitle } from "@/components/lime/ui/empty";
import { List, ListItem } from "@/components/lime/ui/list";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/lime/ui/table";
import CurveChart from "../components/CurveChart";
import { count, MISS_BADGE, missText, pct, UNIT } from "../components/HabitCard";
import RangeFilter from "../components/RangeFilter";
import { logQuery, useLog } from "../data";
import { donePeriods, periodStats } from "../lib/consistency";
import { fitAutomaticity, MIN_POINTS } from "../lib/curve";
import { addDays, dayRange, longestStreak } from "../lib/dates";
import { activeEvents, habitStart } from "../lib/model";
import { rangeSearchSchema } from "../lib/schema";
import { srbaiPoints } from "../lib/srbai";
import { plannedCueShare, timeOfDaySpread } from "../lib/stability";

export const Route = createFileRoute("/insights")({
  validateSearch: rangeSearchSchema,
  loader: ({ context }) => context.queryClient.ensureQueryData(logQuery),
  component: Insights,
});

const SHELL = "mx-auto w-full max-w-2xl px-4 pt-4 pb-8 sm:px-6 sm:pt-8";

function Insights() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const log = useLog();
  const today = useMemo(() => new Date(), []);
  const habit = log.habits.find((h) => h.id === search.habit) ?? log.habits.find((h) => !h.archivedAt);

  if (!habit) {
    return (
      <main className={SHELL}>
        <h1 className="title-page">Insights</h1>
        <Empty className="mt-8">
          <EmptyTitle aria-level={2}>No habits yet</EmptyTitle>
          <EmptyDescription>Define a habit and log it for a while; its curve and consistency show up here.</EmptyDescription>
          <EmptyActions>
            <Button nativeButton={false} role="link" render={<Link to="/plan" />}>
              Define a habit
            </Button>
          </EmptyActions>
        </Empty>
      </main>
    );
  }

  const f = habit.frequency;
  const events = activeEvents(log, habit.id);
  const start = habitStart(habit, events);
  const range = dayRange(search.from, search.to, start, today);
  const inRange = events.filter((e) => range.contains(e.at));
  const done = donePeriods(events, f);
  const stats = periodStats(done, f, range.from > start ? range.from : start, range.to, today);
  const exact = inRange.filter((e) => !e.approximate);
  const spread = timeOfDaySpread(inRange);
  const cueShare = plannedCueShare(inRange, habit.cue);
  const badge = MISS_BADGE[stats.state];

  // Sorted by time, like the points, so rows line up with points[i].
  const checkIns = log.checkIns.filter((c) => c.habitId === habit.id).sort((a, b) => a.at.localeCompare(b.at));
  const points = srbaiPoints(checkIns, start);
  const fit = fitAutomaticity(points);

  return (
    <main className={SHELL}>
      <h1 className="title-page">Insights</h1>
      <div className="mt-6">
        <RangeFilter search={{ ...search, habit: habit.id }} habits={log.habits} onChange={(s) => navigate({ search: s })} />
      </div>

      <div className="mt-8 flex flex-col gap-8">
        <section className="flex flex-col gap-3" aria-labelledby="automaticity">
          <h2 id="automaticity" className="text-lg font-semibold">
            Automaticity
          </h2>
          <CurveChart points={points} fit={fit} />
          {points.length < MIN_POINTS ? (
            <p className="body text-fg">
              {points.length} of {MIN_POINTS} check-ins so far. The curve appears after {MIN_POINTS}.{" "}
              <Link to="/check-in" search={{ habit: habit.id }} className="underline underline-offset-4">
                Check in now
              </Link>
            </p>
          ) : fit?.plateauDay != null ? (
            <p className="body text-fg">
              Estimated plateau: <span className="font-semibold">{addDays(start, Math.round(fit.plateauDay)).toLocaleDateString()}</span> (day{" "}
              {Math.round(fit.plateauDay)}). Automaticity levels off near <span className="font-semibold">{fit.a.toFixed(1)}</span> out of 7.
            </p>
          ) : (
            <p className="body text-fg">The scores haven't started to level off, so there is no plateau estimate yet. Keep checking in.</p>
          )}
          {checkIns.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger>Check-in data</CollapsibleTrigger>
              <CollapsibleContent>
                <Table>
                  <TableCaption>SRBAI check-ins for {habit.behavior}</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Date</TableHead>
                      <TableHead scope="col" className="text-end">
                        Day
                      </TableHead>
                      <TableHead scope="col">Items</TableHead>
                      <TableHead scope="col" className="text-end">
                        Score
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {checkIns.map((c, i) => (
                      <TableRow key={c.id}>
                        <TableCell>{new Date(c.at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-end">{Math.round(points[i].t)}</TableCell>
                        <TableCell>{c.items.join(", ")}</TableCell>
                        <TableCell className="text-end">{points[i].y.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CollapsibleContent>
            </Collapsible>
          )}
          <p className="body text-fg-2">
            Scores use the SRBAI from Gardner et al. 2012. The curve A(t) = a - b·e^(-ct) and the 95% plateau follow Lally et al.
            2010. The curve uses every check-in, whatever the date range.
          </p>
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="consistency">
          <h2 id="consistency" className="text-lg font-semibold">
            Consistency
          </h2>
          <List>
            <ListItem title="Consistency rate" description={`${stats.done} of ${count(stats.elapsed, UNIT[f])}`} trailing={pct(stats.rate)} />
            <ListItem title="Never miss twice" trailing={<Badge variant={badge.variant}>{badge.label}</Badge>} />
            <ListItem title="Double misses in range" trailing={stats.doubleMisses} />
            <ListItem title="Longest streak, for reference" trailing={count(longestStreak(done, f), UNIT[f])} />
          </List>
          <p className="body text-fg">{missText(stats.state, f)}</p>
          <p className="body text-fg-2">
            Missing once did not set back habit formation, so consistency counts for more than streaks. Lally et al. 2010.
          </p>
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="stability">
          <h2 id="stability" className="text-lg font-semibold">
            Context stability
          </h2>
          <List>
            <ListItem
              title="Time-of-day spread"
              trailing={spread === null ? "Needs 2 timed logs" : Number.isFinite(spread) ? `±${spread.toFixed(1)} h` : "Fully scattered"}
            />
            <ListItem title="After the planned cue" trailing={habit.cue ? pct(cueShare) : "No cue planned"} />
            <ListItem
              title="Timed logs in range"
              description={inRange.length > exact.length ? `${inRange.length - exact.length} approximate left out` : undefined}
              trailing={exact.length}
            />
          </List>
          <p className="body text-fg-2">
            A smaller spread and a higher cue share mean a more stable context. Wood &amp; Neal 2007; Lally et al. 2010.
          </p>
        </section>
      </div>
    </main>
  );
}
