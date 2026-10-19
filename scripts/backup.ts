// Copies the database to a file, safely while the app is running (SQLite's online backup).
// Usage: node scripts/backup.ts <destination file>. Reads HABITS_DB, like the server.
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const dest = process.argv[2];
if (!dest) {
  console.error("Usage: node scripts/backup.ts <destination file>");
  process.exit(1);
}
mkdirSync(dirname(dest), { recursive: true });
const db = new Database(process.env.HABITS_DB ?? "data/habits.db", { readonly: true, fileMustExist: true });
await db.backup(dest);
db.close();
console.log(`Backed up to ${dest}`);
