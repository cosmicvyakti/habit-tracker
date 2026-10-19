import { useId, useLayoutEffect, useRef, useState } from "react";
import { Checkmark, Icon } from "@/components/lime/icon";
import { Toolbar, ToolbarToggle } from "@/components/lime/ui/toolbar";
import { cn } from "@/lib/lime/utils";
import { Frequency, periodStart, recentPeriods, shiftPeriod, toKey } from "../lib/dates";

interface Props {
  frequency: Frequency;
  done: Set<string>;
  today: Date;
  /** When the habit started. Periods before its first one aren't offered: backfilling them would move its start. */
  start: Date;
  /** Names the toolbar, so two habits' rows can be told apart. */
  label: string;
  onToggle: (key: string) => void;
}

// A Lime toolbar never wraps, so the row shows as many periods as fit the card, from MIN on the narrowest
// phone to MAX on a desktop. Below MIN it scrolls, opening at the current period.
const MIN: Record<Frequency, number> = { daily: 5, weekly: 4, monthly: 5, yearly: 4 };
const MAX: Record<Frequency, number> = { daily: 14, weekly: 12, monthly: 12, yearly: 6 };
// Roughly the widest label of each kind, "W 28", "Sep 28", "May", "2026", with its check mark, padding and gap.
const ITEM_WIDTH: Record<Frequency, number> = { daily: 64, weekly: 76, monthly: 62, yearly: 66 };
const UNIT: Record<Frequency, string> = { daily: "day", weekly: "week", monthly: "month", yearly: "year" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function short(d: Date, freq: Frequency): string {
  switch (freq) {
    case "daily":
      return `${WEEKDAYS[d.getDay()]} ${d.getDate()}`;
    case "weekly":
      return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
    case "monthly":
      return MONTHS[d.getMonth()];
    case "yearly":
      return String(d.getFullYear());
  }
}

/** The period starting at `d` in words, such as "Thursday, October 16" or "week of Oct 13 to Oct 19". */
export function describe(d: Date, freq: Frequency): string {
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

/** The most recent periods since the habit started, oldest first. Press one to log it or, if it is logged, to retract it. */
export default function RecentPeriods({ frequency, done, today, start, label, onToggle }: Props) {
  const captionId = useId();
  const row = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(MIN[frequency]);
  const first = periodStart(start, frequency);
  const periods = recentPeriods(today, frequency, count).filter((p) => p >= first);

  // Fit as many periods as the card has room for.
  useLayoutEffect(() => {
    const el = row.current;
    if (!el) return;
    const fit = () => {
      const room = Math.floor((el.clientWidth - 8) / ITEM_WIDTH[frequency]);
      setCount(Math.min(MAX[frequency], Math.max(MIN[frequency], room)));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [frequency]);

  // On a narrow card the row scrolls; start it at the current period, not the oldest one.
  useLayoutEffect(() => {
    if (row.current) row.current.scrollLeft = row.current.scrollWidth;
  }, [frequency, count]);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {/* The check mark says which periods are logged, so the instruction is for screen readers only. */}
      <p id={captionId} className="sr-only">
        Press a {UNIT[frequency]} to log it or clear it.
      </p>
      <Toolbar
        ref={row}
        aria-label={label}
        aria-describedby={captionId}
        className="w-full"
        // Tabbing in lands on the current period, the one people log, rather than the oldest.
        onFocus={(e) => {
          if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
          const current = e.currentTarget.querySelector<HTMLElement>('[aria-current="date"]');
          if (current && e.target !== current) current.focus();
        }}
      >
        {periods.map((p, i) => {
          const key = toKey(p);
          const current = i === periods.length - 1;
          const label = short(p, frequency);
          const long = describe(p, frequency);
          return (
            <ToolbarToggle
              key={key}
              pressed={done.has(key)}
              onPressedChange={() => onToggle(key)}
              aria-current={current ? "date" : undefined}
              // The olive edge keeps a logged period at 3:1 on the track, and the check mark says "logged" without color.
              className={cn("grow data-pressed:inset-ring data-pressed:inset-ring-accent-line", current && "underline underline-offset-4")}
            >
              {done.has(key) && <Icon icon={Checkmark} size={12} />}
              {label}
              {/* Keeps the visible label inside the accessible name, then spells the period out where that adds something. */}
              {(long !== label || current) && (
                <span className="sr-only">
                  {long !== label && `, ${long}`}
                  {current && ", current"}
                </span>
              )}
            </ToolbarToggle>
          );
        })}
      </Toolbar>
    </div>
  );
}
