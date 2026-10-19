import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronSort, Icon } from "@/components/lime/icon";
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
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/lime/ui/table";
import { cn } from "@/lib/lime/utils";
import { count, title } from "../components/HabitSheet";
import RangeFilter from "../components/RangeFilter";
import { enqueue, logQuery, newId, now, useLog } from "../data";
import { dayRange } from "../lib/dates";
import type { HabitEvent } from "../lib/model";
import { rangeSearchSchema } from "../lib/schema";

export const Route = createFileRoute("/log")({
  head: () => ({ meta: [{ title: "Log · Habit tracker" }] }),
  validateSearch: rangeSearchSchema,
  loader: ({ context }) => context.queryClient.ensureQueryData(logQuery),
  component: RawLog,
});

type Row = HabitEvent & { habit: string; retracted: boolean };

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
});
const col = createColumnHelper<typeof features, Row>();
// Numeric columns align to the end, per Lime's table-numbers-end rule.
const NUMERIC = new Set(["effort"]);
// Below 48rem of page width these columns fold into a line under the habit, so the table fits without scrolling sideways.
const FOLDED = new Set(["context", "precededBy", "effort", "payoffNoticed"]);
const payoffText = (e: { payoffNoticed: boolean | null; payoffNote: string | null }) =>
  `${e.payoffNoticed === null ? "-" : e.payoffNoticed ? "Yes" : "No"}${e.payoffNote ? `: ${e.payoffNote}` : ""}`;
