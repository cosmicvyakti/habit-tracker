import Database from "better-sqlite3";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { CheckIn, Habit, HabitEvent, Log } from "../lib/model";
import type { Op } from "../lib/schema";

const LOG_TABLES = ["events", "retractions", "check_ins"];

const SCHEMA = `
create table if not exists habits (
  id text primary key,
  frequency text not null,
  created_at text not null,
  context text not null,
  cue text not null,
  behavior text not null,
  consequence text not null,
  archived_at text
);
create table if not exists events (
  id text primary key,
  habit_id text not null references habits(id),
  at text not null,
  approximate integer not null,
  context text,
  preceded_by text,
  effort integer check (effort between 1 and 5),
  payoff_noticed integer,
  payoff_note text
);
create table if not exists retractions (
  id text primary key,
  event_id text not null unique references events(id),
  at text not null
);
create table if not exists sessions (
  token_hash text primary key,
  expires_at text not null
);
create table if not exists check_ins (
  id text primary key,
  habit_id text not null references habits(id),
  at text not null,
  item1 integer not null check (item1 between 1 and 7),
  item2 integer not null check (item2 between 1 and 7),
  item3 integer not null check (item3 between 1 and 7),
  item4 integer not null check (item4 between 1 and 7)
);
${LOG_TABLES.map(
  (t) => `
create trigger if not exists ${t}_no_update before update on ${t} begin select raise(abort, '${t} is append-only'); end;
create trigger if not exists ${t}_no_delete before delete on ${t} begin select raise(abort, '${t} is append-only'); end;`,
).join("")}
`;

export function openDb(path: string): Database.Database {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  // Added for sync: when the plan last changed, so an older edit that arrives late doesn't win.
  // Older code ignores the column, so a rollback still reads the database.
  if (!(db.pragma("table_info(habits)") as { name: string }[]).some((c) => c.name === "plan_at"))
    db.exec("alter table habits add column plan_at text");
  return db;
}

let instance: Database.Database | undefined;
function db() {
  return (instance ??= openDb(process.env.HABITS_DB ?? "data/habits.db"));
}

const bool = (v: number | null) => (v === null ? null : v === 1);
const int = (v: boolean | null) => (v === null ? null : v ? 1 : 0);

// shortcut: reads the whole log on every request; fine for one person's habits, page by range if it grows past ~100k events.
export function readLog(): Log {
  const habits = db()
    .prepare("select * from habits order by created_at")
    .all()
    .map((r: any): Habit => ({
      id: r.id,
      frequency: r.frequency,
      createdAt: r.created_at,
      context: r.context,
      cue: r.cue,
      behavior: r.behavior,
      consequence: r.consequence,
      archivedAt: r.archived_at,
    }));
  const events = db()
    .prepare("select * from events order by at")
    .all()
    .map((r: any): HabitEvent => ({
      id: r.id,
      habitId: r.habit_id,
      at: r.at,
      approximate: r.approximate === 1,
      context: r.context,
      precededBy: r.preceded_by,
      effort: r.effort,
      payoffNoticed: bool(r.payoff_noticed),
      payoffNote: r.payoff_note,
    }));
  const retractions = db()
    .prepare("select * from retractions order by at")
    .all()
    .map((r: any) => ({ id: r.id, eventId: r.event_id, at: r.at }));
  const checkIns = db()
    .prepare("select * from check_ins order by at")
    .all()
    .map((r: any): CheckIn => ({ id: r.id, habitId: r.habit_id, at: r.at, items: [r.item1, r.item2, r.item3, r.item4] }));
  return { habits, events, retractions, checkIns };
}

const insertHabitStmt = () =>
  db().prepare(
    `insert or ignore into habits (id, frequency, created_at, context, cue, behavior, consequence, archived_at)
     values (@id, @frequency, @createdAt, @context, @cue, @behavior, @consequence, @archivedAt)`,
  );
const insertEventStmt = () =>
  db().prepare(
    `insert or ignore into events (id, habit_id, at, approximate, context, preceded_by, effort, payoff_noticed, payoff_note)
     values (@id, @habitId, @at, @approximate, @context, @precededBy, @effort, @payoffNoticed, @payoffNote)`,
  );
const eventRow = (e: HabitEvent) => ({ ...e, approximate: e.approximate ? 1 : 0, payoffNoticed: int(e.payoffNoticed) });

/** Applies one change. Every kind is idempotent, so a change sent twice adds nothing. Throws when the database refuses it. */
export function applyOp(op: Op): void {
  switch (op.kind) {
    case "habit":
      insertHabitStmt().run({ ...op.habit, archivedAt: null });
      return;
    case "plan": {
      // Last write wins, by when the edit was made, not when it arrived.
      const res = db()
        .prepare(
          `update habits set frequency = @frequency, context = @context, cue = @cue, behavior = @behavior, consequence = @consequence, plan_at = @at
           where id = @id and (plan_at is null or plan_at < @at)`,
        )
        .run({ ...op.plan, id: op.id, at: op.at });
      if (res.changes === 0 && !db().prepare("select 1 from habits where id = ?").get(op.id)) throw new Error("Habit not found");
      return;
    }
    case "archive": {
      // The first archive wins; archiving again changes nothing.
      const res = db().prepare("update habits set archived_at = ? where id = ? and archived_at is null").run(op.at, op.id);
      if (res.changes === 0 && !db().prepare("select 1 from habits where id = ?").get(op.id)) throw new Error("Habit not found");
      return;
    }
    case "event":
      insertEventStmt().run(eventRow(op.event));
      return;
    case "retract":
      // The unique event_id makes a second retraction of the same event a no-op; a missing event fails the foreign key.
      db().prepare("insert or ignore into retractions (id, event_id, at) values (@id, @eventId, @at)").run(op.retraction);
      return;
    case "checkIn": {
      const c = op.checkIn;
      db()
        .prepare("insert or ignore into check_ins (id, habit_id, at, item1, item2, item3, item4) values (?, ?, ?, ?, ?, ?, ?)")
        .run(c.id, c.habitId, c.at, ...c.items);
      return;
    }
  }
}

/** Idempotent: habits and events that already exist are skipped, never overwritten. */
export function importData(habits: Habit[], events: HabitEvent[]): { habits: number; events: number } {
  const h = insertHabitStmt();
  const e = insertEventStmt();
  return db().transaction(() => ({
    habits: habits.reduce((n, x) => n + h.run(x).changes, 0),
    events: events.reduce((n, x) => n + e.run(eventRow(x)).changes, 0),
  }))();
}

const SESSION_DAYS = 180;
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

/** A new session token. Only its hash is stored, so a copy of the database can't sign anyone in. */
export function createSession(): { token: string; maxAge: number } {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86_400_000);
  db().prepare("delete from sessions where expires_at < ?").run(now.toISOString());
  db().prepare("insert into sessions (token_hash, expires_at) values (?, ?)").run(tokenHash(token), expires.toISOString());
  return { token, maxAge: SESSION_DAYS * 86_400 };
}

export function hasSession(token: string): boolean {
  return (
    db().prepare("select 1 from sessions where token_hash = ? and expires_at > ?").get(tokenHash(token), new Date().toISOString()) !==
    undefined
  );
}

export function deleteSession(token: string): void {
  db().prepare("delete from sessions where token_hash = ?").run(tokenHash(token));
}

/** For the health check: the database opens and answers. */
export function ping(): void {
  db().prepare("select 1").get();
}
