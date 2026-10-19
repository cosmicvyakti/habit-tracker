import { type QueryClient, queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useSyncExternalStore } from "react";
import type { Log } from "./lib/model";
import { withOps } from "./lib/ops";
import { type Op, opSchema } from "./lib/schema";
import { isSignedOut } from "./lib/session";
import { getLog, getSession, pushOps } from "./server/api";

// Local-first writes: a change lands in the outbox, shows at once, and syncs when the server
// answers. The outbox and the last log from the server are kept on the device, so the app
// opens and logs offline.

const LOG_KEY = "habit-tracker:log";
const OUTBOX_KEY = "habit-tracker:outbox";
const RETRY_MS = 30_000;
const BATCH = 100;

const read = <T>(key: string): T | undefined => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
};

/** The base log is only a cache of the server's, so a full device just means no offline copy. */
function saveLog(log: Log) {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
  } catch {
    // shortcut: localStorage holds about 5 MB, roughly 20,000 events; move the cache to IndexedDB past that.
  }
}

export const logQuery = queryOptions({
  queryKey: ["log"],
  queryFn: async () => {
    const log = await getLog();
    saveLog(log);
    return log;
  },
  // Show the saved copy at once, then refetch: updatedAt 0 marks it stale.
  initialData: () => (typeof localStorage === "undefined" ? undefined : read<Log>(LOG_KEY)),
  initialDataUpdatedAt: 0,
});

export type SyncProblem = "offline" | "signed-out" | null;
export interface SyncState {
  pending: number;
  problem: SyncProblem;
}

let outbox: Op[] = (typeof localStorage !== "undefined" && read<Op[]>(OUTBOX_KEY)) || [];
let state: SyncState = { pending: outbox.length, problem: null };
const listeners = new Set<() => void>();
let client: QueryClient | undefined;
let notify: (message: string) => void = () => {};
let flushing = false;
let retry: ReturnType<typeof setTimeout> | undefined;

function set(next: Op[], problem: SyncProblem) {
  outbox = next;
  state = { pending: next.length, problem };
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(next));
  } catch {
    notify("This device couldn't save your change for offline use. Stay online until it syncs.");
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Queue a change. It shows at once and syncs in the background, in the order it was made. */
export function enqueue(op: Op) {
  set([...outbox, opSchema.parse(op)], state.problem);
  void flush();
}

/** Sends the outbox, oldest first. One flush at a time; a change queued meanwhile goes out in the same run. */
async function flush() {
  if (flushing || !client) return;
  flushing = true;
  clearTimeout(retry);
  try {
    while (outbox.length) {
      const batch = outbox.slice(0, BATCH);
      let results: ("ok" | "rejected")[];
      try {
        results = await pushOps({ data: { ops: batch } });
      } catch (e) {
        // Signed out: wait for sign-in, which flushes again. Anything else: assume no connection and retry.
        if (isSignedOut(e)) {
          session = false;
          set(outbox, "signed-out");
        } else {
          set(outbox, "offline");
          retry = setTimeout(flush, RETRY_MS);
        }
        return;
      }
      const accepted = batch.filter((_, i) => results[i] === "ok");
      // Fold the accepted changes into the saved log before dropping them, so nothing flickers out.
      client.setQueryData(logQuery.queryKey, (base) => {
        if (!base) return base;
        const log = withOps(base, accepted);
        saveLog(log);
        return log;
      });
      set(outbox.slice(batch.length), null);
      const rejected = batch.length - accepted.length;
      if (rejected)
        notify(
          `The server refused ${rejected === 1 ? "1 change" : `${rejected} changes`}, so ${rejected === 1 ? "it was" : "they were"} dropped.`,
        );
    }
    // Picks up changes from other devices, and replaces a fetch that started before this push landed.
    await client.invalidateQueries({ queryKey: logQuery.queryKey });
  } finally {
    flushing = false;
  }
}

/** Sends queued changes now, for example right after signing in. */
export const syncNow = () => void flush();

// Known once the server has said so; until then, ask. Stays unknown offline.
let session: boolean | undefined;

/** Whether to show the app or the sign-in page. Offline, the app opens on what this device has saved. */
export async function signedIn(): Promise<boolean> {
  if (session) return true;
  try {
    session = (await getSession()).signedIn;
    return session;
  } catch {
    return true;
  }
}

export function markSignedIn() {
  session = true;
  set(outbox, null);
}

/** After signing out: forget everything this device saved, so the next person to use it sees nothing. */
export function clearDevice() {
  session = false;
  clearTimeout(retry);
  set([], null);
  localStorage.removeItem(LOG_KEY);
  localStorage.removeItem(OUTBOX_KEY);
  client?.clear();
}

/** Starts syncing: now, when the browser comes back online, and when the app returns to the foreground. */
export function startSync(queryClient: QueryClient, onMessage: (message: string) => void) {
  client = queryClient;
  notify = onMessage;
  const kick = () => void flush();
  const onVisible = () => document.visibilityState === "visible" && kick();
  window.addEventListener("online", kick);
  document.addEventListener("visibilitychange", onVisible);
  kick();
  return () => {
    window.removeEventListener("online", kick);
    document.removeEventListener("visibilitychange", onVisible);
    clearTimeout(retry);
  };
}

export function useSyncState() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

/** The server's log with the queued changes on top: what the user has done, synced or not. */
export function useLog() {
  const base = useSuspenseQuery(logQuery).data;
  const ops = useSyncExternalStore(
    subscribe,
    () => outbox,
    () => outbox,
  );
  return useMemo(() => withOps(base, ops), [base, ops]);
}

export const newId = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
