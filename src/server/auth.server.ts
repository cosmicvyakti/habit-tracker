import { createHash, timingSafeEqual } from "node:crypto";
import { deleteCookie, getCookie, getRequestHeader, getRequestIP, setCookie } from "@tanstack/react-start/server";
import { SIGNED_OUT } from "../lib/session";
import { createSession, deleteSession, hasSession } from "./db.server";
import { verifyPassword } from "./password.server";

// One account, set on the server: HABITS_EMAIL and HABITS_PASSWORD_HASH (from `npm run hash-password`).
// HABITS_AUTH=off runs without sign-in, for local development only. Anything else without both
// values is a configuration error: every request fails and the health check says why.

const COOKIE = "habit_session";
const off = () => process.env.HABITS_AUTH === "off";

export function configError(): string | null {
  if (off() || (process.env.HABITS_EMAIL && process.env.HABITS_PASSWORD_HASH)) return null;
  return "Sign-in isn't configured. Set HABITS_EMAIL and HABITS_PASSWORD_HASH, or HABITS_AUTH=off for local development.";
}

export function isSignedIn(): boolean {
  const problem = configError();
  if (problem) throw new Error(problem);
  if (off()) return true;
  const token = getCookie(COOKIE);
  return token !== undefined && hasSession(token);
}

/** For every server function that reads or writes the log. */
export function requireSession(): void {
  if (!isSignedIn()) throw new Error(SIGNED_OUT);
}

// Failed sign-ins per client, in memory. Behind Cloudflare, Cf-Connecting-IP is the visitor's
// address and the client can't set it. Without Cloudflare, the last X-Forwarded-For entry is the
// one nginx added; earlier entries come from the client. The socket address would be nginx's own,
// shared by everyone, so it's the last resort.
// shortcut: resets when the server restarts and is per process; fine for one container.
const LIMIT = 10;
const WINDOW_MS = 15 * 60_000;
const failures = new Map<string, { count: number; until: number }>();

const sha = (s: string) => createHash("sha256").update(s).digest();

export function signIn(email: string, password: string): "ok" | "wrong" | "locked" {
  if (off()) return "ok";
  const problem = configError();
  if (problem) throw new Error(problem);
  const client =
    getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",").pop()?.trim() ?? getRequestIP() ?? "unknown";
  const now = Date.now();
  for (const [key, entry] of failures) if (entry.until <= now) failures.delete(key);
  const f = failures.get(client);
  if (f && f.until > now && f.count >= LIMIT) return "locked";

  // Check both, always, so the time taken doesn't say which one was wrong.
  const emailOk = timingSafeEqual(sha(email.trim().toLowerCase()), sha(process.env.HABITS_EMAIL!.trim().toLowerCase()));
  const passwordOk = verifyPassword(password, process.env.HABITS_PASSWORD_HASH!);
  if (!emailOk || !passwordOk) {
    failures.set(client, { count: f && f.until > now ? f.count + 1 : 1, until: now + WINDOW_MS });
    return "wrong";
  }
  failures.delete(client);
  const { token, maxAge } = createSession();
  setCookie(COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge });
  return "ok";
}

export function signOut(): void {
  const token = getCookie(COOKIE);
  if (token) deleteSession(token);
  deleteCookie(COOKIE, { path: "/" });
}

/**
 * Apps on the quicksilver server share one Docker network, so another container could call this one
 * directly. nginx adds a per-app secret to every request it proxies; a request without it didn't come
 * through nginx. QS_PROXY_SECRET unset means no check, as on a laptop. The health check is exempt,
 * because Docker runs it from inside the container.
 */
export function cameThroughProxy(request: Request): boolean {
  const secret = process.env.QS_PROXY_SECRET;
  if (!secret || new URL(request.url).pathname === "/api/health") return true;
  return timingSafeEqual(sha(request.headers.get("x-quicksilver-proxy") ?? ""), sha(secret));
}
