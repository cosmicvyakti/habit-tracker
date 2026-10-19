// Runs after `vite build`: writes the list of built client files and a version into dist/client/sw.js.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = "dist/client";
const sw = join(root, "sw.js");
const files = (readdirSync(root, { recursive: true, withFileTypes: true }) as import("node:fs").Dirent[])
  .filter((d) => d.isFile())
  .map((d) => join(d.parentPath, d.name))
  // .woff is the old-browser fallback for each .woff2; nothing that runs a service worker asks for it.
  .filter((f) => f !== sw && !f.endsWith(".map") && !f.endsWith(".woff") && !relative(root, f).startsWith("."))
  .sort();

// The version changes whenever any file does, which is what makes browsers install the new worker.
const hash = createHash("sha256");
for (const f of files) hash.update(f).update(readFileSync(f));
const urls = files.map((f) => "/" + relative(root, f).split("\\").join("/"));

const source = readFileSync(sw, "utf8");
if (!source.includes("__PRECACHE__")) throw new Error(`${sw} has no __PRECACHE__ placeholder; was it already filled in?`);
writeFileSync(sw, source.replace('"__VERSION__"', JSON.stringify(hash.digest("hex").slice(0, 12))).replace("__PRECACHE__", JSON.stringify(urls)));
console.log(`sw.js: ${urls.length} files to precache`);
