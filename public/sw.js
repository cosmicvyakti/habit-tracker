// Lets the app open with no connection. scripts/build-sw.ts fills in VERSION and PRECACHE after
// each build, so a deploy installs a new worker that fetches the new files and drops the old ones.
// Data never passes through here: server functions and /api go straight to the network, and the
// app keeps its own copy of the log (src/data.ts).
const VERSION = "__VERSION__";
const PRECACHE = __PRECACHE__;
const CACHE = `habit-tracker-${VERSION}`;
// Every route renders in the browser from the same HTML shell, so one cached copy serves them all.
const SHELL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([SHELL, ...PRECACHE])));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("habit-tracker-") && k !== CACHE).map((k) => caches.delete(k))))
      // Take over the page that installed this worker, so it works offline from the first visit.
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_serverFn") || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    // Network first, so a deploy shows at once; the cached shell when there's no connection.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then((cache) => cache.put(SHELL, copy)));
          }
          return response;
        })
        .catch(() => caches.match(SHELL)),
    );
    return;
  }
  // Built files have content hashes in their names, so a cached copy is never stale. After a deploy,
  // this worker serves the new shell until the tabs close, so it also keeps new built files it fetches.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ??
        fetch(request).then((response) => {
          if (response.ok && url.pathname.startsWith("/assets/")) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
          }
          return response;
        }),
    ),
  );
});
