import AxeBuilder from "@axe-core/playwright";
import { writeFileSync } from "node:fs";
import { expect, test as setup } from "@playwright/test";
import { AUTH_FILE, EMAIL, PASSWORD } from "../playwright.config";

setup("sign in, after a wrong password is refused", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL("/sign-in");
  await expect(page.getByRole("heading", { name: "Sign in", level: 1 })).toBeVisible();
  // No navigation before signing in: every link would lead back here.
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);

  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Enter your email.")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeFocused();

  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill("not the password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toHaveText("That email and password don't match. Check both, then try again.");
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => v.id)).toEqual([]);

  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();

  // The cookie only: a saved log or queue would leak between tests.
  const { cookies } = await page.context().storageState();
  expect(cookies.map((c) => [c.name, c.httpOnly, c.sameSite])).toEqual([["habit_session", true, "Lax"]]);
  writeFileSync(AUTH_FILE, JSON.stringify({ cookies, origins: [] }));
});
