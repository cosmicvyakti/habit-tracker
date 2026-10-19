import type { z } from "zod";
import { Field, FieldLabel } from "@/components/lime/ui/field";
import { Input } from "@/components/lime/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/lime/ui/select";
import type { Habit } from "../lib/model";
import type { rangeSearchSchema } from "../lib/schema";

type RangeSearch = z.infer<typeof rangeSearchSchema>;

const ALL = "all";

/** Habit and date range controls. The values live in the URL as typed search params. */
export default function RangeFilter({
  search,
  habits,
  allowAll,
  onChange,
}: {
  search: RangeSearch;
  habits: Habit[];
  allowAll?: boolean;
  onChange: (next: RangeSearch) => void;
}) {
  const set = (patch: Partial<RangeSearch>) => onChange({ ...search, ...patch });
  const items = [
    ...(allowAll ? [{ value: ALL, label: "All habits" }] : []),
    ...habits.map((h) => ({ value: h.id, label: h.archivedAt ? `${h.behavior} (archived)` : h.behavior })),
  ];
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <Field name="habit" className="sm:flex-1">
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
      <Field name="from" className="sm:w-44">
        <FieldLabel>From</FieldLabel>
        <Input type="date" value={search.from ?? ""} onChange={(e) => set({ from: e.target.value || undefined })} />
      </Field>
      <Field name="to" className="sm:w-44">
        <FieldLabel>To</FieldLabel>
        <Input type="date" value={search.to ?? ""} onChange={(e) => set({ to: e.target.value || undefined })} />
      </Field>
    </div>
  );
}
