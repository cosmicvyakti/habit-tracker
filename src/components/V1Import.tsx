import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useToast } from "@/components/lime/ui/toast";
import { logQuery } from "../data";
import { migrateV1, V1_KEY, V1_MIGRATED_KEY } from "../lib/migrate";
import { importV1 } from "../server/api";

async function importRaw(raw: string): Promise<string> {
  const { habits, events } = migrateV1(JSON.parse(raw));
  const added = await importV1({ data: { habits, events } });
  const n = (count: number, word: string) => (count === 1 ? `1 ${word}` : `${count} ${word.replace(/y$/, "ie")}s`);
  return `Imported ${n(added.habits, "habit")} and ${n(added.events, "log entry")} from the previous version`;
}

// Effects can run twice in development; a second run would import nothing and overwrite the message.
let autoMigrationStarted = false;

/** Imports v1 data from this origin's localStorage once, then keeps it under a new key. */
export function AutoMigrateV1() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState("");
  useEffect(() => {
    const raw = localStorage.getItem(V1_KEY);
    if (raw === null || autoMigrationStarted) return;
    autoMigrationStarted = true;
    importRaw(raw)
      .then((msg) => {
        localStorage.setItem(V1_MIGRATED_KEY, raw);
        localStorage.removeItem(V1_KEY);
        // The imported habits show up on Today too, so the toast is not the only record.
        toast.show({ title: msg });
        return queryClient.invalidateQueries({ queryKey: logQuery.queryKey });
      })
      // The v1 key stays in place, so the next load tries again.
      .catch((e) => setError(`Couldn't import data from the previous version: ${e.message}. Reload to try again.`));
  }, [queryClient, toast]);
  return error ? (
    <p role="alert" className="body mx-auto w-full max-w-2xl px-4 pt-4 text-danger-text sm:px-6">
      {error}
    </p>
  ) : null;
}
