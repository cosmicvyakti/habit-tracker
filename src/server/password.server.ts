import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// scrypt from Node's standard library. The stored form names its cost, so it can rise later
// without breaking existing hashes: scrypt:<N>:<salt>:<hash>, base64url. Colons, not the usual $,
// because Docker Compose expands $ in .env files.
const N = 16384;
const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password.normalize("NFKC"), salt, KEY_LENGTH, { N });
  return ["scrypt", N, salt.toString("base64url"), hash.toString("base64url")].join(":");
}

/** Constant-time. False for a malformed stored value rather than throwing. */
export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, cost, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  try {
    const actual = scryptSync(password.normalize("NFKC"), Buffer.from(salt, "base64url"), expected.length, { N: Number(cost) });
    return timingSafeEqual(actual, expected);
  } catch {
    return false; // A cost scrypt rejects, or an empty hash.
  }
}
