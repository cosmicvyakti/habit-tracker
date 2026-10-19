import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.server";

describe("passwords", () => {
  const stored = hashPassword("correct horse battery staple");

  it("accepts the password and nothing else", () => {
    expect(verifyPassword("correct horse battery staple", stored)).toBe(true);
    expect(verifyPassword("correct horse battery stapl", stored)).toBe(false);
    expect(verifyPassword("", stored)).toBe(false);
  });

  it("salts each hash", () => {
    expect(hashPassword("same")).not.toBe(hashPassword("same"));
  });

  it("has no $, which Docker Compose would expand in an .env file", () => {
    expect(stored).toMatch(/^scrypt:16384:[\w-]+:[\w-]+$/);
  });

  it("refuses a malformed stored value instead of throwing", () => {
    for (const bad of ["", "scrypt", "bcrypt:1:a:b", "scrypt:3:abc:def", "scrypt:16384:abc:"]) {
      expect(verifyPassword("x", bad)).toBe(false);
    }
  });
});
