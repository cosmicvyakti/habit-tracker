import { defineConfig } from "@playwright/test";
import { hashPassword } from "./src/server/password.server";

const PORT = 3200;
export const EMAIL = "me@example.com";
export const PASSWORD = "correct horse battery staple";
export const AUTH_FILE = ".e2e/auth.json";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    // Signs in once, through the real form, and saves the session cookie for the tests.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "app", testMatch: /app\.spec\.ts/, dependencies: ["setup"], use: { storageState: AUTH_FILE } },
  ],
  webServer: {
    command: `npm run build && node e2e/seed.ts && npm start -- --port=${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    env: { HABITS_DB: ".e2e/habits.db", HABITS_EMAIL: EMAIL, HABITS_PASSWORD_HASH: hashPassword(PASSWORD) },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
