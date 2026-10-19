import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { Badge } from "@/components/lime/ui/badge";
import { Button } from "@/components/lime/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/lime/ui/collapsible";
import { Empty, EmptyActions, EmptyDescription, EmptyTitle } from "@/components/lime/ui/empty";
import { List, ListItem } from "@/components/lime/ui/list";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/lime/ui/table";
import CurveChart from "../components/CurveChart";
import { count, MISS_BADGE, missText, pct, UNIT } from "../components/HabitSheet";
import RangeFilter from "../components/RangeFilter";
import { logQuery, useLog } from "../data";
import { countFrom, donePeriods, periodStats } from "../lib/consistency";
import { fitAutomaticity, TRUST_MIN_POINTS, TRUST_MIN_SPAN_DAYS, trustFit } from "../lib/curve";
import { addDays, dayRange, FREQUENCY_LABEL, longestStreak } from "../lib/dates";
import { EFFORT_WINDOW_DAYS, effortTrend, payoffNoticed } from "../lib/effort";
import { activeEvents, habitStart } from "../lib/model";
import { rangeSearchSchema } from "../lib/schema";
import { checksIn, srbaiPoints } from "../lib/srbai";
import { plannedCueShare, timeOfDaySpread } from "../lib/stability";

export const Route = createFileRoute("/insights")({
  head: () => ({ meta: [{ title: "Insights · Habit tracker" }] }),
  validateSearch: rangeSearchSchema,
  loader: ({ context }) => context.queryClient.ensureQueryData(logQuery),
  component: Insights,
});

