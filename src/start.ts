import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";
import { cameThroughProxy } from "./server/auth.server";

// Blocks cross-site calls to the server functions, so another site can't act with the session cookie.
const csrf = createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" });

// A 404, the same as an unknown path, so a direct caller learns nothing.
const proxy = createMiddleware().server(({ request, next }) =>
  cameThroughProxy(request) ? next() : new Response("Not found", { status: 404 }),
);

// Render in the browser only: every view buckets the log by the user's local time zone.
// Server functions still own all reads and writes.
export const startInstance = createStart(() => ({ defaultSsr: false, requestMiddleware: [proxy, csrf] }));
