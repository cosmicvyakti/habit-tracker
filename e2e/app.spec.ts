import AxeBuilder from "@axe-core/playwright";
import { expect, Page, test } from "@playwright/test";
import { AUTH_FILE, EMAIL, PASSWORD } from "../playwright.config";

test.describe.configure({ mode: "serial" });

async function expectNoAxeViolations(page: Page) {
  // A dialog fading in has see-through text, which axe measures as low contrast. Wait out every animation that ends,
  // two frames on: Base UI starts a dialog's transition only on the frame after it opens.
  await page.evaluate(async () => {
    for (let i = 0; i < 2; i++) await new Promise(requestAnimationFrame);
    await Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    );
  });
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
}

test("define a habit with an implementation intention", async ({ page }) => {
  await page.goto("/plan");
  await page.getByRole("button", { name: "Add habit" }).click();
  await expect(page.getByText("Name the cue: what happens right before?")).toBeVisible();
  await expect(page.getByText("Name the place where you will do it.")).toBeVisible();

  await page.getByLabel("After (cue)").fill("I pour my morning coffee");
  await page.getByLabel("I will (behavior)").fill("read 20 pages");
  await page.getByLabel("At (place)").fill("the kitchen table");
  await page.getByRole("radio", { name: "Weekly" }).click();
  await expect(page.getByText("After I pour my morning coffee, I will read 20 pages at the kitchen table.")).toBeVisible();
  await page.getByRole("button", { name: "Add habit" }).click();

  await expect(page).toHaveURL("/");
  const card = page.getByRole("listitem").filter({ hasText: "read 20 pages" });
  await expect(card.getByText("After I pour my morning coffee, I will read 20 pages at the kitchen table.")).toBeVisible();
  await expect(card.getByText("Weekly", { exact: true })).toBeVisible();
  // Two habits, both still open this period: only the first one's Log is primary.
  await expect(page.locator('main [data-slot="button"][data-variant="primary"]')).toHaveCount(1);
  await expect(page.getByRole("main").getByRole("listitem").first().locator('[data-variant="primary"]')).toHaveCount(1);
});

test("log a habit in one tap, with the plan's place and cue", async ({ page }) => {
  await page.goto("/");
  const card = page.getByRole("listitem").filter({ hasText: "read 20 pages" });
  await card.getByRole("button", { name: /^Log( again)? read 20 pages$/ }).click();
  await expect(page.getByText("Logged read 20 pages")).toBeVisible();
  // The current week in the period row is now marked done.
  const pressed = card.getByRole("toolbar").getByRole("button", { pressed: true });
  await expect(pressed).toHaveCount(1);

  // Undo on the toast retracts that log, then logging again marks the week done again.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Removed that log of read 20 pages")).toBeVisible();
  await expect(pressed).toHaveCount(0);
  await card.getByRole("button", { name: /^Log( again)? read 20 pages$/ }).click();
  await expect(pressed).toHaveCount(1);

  await card.getByRole("button", { name: "More actions for read 20 pages" }).click();
  await page.getByRole("menuitem", { name: "See raw log" }).click();
  await expect(page).toHaveURL(/\/log\?habit=/);
  const rows = page.getByRole("row").filter({ hasText: "read 20 pages" });
  // The undone log stays in the log, marked retracted.
  await expect(rows.filter({ hasText: "Retracted" })).toHaveCount(1);
  const row = rows.filter({ hasNotText: "Retracted" });
  await expect(row).toHaveCount(1);
  await expect(row.getByRole("cell", { name: "the kitchen table" })).toBeVisible();
  await expect(row.getByRole("cell", { name: "I pour my morning coffee" })).toBeVisible();

  // Sorting flips between newest and oldest first, never to an unsorted state.
  const when = page.getByRole("columnheader", { name: /When/ });
  await expect(when).toHaveAttribute("aria-sort", "descending");
  await when.getByRole("button").click();
  await expect(when).toHaveAttribute("aria-sort", "ascending");
});

