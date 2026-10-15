import { Frequency, recentPeriods, shiftPeriod, toKey } from "./dates";

interface Props {
  frequency: Frequency;
  done: Set<string>;
  today: Date;
  onToggle: (key: string) => void;
}

const COUNT: Record<Frequency, number> = { daily: 14, weekly: 12, monthly: 12, yearly: 6 };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

function labels(d: Date, freq: Frequency): [string, string] {
  switch (freq) {
    case "daily":
      return [DAYS[d.getDay()], String(d.getDate())];
    case "weekly":
      return [MONTHS[d.getMonth()], String(d.getDate())];
    case "monthly":
      return ["'" + String(d.getFullYear()).slice(2), MONTHS[d.getMonth()]];
    case "yearly":
      return ["", String(d.getFullYear())];
  }
}

function describe(d: Date, freq: Frequency): string {
  switch (freq) {
    case "daily":
      return d.toDateString();
    case "weekly": {
      const end = shiftPeriod(d, "daily", 6);
      return `Week of ${MONTHS[d.getMonth()]} ${d.getDate()} to ${MONTHS[end.getMonth()]} ${end.getDate()}`;
    }
    case "monthly":
      return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    case "yearly":
      return String(d.getFullYear());
  }
}

/** A full-width row of the most recent periods; click one to mark it done or not done. */
export default function RecentPeriods({ frequency, done, today, onToggle }: Props) {
  const periods = recentPeriods(today, frequency, COUNT[frequency]);
  return (
    <div className="periods" style={{ gridTemplateColumns: `repeat(${periods.length}, 1fr)` }}>
      {periods.map((p, i) => {
        const key = toKey(p);
        const on = done.has(key);
        const current = i === periods.length - 1;
        const [top, bottom] = labels(p, frequency);
        const what = describe(p, frequency);
        return (
          <button
            key={key}
            className={"period" + (on ? " on" : "") + (current ? " current" : "")}
            title={what}
            aria-label={`${what}: ${on ? "done" : "not done"}`}
            aria-pressed={on}
            onClick={() => onToggle(key)}
          >
            {top && <span className="period-top">{top}</span>}
            <span className="period-bottom">{bottom}</span>
          </button>
        );
      })}
    </div>
  );
}
