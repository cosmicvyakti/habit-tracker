import { heatmapWeeks, toKey } from "./dates";

interface Props {
  done: Set<string>;
  today: Date;
  onToggle: (key: string) => void;
}

const WEEKS = 26;
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function Heatmap({ done, today, onToggle }: Props) {
  const weeks = heatmapWeeks(today, WEEKS);
  return (
    <div className="heatmap" role="grid" aria-label="Completion calendar">
      <div className="months">
        {weeks.map((col, i) => {
          const first = col[0]!;
          const show = i === 0 || first.getDate() <= 7;
          return <span key={i}>{show ? MONTHS[first.getMonth()] : ""}</span>;
        })}
      </div>
      <div className="grid">
        {weeks.map((col, w) => (
          <div className="col" key={w}>
            {col.map((d, i) => {
              if (!d) return <span key={i} className="cell empty" />;
              const key = toKey(d);
              const on = done.has(key);
              return (
                <button
                  key={i}
                  className={"cell" + (on ? " on" : "")}
                  title={`${d.toDateString()}${on ? " ✓" : ""}`}
                  aria-label={`${d.toDateString()} ${on ? "done" : "not done"}`}
                  aria-pressed={on}
                  onClick={() => onToggle(key)}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