test("retract a log only after confirming", async ({ page }) => {
  await page.goto("/log");
  const retracted = page.getByRole("row").filter({ hasText: "read 20 pages" }).filter({ hasText: "Retracted" });
  const retractButton = page.getByRole("button", { name: /^Retract read 20 pages/ });
  await expect(retracted).toHaveCount(1);
  await expect(retractButton).toHaveCount(1);
  await retractButton.click();
  const dialog = page.getByRole("alertdialog", { name: "Retract this log of read 20 pages?" });
  await expect(dialog).toBeVisible();
  await expectNoAxeViolations(page);

  // The safe choice comes first, and keeping the log changes nothing.
  await expect(dialog.getByRole("button", { name: "Keep log" })).toBeFocused();
  await dialog.getByRole("button", { name: "Keep log" }).click();
  await expect(dialog).toBeHidden();
  await expect(retracted).toHaveCount(1);

  await retractButton.click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Retract log" }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await expect(retracted).toHaveCount(2);
  await expect(retractButton).toHaveCount(0);
});

test("complete an SRBAI check-in", async ({ page }) => {
  await page.goto("/");
  const card = page.getByRole("listitem").filter({ hasText: "read 20 pages" });
  await card.getByRole("link", { name: "Check in on automaticity" }).click();

  await expect(page.getByText("read 20 pages is something…")).toBeVisible();
  const answers = [3, 2, 4, 1];
  const items = ["I do automatically.", "I do without having to consciously remember.", "I do without thinking.", "I start doing before I realize I'm doing it."];
  for (const [i, item] of items.entries()) {
    // The scale's ends also carry "strongly disagree" and "strongly agree" in their names.
    await page.getByRole("radiogroup", { name: item }).getByRole("radio", { name: new RegExp(`^${answers[i]}\\b`) }).click();
  }
  await expect(page.getByText("Score: 2.50 out of 7")).toBeVisible();
  await page.getByRole("button", { name: "Save check-in" }).click();

  await expect(page).toHaveURL(/\/insights\?habit=/);
  await expect(page.getByText("1 of 3 check-ins so far.")).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("listitem").filter({ hasText: "read 20 pages" }).getByRole("link", { name: "Check in on automaticity" })).toHaveCount(0);
});

test("view the automaticity curve and plateau", async ({ page }) => {
  await page.goto("/insights?habit=seed-stretch");
  const chart = page.getByRole("img", { name: /Automaticity over time/ });
  await expect(chart).toBeVisible();
  // Every circle is a check-in and the only path is the fitted curve.
  await expect(chart.locator("circle")).toHaveCount(5);
  await expect(chart.locator("path")).toHaveCount(1);
  await expect(page.getByText(/Estimated plateau:/)).toBeVisible();
  await expect(page.getByText(/Automaticity levels off near/)).toBeVisible();
});

test("log offline, then sync when the server answers again", async ({ page, browser }) => {
  const rows = (n: number) => page.getByText(`Logged events, ${n} rows`);
  await page.goto("/log?habit=seed-stretch");
  const caption = await page.locator("caption").textContent();
  const before = Number(caption?.match(/(\d+) rows/)?.[1]);

  // Every server call fails, as it does with no connection; the app's own files still load.
  await page.route("**/_serverFn/**", (route) => route.abort("internetdisconnected"));
  await page.getByRole("link", { name: "Today" }).click();
  await page.getByRole("button", { name: /^Log( again)? stretch for 5 minutes$/ }).click();
  await expect(page.getByText("Logged stretch for 5 minutes")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Offline. 1 change waiting to sync." })).toBeVisible();

  // The change survives a reload while still offline.
  await page.goto("/log?habit=seed-stretch");
  await expect(rows(before + 1)).toBeVisible();

  await page.unroute("**/_serverFn/**");
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByRole("status").filter({ hasText: "waiting" })).toHaveCount(0);

  // A fresh browser, with nothing saved on the device, sees it from the server.
  const other = await browser.newPage({ storageState: AUTH_FILE });
  await other.goto("/log?habit=seed-stretch");
  await expect(other.getByText(`Logged events, ${before + 1} rows`)).toBeVisible();
  await other.close();
});

