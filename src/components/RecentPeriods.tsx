import { useLayoutEffect, useRef } from "react";
import { Toolbar, ToolbarToggle } from "@/components/lime/ui/toolbar";
import { cn } from "@/lib/lime/utils";
import { Frequency, recentPeriods, shiftPeriod, toKey } from "../lib/dates";

interface Props {
  frequency: Frequency;
  done: Set<string>;
  today: Date;
  /** Names the toolbar, so two habits' rows can be told apart. */
  label: string;
  onToggle: (key: string) => void;
}

// Sized so the row fits a phone-width card: a Lime toolbar never wraps.
const COUNT: Record<Frequency, number> = { daily: 7, weekly: 5, monthly: 6, yearly: 5 };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function short(d: Date, freq: Frequency): string {
  switch (freq) {
    case "daily":
      return String(d.getDate());
    case "weekly":
      return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
    case "monthly":
      return MONTHS[d.getMonth()];
    case "yearly":
      return String(d.getFullYear());
  }
}

function describe(d: Date, freq: Frequency): string {
  switch (freq) {
    case "daily":
      return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
    case "weekly": {
      const end = shiftPeriod(d, "daily", 6);
      return `week of ${MONTHS[d.getMonth()]} ${d.getDate()} to ${MONTHS[end.getMonth()]} ${end.getDate()}`;
    }
    case "monthly":
      return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    case "yearly":
      return String(d.getFullYear());
  }
}

/** The most recent periods, oldest first. Press one to log it or, if it is logged, to retract it. */
export default function RecentPeriods({ frequency, done, today, label, onToggle }: Props) {
  const periods = recentPeriods(today, frequency, COUNT[frequency]);
  const row = useRef<HTMLDivElement>(null);
  // On a narrow card the row scrolls; start it at the current period, not the oldest one.
  useLayoutEffect(() => {
    if (row.current) row.current.scrollLeft = row.current.scrollWidth;
  }, [frequency]);
  return (
    <Toolbar ref={row} aria-label={label}>
      {periods.map((p, i) => {
        const key = toKey(p);
        const current = i === periods.length - 1;
        return (
          <ToolbarToggle
            key={key}
            pressed={done.has(key)}
            onPressedChange={() => onToggle(key)}
            aria-current={current ? "date" : undefined}
            // The olive edge marks a logged period: the wash alone is about 1.3:1 on the track in dark mode, under the 3:1 a state needs.
            className={cn("data-pressed:inset-ring data-pressed:inset-ring-accent-line", current && "underline underline-offset-4")}
          >
            {short(p, frequency)}
            {/* Keeps the visible label inside the accessible name, then spells the period out. */}
            <span className="sr-only">
              , {describe(p, frequency)}
              {current ? ", current" : ""}
            </span>
          </ToolbarToggle>
        );
      })}
    </Toolbar>
  );
}