const whenText = (at: string) => new Date(at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
/** An approximate log has a day but no real time, so it shows the day alone. */
const whenOf = (e: { at: string; approximate: boolean }) =>
  e.approximate ? new Date(e.at).toLocaleDateString([], { dateStyle: "medium" }) : whenText(e.at);
const monthText = (at: string) => new Date(at).toLocaleDateString([], { month: "long", year: "numeric" });
const dash = (v: string | number | null) => (v === null || v === "" ? "-" : v);
/** Why the table is empty, and only the ways out that apply. */
function emptyText(anyLogs: boolean, search: { habit?: string; from?: string; to?: string }) {
  if (!anyLogs) return "Nothing logged yet. Each log you make on Today shows up here.";
  const ways = [(search.from || search.to) && "widen the dates", search.habit && "pick all habits"].filter(Boolean);
  return ways.length ? `No logs match. Try to ${ways.join(" or ")}.` : "No logs match.";
}

function RawLog() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const log = useLog();
  // The event waiting for confirmation. A retraction can't be undone, so it asks first.
  // The row stays set while the dialog closes, so its text doesn't blank mid-animation.
  const [confirming, setConfirming] = useState<Row | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const rows = useMemo(() => {
    const names = new Map(log.habits.map((h) => [h.id, h.behavior]));
    const retracted = new Set(log.retractions.map((r) => r.eventId));
    const first = log.events[0]?.at ?? new Date().toISOString();
    const range = dayRange(search.from, search.to, new Date(first), new Date());
    return log.events
      .filter((e) => (!search.habit || e.habitId === search.habit) && range.contains(e.at))
      .map((e): Row => ({
        ...e,
        habit: names.get(e.habitId) ?? e.habitId,
        retracted: retracted.has(e.id),
      }));
  }, [log, search]);

  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("at", {
          header: "When",
          sortFn: "alphanumeric",
          cell: (c) => {
            const when = whenOf(c.row.original);
            return c.row.original.approximate ? (
              <span className="flex flex-col @3xl:whitespace-nowrap">
                {when}
                <span className="caption text-fg-3">Approximate</span>
              </span>
            ) : (
              <span className="@3xl:whitespace-nowrap">{when}</span>
            );
          },
        }),
        col.accessor("habit", {
          header: "Habit",
          sortFn: "alphanumeric",
          cell: (c) => {
            const e = c.row.original;
            const details = [
              e.context && `Place: ${e.context}`,
              e.precededBy && `Cue: ${e.precededBy}`,
              e.effort !== null && `Effort: ${e.effort}`,
              (e.payoffNoticed !== null || e.payoffNote) && `Payoff: ${payoffText(e)}`,
            ].filter(Boolean);
            return (
              <span className="flex flex-col">
                {title(c.getValue())}
                {details.length > 0 && <span className="caption text-fg-2 @3xl:hidden">{details.join(" · ")}</span>}
              </span>
            );
          },
        }),
        col.accessor("context", {
          header: "Place",
          enableSorting: false,
          cell: (c) => dash(c.getValue()),
        }),
        col.accessor("precededBy", {
          header: "Cue",
          enableSorting: false,
          cell: (c) => dash(c.getValue()),
        }),
        col.accessor("effort", {
          header: "Effort",
          sortFn: "basic",
          sortUndefined: "last",
          cell: (c) => dash(c.getValue()),
        }),
        col.accessor("payoffNoticed", {
          header: "Payoff",
          enableSorting: false,
          cell: (c) => payoffText(c.row.original),
        }),
        col.display({
          id: "action",
          header: "Action",
          cell: (c) =>
            c.row.original.retracted ? (
              <Badge variant="outline">Retracted</Badge>
            ) : (
              <Button
                variant="link"
                size="sm"
                aria-label={`Retract ${c.row.original.habit} at ${whenOf(c.row.original)}`}
                onClick={() => {
                  setConfirming(c.row.original);
                  setConfirmOpen(true);
                }}
              >
                Retract
              </Button>
            ),
        }),
      ]),
    [],
  );

  const table = useTable({
    features,
    columns,
    data: rows,
    // No unsorted state: rows would fall back to storage order while the header showed no sort.
    enableSortingRemoval: false,
    initialState: { sorting: [{ id: "at", desc: true }] },
  });

  const byTime = Boolean(table.getColumn("at")?.getIsSorted());

  return (
    <main className="@container mx-auto w-full max-w-5xl px-4 pt-4 pb-8 sm:px-6 sm:pt-8">
      <h1 className="title-page">Log</h1>
      <div className="mt-6">
        <RangeFilter search={search} habits={log.habits} allowAll onChange={(s) => navigate({ search: s })} />
      </div>
      <Table className="mt-6">
        <TableCaption>{count(rows.length, "logged event")}</TableCaption>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                return (
                  <TableHead
                    key={header.id}
                    scope="col"
                    className={cn(NUMERIC.has(header.column.id) && "text-end", FOLDED.has(header.column.id) && "@max-3xl:hidden")}
                    aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                  >
                    {header.column.getCanSort() ? (
                      <Button variant="link" size="sm" onClick={header.column.getToggleSortingHandler()}>
                        <span className="text-xs font-medium text-fg-3">
                          <table.FlexRender header={header} />
                        </span>
                        <Icon icon={sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ChevronSort} />
                      </Button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row, i, all) => {
            // Sorted by time, the rows fall under a heading for each month.
            const month = monthText(row.original.at);
            const opens = byTime && (i === 0 || monthText(all[i - 1].original.at) !== month);
            return (
              <Fragment key={row.id}>
                {opens && (
                  <TableRow>
                    <TableHead scope="colgroup" colSpan={columns.length} className="pt-6 text-base font-semibold text-fg">
                      {month}
                    </TableHead>
                  </TableRow>
                )}
                <TableRow>
                  {row.getAllCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        row.original.retracted && "text-fg-3",
                        NUMERIC.has(cell.column.id) && "text-end",
                        FOLDED.has(cell.column.id) && "@max-3xl:hidden",
                      )}
                    >
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              </Fragment>
            );
          })}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length}>{emptyText(log.events.length > 0, search)}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retract this log of {confirming?.habit}?</AlertDialogTitle>
            <AlertDialogDescription>
              The {confirming ? whenOf(confirming) : ""} event stays in the log, marked retracted, and stops counting toward consistency.
              You can't undo this; log it again if it was a mistake.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>Keep log</AlertDialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirming) enqueue({ kind: "retract", retraction: { id: newId(), eventId: confirming.id, at: now() } });
                setConfirmOpen(false);
              }}
            >
              Retract log
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
