// Prints the HABITS_PASSWORD_HASH for a password. Usage: npm run hash-password
// Type the password at the prompt (it isn't shown), or pipe it in.
import { createInterface } from "node:readline";
import { hashPassword } from "../src/server/password.server.ts";

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
if (process.stdin.isTTY) {
  process.stdout.write("Password: ");
  // Hide what's typed: readline echoes through this method.
  (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = () => {};
}
rl.once("line", (password) => {
  rl.close();
  if (process.stdin.isTTY) process.stdout.write("\n");
  if (password.length < 12) {
    console.error("Use at least 12 characters: the sign-in page is on the public internet.");
    process.exit(1);
  }
  console.log(hashPassword(password));
});
