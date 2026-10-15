import { FormEvent, useEffect, useMemo, useState } from "react";
import RecentPeriods from "./RecentPeriods";
import { currentStreak, Frequency, FREQUENCIES, longestStreak, periodKey, toKey } from "./dates";
import { Habit, loadHabits, saveHabits } from "./storage";

const UNIT: Record<Frequency, string> = { daily: "day", weekly: "week", monthly: "month", yearly: "year" };
const THIS: Record<Frequency, string> = {
  daily: "today",
  weekly: "this week",
  monthly: "this month",
  yearly: "this year",
};
const EXAMPLE: Record<Frequency, string> = {
  daily: "Read 20 minutes",
  weekly: "Call parents",
  monthly: "Review budget",
  yearly: "Health checkup",
};

export default function App() {
  const [habits, setHabits] = useState<Habit[]>(loadHabits);
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("daily");
  const today = useMemo(() => new Date(), []);

  useEffect(() => saveHabits(habits), [habits]);

  function addHabit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setHabits((hs) => [
      ...hs,
      { id: crypto.randomUUID(), name: trimmed, frequency, createdAt: toKey(today), done: [] },
    ]);
    setName("");
  }

  function toggle(id: string, key: string) {
    setHabits((hs) =>
      hs.map((h) =>
        h.id !== id
          ? h
          : { ...h, done: h.done.includes(key) ? h.done.filter((k) => k !== key) : [...h.done, key] },
      ),
    );
  }

  function remove(id: string) {
    const h = habits.find((x) => x.id === id);
    if (h && confirm(`Delete "${h.name}" and its history?`)) {
      setHabits((hs) => hs.filter((x) => x.id !== id));
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <span className="logo" aria-hidden="true">✓</span>
          <span className="brand">habit-tracker</span>
        </div>
      </header>
      <main>
        <h1>Habit Tracker</h1>
        <p className="subtitle">Daily, weekly, monthly and yearly streaks.</p>
        <form onSubmit={addHabit} className="add">
          <div className="add-row">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`New habit, e.g. ${EXAMPLE[frequency]}`}
              aria-label="New habit name"
              maxLength={60}
            />
            <button type="submit" className="add-button">Add</button>
          </div>
          <div className="segmented" role="radiogroup" aria-label="How often">
            {FREQUENCIES.map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={frequency === f}
                className={frequency === f ? "on" : ""}
                onClick={() => setFrequency(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </form>

        {habits.length === 0 && <p className="empty-state">No habits yet. Add one above to start tracking.</p>}

        <ul className="habits">
          {habits.map((h) => {
            const f = h.frequency;
            const done = new Set(h.done);
            const nowKey = periodKey(today, f);
            const doneNow = done.has(nowKey);
            const streak = currentStreak(done, today, f);
            return (
              <li key={h.id} className="habit">
                <div className="habit-head">
                  <button
                    className={"check" + (doneNow ? " on" : "")}
                    onClick={() => toggle(h.id, nowKey)}
                    aria-label={doneNow ? `Unmark ${h.name} for ${THIS[f]}` : `Mark ${h.name} done ${THIS[f]}`}
                  >
                    {doneNow ? "✓" : ""}
                  </button>
                  <div className="habit-title">
                    <h2>{h.name}</h2>
                    <span className="badge">{f}</span>
                  </div>
                  <button className="delete" onClick={() => remove(h.id)} aria-label={`Delete ${h.name}`}>
                    ✕
                  </button>
                </div>
                <div className="stats">
                  <span>🔥 <strong>{streak}</strong>-{UNIT[f]} streak</span>
                  <span>Best <strong>{longestStreak(done, f)}</strong></span>
                  <span>Total <strong>{done.size}</strong></span>
                  <span className={doneNow ? "status done" : "status"}>
                    {doneNow ? `Done ${THIS[f]}` : `Not done ${THIS[f]}`}
                  </span>
                </div>
                <RecentPeriods frequency={f} done={done} today={today} onToggle={(k) => toggle(h.id, k)} />
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}
