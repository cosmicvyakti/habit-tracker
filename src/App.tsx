import { FormEvent, useEffect, useMemo, useState } from "react";
import Heatmap from "./Heatmap";
import { currentStreak, longestStreak, toKey } from "./dates";
import { Habit, loadHabits, saveHabits } from "./storage";

const COLORS = ["#22a35a", "#2f7de1", "#d9480f", "#9c36b5", "#e8590c", "#0c8599"];

export default function App() {
  const [habits, setHabits] = useState<Habit[]>(loadHabits);
  const [name, setName] = useState("");
  const today = useMemo(() => new Date(), []);
  const todayKey = toKey(today);

  useEffect(() => saveHabits(habits), [habits]);

  function addHabit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setHabits((hs) => [
      ...hs,
      {
        id: crypto.randomUUID(),
        name: trimmed,
        color: COLORS[hs.length % COLORS.length],
        createdAt: todayKey,
        done: [],
      },
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
    <main>
      <h1>Habit Tracker</h1>
      <form onSubmit={addHabit} className="add">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New habit, e.g. Read 20 minutes"
          aria-label="New habit name"
          maxLength={60}
        />
        <button type="submit">Add</button>
      </form>

      {habits.length === 0 && <p className="empty-state">No habits yet. Add one above to start tracking.</p>}

      <ul className="habits">
        {habits.map((h) => {
          const done = new Set(h.done);
          const doneToday = done.has(todayKey);
          return (
            <li key={h.id} className="habit">
              <div className="habit-head">
                <button
                  className={"check" + (doneToday ? " on" : "")}
                  style={doneToday ? { background: h.color, borderColor: h.color } : { borderColor: h.color }}
                  onClick={() => toggle(h.id, todayKey)}
                  aria-label={doneToday ? `Unmark ${h.name} for today` : `Mark ${h.name} done today`}
                >
                  {doneToday ? "✓" : ""}
                </button>
                <h2>{h.name}</h2>
                <div className="stats">
                  <span>🔥 {currentStreak(done, today)} day streak</span>
                  <span>Best {longestStreak(done)}</span>
                  <span>Total {done.size}</span>
                </div>
                <button className="delete" onClick={() => remove(h.id)} aria-label={`Delete ${h.name}`}>
                  ✕
                </button>
              </div>
              <Heatmap done={done} color={h.color} today={today} onToggle={(k) => toggle(h.id, k)} />
            </li>
          );
        })}
      </ul>
    </main>
  );
}