const SHELL = "mx-auto w-full max-w-2xl px-4 pt-4 pb-8 sm:px-6 sm:pt-8";
/** "Jan 6, 2027": the month in words, so the date reads the same in every locale. */
const dateText = (d: Date) => d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
const effortText = (n: number | null) => (n === null ? "-" : n.toFixed(1));

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
              New habit
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
  const first = countFrom(start, done, f);
  const stats = periodStats(done, f, range.from > first ? range.from : first, range.to, today);
  const exact = inRange.filter((e) => !e.approximate);
  const spread = timeOfDaySpread(inRange);
  const cueShare = plannedCueShare(inRange, habit.cue);
  const badge = MISS_BADGE[stats.state];

  // Sorted by time, like the points, so rows line up with points[i].
  const checkIns = log.checkIns.filter((c) => c.habitId === habit.id).sort((a, b) => a.at.localeCompare(b.at));
  const points = srbaiPoints(checkIns, start);
  const fit = fitAutomaticity(points);
  const trust = trustFit(fit, points);
  const lastT = points.length ? points[points.length - 1].t : 0;
  const span = points.length ? Math.round(lastT - points[0].t) : 0;
  const effort = effortTrend(inRange, range.from, addDays(range.to, 1));
  const payoff = payoffNoticed(inRange);

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
          {checksIn(f) ? (
            <>
              <CurveChart points={points} fit={trust === "trusted" ? fit : null} />
              {trust !== "trusted" ? (
                <p className="body text-fg">
                  {trust === "few-points"
                    ? `Too early to tell. ${points.length} of ${TRUST_MIN_POINTS} check-ins so far.`
                    : trust === "short-span"
                      ? `Too early to tell. The check-ins cover ${count(span, "day")}, and the curve needs ${TRUST_MIN_SPAN_DAYS}.`
                      : "The scores move around too much for a curve yet. It shows once they settle."}{" "}
                  <Link to="/check-in" search={{ habit: habit.id }} className="underline underline-offset-4">
                    Check in now
                  </Link>
                </p>
              ) : fit?.plateauDay != null && fit.plateauDay <= lastT ? (
                <p className="body text-fg">
                  Leveled off around <span className="font-semibold">{dateText(addDays(start, Math.round(fit.plateauDay)))}</span> (day{" "}
                  {Math.round(fit.plateauDay)}), near <span className="font-semibold">{fit.a.toFixed(1)}</span> out of 7.
                </p>
              ) : fit?.plateauDay != null ? (
                <p className="body text-fg">
                  Projected to level off around{" "}
                  <span className="font-semibold">
                    {addDays(start, Math.round(fit.plateauDay)).toLocaleDateString([], { month: "short", year: "numeric" })}
                  </span>
                  , {count(Math.round(fit.plateauDay - lastT), "day")} after your last check-in, near{" "}
                  <span className="font-semibold">{fit.a.toFixed(1)}</span> out of 7. The dashed line is the projection.
                </p>
              ) : (
                <p className="body text-fg">
                  The scores haven't started to level off, so there is no plateau estimate yet. Keep checking in.
                </p>
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
                            <TableCell>{dateText(new Date(c.at))}</TableCell>
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
                Scores use the SRBAI from Gardner et al. 2012. The curve A(t) = a - b·e^(-ct) and the 95% plateau follow Lally et al. 2010.
                The curve shows once {TRUST_MIN_POINTS} check-ins over {TRUST_MIN_SPAN_DAYS} days fit it well, and it uses every check-in,
                whatever the date range.
              </p>
            </>
          ) : (
            <p className="body text-fg">
              Check-ins and the automaticity curve are for daily and weekly habits. The research behind them followed behaviors done daily,
              so a {FREQUENCY_LABEL[f].toLowerCase()} habit is measured by consistency instead. Lally et al. 2010.
            </p>
          )}
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="consistency">
          <h2 id="consistency" className="text-lg font-semibold">
            Consistency
          </h2>
          <List>
            <ListItem
              title="Consistency rate"
              description={stats.elapsed ? `${stats.done} of ${count(stats.elapsed, UNIT[f])}` : `Shows after this ${UNIT[f]}`}
              trailing={pct(stats.rate)}
            />
            <ListItem title="Never miss twice" trailing={<Badge variant={badge.variant}>{badge.label}</Badge>} />
            <ListItem title="Double misses in range" trailing={stats.doubleMisses} />
            <ListItem title="Longest streak" description="For reference" trailing={count(longestStreak(done, f), UNIT[f])} />
          </List>
          <p className="body text-fg">{missText(stats.state, f)}</p>
          <p className="body text-fg-2">
            Missing once didn&rsquo;t set back habit formation (Lally et al. 2010), so this app counts consistency instead of streaks.
            &ldquo;Never miss twice&rdquo; is from Clear 2018.
          </p>
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="effort">
          <h2 id="effort" className="text-lg font-semibold">
            Effort and payoff
          </h2>
          <List>
            {effort.first !== null && effort.last !== null ? (
              <ListItem
                title="Effort"
                description={`First ${EFFORT_WINDOW_DAYS / 7} weeks, then last ${EFFORT_WINDOW_DAYS / 7}`}
                trailing={`${effortText(effort.first)} → ${effortText(effort.last)}`}
              />
            ) : (
              <ListItem
                title="Average effort"
                description="1 is none, 5 is a lot"
                trailing={effort.all === null ? "Not yet" : effortText(effort.all)}
              />
            )}
            <ListItem
              title="Payoff noticed"
              description={payoff.answered ? `${payoff.yes} of ${count(payoff.answered, "log")} that answered` : undefined}
              trailing={payoff.answered ? pct(payoff.yes / payoff.answered) : "Not yet"}
            />
          </List>
          <p className="body text-fg-2">
            Both come from the details you add to a log. Effort should fall as the habit becomes automatic; it&rsquo;s this app&rsquo;s
            stand-in between check-ins, not a measure from Lally et al. 2010. Noticing the payoff is the reinforcement that keeps a behavior
            going. Skinner 1938.
          </p>
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="stability">
          <h2 id="stability" className="text-lg font-semibold">
            Context stability
          </h2>
          <List>
            <ListItem
              title="Time-of-day spread"
              description={spread === null ? "Needs 2 timed logs" : undefined}
              trailing={spread === null ? "Not yet" : Number.isFinite(spread) ? `±${spread.toFixed(1)} h` : "Fully scattered"}
            />
            <ListItem
              title="After the planned cue"
              description={habit.cue ? undefined : "No cue in the plan"}
              trailing={habit.cue ? pct(cueShare) : "None"}
            />
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