test("first open on a new device with no connection says so, then loads when it can", async ({ page }) => {
  // Each test starts signed in, with nothing saved on the device: a new phone, say.
  await page.route("**/_serverFn/**", (route) => route.abort("internetdisconnected"));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Couldn't load your habits", level: 1 })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "The server didn't answer" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
  await expectNoAxeViolations(page);

  // Try again with the server still unreachable leaves the message up and the button usable.
  const retry = page.getByRole("button", { name: "Try again" });
  await retry.click();
  await expect(retry).toBeEnabled();
  await expect(page.getByRole("heading", { name: "Couldn't load your habits", level: 1 })).toBeVisible();

  // Back online: it loads without a tap.
  await page.unroute("**/_serverFn/**");
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "stretch for 5 minutes" })).toBeVisible();
});

test("an unknown address shows a page, not a bare error", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect(page.getByRole("heading", { name: "Page not found", level: 1 })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("link", { name: "Go to Today" }).click();
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
});

test("open the installed app with no connection", async ({ page, context }) => {
  const manifest = await (await page.request.get("/manifest.webmanifest")).json();
  expect(manifest.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes} ${i.purpose}`)).toEqual([
    "192x192 any",
    "512x512 any",
    "512x512 maskable",
  ]);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "stretch for 5 minutes" })).toBeVisible();
  // A page not opened yet still loads: the worker cached every built file when it installed.
  await page.getByRole("link", { name: "Insights" }).click();
  await expect(page.getByRole("heading", { name: "Insights", level: 1 })).toBeVisible();
  await context.setOffline(false);
});

test("the installed app, offline with nothing saved, says it's offline and loads when the connection returns", async ({ page, context }) => {
  await page.goto("/");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.evaluate(() => localStorage.removeItem("habit-tracker:log"));

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Couldn't load your habits", level: 1 })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "You're offline" })).toBeVisible();

  // The browser's own online event, not a tap, brings the data in.
  await context.setOffline(false);
  await expect(page.getByRole("heading", { name: "stretch for 5 minutes" })).toBeVisible();
});

test("sign in again after the session ends, without losing a change", async ({ page, context }) => {
  await page.goto("/log?habit=seed-stretch");
  const before = Number((await page.locator("caption").textContent())?.match(/(\d+) rows/)?.[1]);
  await page.getByRole("link", { name: "Today" }).click();

  await context.clearCookies();
  await page.getByRole("button", { name: /^Log( again)? stretch for 5 minutes$/ }).click();
  const status = page.getByRole("status").filter({ hasText: "Signed out." });
  await expect(status).toContainText("1 change waiting to sync.");

  await status.getByRole("link", { name: "Sign in again" }).click();
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("status").filter({ hasText: "Signed out" })).toHaveCount(0);

  await page.goto("/log?habit=seed-stretch");
  await expect(page.getByText(`Logged events, ${before + 1} rows`)).toBeVisible();
});

test("too many wrong passwords lock sign-in for that address", async ({ browser }) => {
  // Its own address, as Cloudflare would report it, so the lock can't reach the other tests.
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    extraHTTPHeaders: { "cf-connecting-ip": "203.0.113.9" },
  });
  const page = await context.newPage();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(EMAIL);
  const alert = page.getByRole("alert");
  for (let i = 0; i < 10; i++) {
    await page.getByLabel("Password").fill(`wrong ${i}`);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(alert).toHaveText(/don't match/);
  }
  // Locked: even the right password is refused now.
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(alert).toHaveText("Too many tries. Wait 15 minutes, then try again.");
  await expect(page).toHaveURL("/sign-in");
  await context.close();
});

const ROUTES = [
  "/",
  "/plan",
  "/plan?habit=seed-stretch",
  "/check-in",
  "/check-in?habit=seed-stretch",
  "/insights?habit=seed-stretch",
  "/log",
  "/log?habit=seed-stretch",
];

for (const theme of ["light", "dark"]) {
  for (const route of ROUTES) {
    test(`axe reports no violations on ${route} in the ${theme} theme`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem("habit-tracker:theme", t), theme);
      await page.goto(route);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // Open every collapsible, not menus or selects, so axe also checks the controls inside.
      const closed = page.locator('main button[aria-expanded="false"]:not([aria-haspopup])');
      while ((await closed.count()) > 0) {
        await closed.first().click();
      }
      await expectNoAxeViolations(page);
      // Lime allows one primary button per view.
      expect(await page.locator('[data-slot="button"][data-variant="primary"]').count()).toBeLessThanOrEqual(1);
    });
  }
}

test("the theme follows the system until the user picks one", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "dark");
  const toggle = page.getByRole("button", { name: "Dark theme" });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  await toggle.click();
  await expect(html).toHaveAttribute("data-theme", "light");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "light");
});

test("on a phone, the menu opens every place over the page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("complementary", { name: "Sidebar" })).toBeHidden();
  const menu = page.getByRole("button", { name: "Open navigation" });
  await menu.click();
  const nav = page.getByRole("dialog", { name: "Navigation" });
  await expect(nav.getByRole("link", { name: "Today" })).toHaveAttribute("aria-current", "page");
  await expectNoAxeViolations(page);

  await nav.getByRole("link", { name: "Insights" }).click();
  await expect(page).toHaveURL(/\/insights/);
  await expect(nav).toBeHidden();
  await expect(menu).toBeFocused();
});

test("a page left open across a deploy offers a reload", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
  const notice = page.getByText("Habit tracker has been updated");
  const comeBack = async () => {
    const checked = page.waitForResponse((r) => r.url().endsWith("/?build"));
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await checked;
  };

  // Coming back with nothing new deployed says nothing.
  await comeBack();
  await expect(notice).toHaveCount(0);

  // A deploy renames the built files. Routed on the context, so the service worker's fetch is caught too.
  await context.route("**/?build", (route) =>
    route.fulfill({ contentType: "text/html", body: '<!DOCTYPE html><script type="module" src="/assets/index-new.js"></script>' }),
  );
  await comeBack();
  await expect(notice).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Reload app" }).click();
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
  await expect(notice).toHaveCount(0);
  await context.unroute("**/?build");
});

// Runs next to last: it archives every habit, which the tests above need.
test("archive every habit, then the empty states", async ({ page }) => {
  await page.goto("/");
  const cards = page.getByRole("main").getByRole("listitem");
  for (const name of ["stretch for 5 minutes", "read 20 pages"]) {
    await page.getByRole("button", { name: `More actions for ${name}` }).click();
    await page.getByRole("menuitem", { name: "Archive habit" }).click();
    const dialog = page.getByRole("alertdialog", { name: `Archive ${name}?` });
    await expect(dialog.getByRole("button", { name: "Keep habit" })).toBeFocused();
    await expectNoAxeViolations(page);
    await dialog.getByRole("button", { name: "Archive habit" }).click();
    await expect(dialog).toBeHidden();
    await expect(cards.filter({ hasText: name })).toHaveCount(0);
  }

  await expect(page.getByRole("heading", { name: "No habits yet" })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.goto("/insights");
  await expect(page.getByRole("heading", { name: "No habits yet" })).toBeVisible();
  await expectNoAxeViolations(page);
  // The archived habit's log stays.
  await page.goto("/log");
  await expect(page.getByRole("row").filter({ hasText: "stretch for 5 minutes" }).first()).toBeVisible();
});

// Runs last: signing out ends the session every other test shares.
test("sign out clears this device", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("habit-tracker:log"))).not.toBeNull();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/sign-in");
  const saved = await page.evaluate(() => [localStorage.getItem("habit-tracker:log"), localStorage.getItem("habit-tracker:outbox")]);
  expect(saved).toEqual([null, null]);
  await page.goto("/log");
  await expect(page).toHaveURL("/sign-in");
});
