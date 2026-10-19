import { Toolbar, ToolbarToggle } from "@/components/lime/ui/toolbar";
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
  return (
    <Toolbar aria-label={label}>
      {periods.map((p, i) => {
        const key = toKey(p);
        const current = i === periods.length - 1;
        return (
          <ToolbarToggle
            key={key}
            pressed={done.has(key)}
            onPressedChange={() => onToggle(key)}
            aria-current={current ? "date" : undefined}
            className={current ? "underline underline-offset-4" : undefined}
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
