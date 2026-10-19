import { z } from "zod";

/** The error message a server function throws when the session is missing or expired. */
export const SIGNED_OUT = "Signed out";

export const isSignedOut = (e: unknown) => e instanceof Error && e.message.includes(SIGNED_OUT);

export const signInSchema = z.object({
  email: z.string().trim().min(1, "Enter your email.").max(200),
  password: z.string().min(1, "Enter your password.").max(200),
});
