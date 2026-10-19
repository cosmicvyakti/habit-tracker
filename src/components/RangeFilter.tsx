import type { z } from "zod";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/lime/ui/collapsible";
import { Field, FieldLabel } from "@/components/lime/ui/field";
import { Input } from "@/components/lime/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/lime/ui/select";
import type { Habit } from "../lib/model";
import type { rangeSearchSchema } from "../lib/schema";
import { title } from "./HabitSheet";

type RangeSearch = z.infer<typeof rangeSearchSchema>;

const ALL = "all";

/** Habit and date range controls. The values live in the URL as typed search params. */
export default function RangeFilter({
  search,
  habits,
  allowAll,
  datesFolded,
  onChange,
}: {
  search: RangeSearch;
  habits: Habit[];
  allowAll?: boolean;
  /** Keeps the dates behind a "Date range" toggle, open only once a date is set, so the page leads with its answer. */
  datesFolded?: boolean;
  onChange: (next: RangeSearch) => void;
}) {
  const set = (patch: Partial<RangeSearch>) => onChange({ ...search, ...patch });
  const items = [
    ...(allowAll ? [{ value: ALL, label: "All habits" }] : []),
    ...habits.map((h) => ({ value: h.id, label: h.archivedAt ? `${title(h.behavior)} (archived)` : title(h.behavior) })),
  ];
  const dates = (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <Field name="from" className="sm:flex-1">
        <FieldLabel>From</FieldLabel>
        <Input type="date" value={search.from ?? ""} onChange={(e) => set({ from: e.target.value || undefined })} />
      </Field>
      <Field name="to" className="sm:flex-1">
        <FieldLabel>To</FieldLabel>
        <Input type="date" value={search.to ?? ""} onChange={(e) => set({ to: e.target.value || undefined })} />
      </Field>
    </div>
  );
  return (
    // The habit gets a row of its own, so a long name isn't cut short; the two dates share the row below.
    <div className="flex flex-col gap-4">
      <Field name="habit">
        <FieldLabel>Habit</FieldLabel>
        <Select items={items} value={search.habit ?? ALL} onValueChange={(v) => set({ habit: v === ALL || !v ? undefined : v })}>
          <SelectTrigger className="w-full" />
          <SelectContent>
            {items.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {datesFolded ? (
        <Collapsible defaultOpen={Boolean(search.from || search.to)}>
          <CollapsibleTrigger className="w-auto">Date range</CollapsibleTrigger>
          <CollapsibleContent>
            <div className="pt-2">{dates}</div>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        dates
      )}
    </div>
  );
}
