import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { signInSchema } from "../lib/session";
import * as auth from "./auth.server";
import * as db from "./db.server";
import { applyOps } from "./ops.server";

/** Every function that reads or writes the log runs behind this. */
const signedIn = createMiddleware({ type: "function" }).server(({ next }) => {
  auth.requireSession();
  return next();
});

export const getLog = createServerFn({ method: "GET" })
  .middleware([signedIn])
  .handler(() => db.readLog());

/** Every write goes through here, as a batch of changes queued in the browser. Each one is checked on its own in applyOps. */
export const pushOps = createServerFn({ method: "POST" })
  .middleware([signedIn])
  .validator(z.object({ ops: z.array(z.unknown()).min(1).max(100) }))
  .handler(({ data }) => applyOps(data.ops));

export const getSession = createServerFn({ method: "GET" }).handler(() => ({ signedIn: auth.isSignedIn(), email: auth.accountEmail() }));

export const signIn = createServerFn({ method: "POST" })
  .validator(signInSchema)
  .handler(({ data }) => auth.signIn(data.email, data.password));

export const signOut = createServerFn({ method: "POST" }).handler(() => auth.signOut());
