import AxeBuilder from "@axe-core/playwright";
import { Browser, expect, Page, test } from "@playwright/test";
import { AUTH_FILE, EMAIL, PASSWORD } from "../playwright.config";

test.describe.configure({ mode: "serial" });

async function expectNoAxeViolations(page: Page, skip: string[] = []) {
  // A dialog fading in has see-through text, which axe measures as low contrast. Wait for a frame where nothing moves:
  // Base UI starts a dialog's transition a frame or more after it opens, later still on a busy machine.
  await page.evaluate(async () => {
    const moving = () =>
      document.querySelector("[data-starting-style], [data-ending-style]") !== null ||
      document.getAnimations().some((a) => a.playState === "running" && a.effect?.getComputedTiming().endTime !== Infinity);
    do await new Promise(requestAnimationFrame);
    while (moving());
  });
  const { violations } = await new AxeBuilder({ page }).disableRules(skip).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
}

const DAY = 86_400_000;
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n: number) => dayKey(new Date(Date.now() - n * DAY));
const check = (page: Page, behavior: RegExp) => page.getByRole("checkbox", { name: behavior });
const STRETCH = /^Stretch for 5 minutes/;

/** The habit's events on the server, as a fresh browser with nothing saved on the device loads them. */
async function serverEvents(browser: Browser, habitId: string) {
  const fresh = await browser.newPage({ storageState: AUTH_FILE });
  await fresh.goto("/");
  await expect(check(fresh, STRETCH)).toBeVisible();
  const n = await fresh.evaluate((id) => {
    const log = JSON.parse(localStorage.getItem("habit-tracker:log")!) as {
      events: { id: string; habitId: string }[];
      retractions: { eventId: string }[];
    };
    const retracted = new Set(log.retractions.map((r) => r.eventId));
    return log.events.filter((e) => e.habitId === id && !retracted.has(e.id)).length;
  }, habitId);
  await fresh.close();
  return n;
}

test("add a habit with just a name and how often", async ({ page }) => {
  await page.goto("/habits");
  await page.getByRole("button", { name: "Add habit" }).first().click();
  const dialog = page.getByRole("dialog", { name: "New habit" });
  await dialog.getByRole("button", { name: "Add habit" }).click();
  await expect(dialog.getByText("Name the habit.")).toBeVisible();
  await expect(dialog.getByLabel("Name")).toBeFocused();
  await expectNoAxeViolations(page);

  await dialog.getByLabel("Name").fill("read 20 pages");
  await dialog.getByRole("radio", { name: "Weekly" }).click();
  await dialog.getByRole("button", { name: "Add habit" }).click();
  await expect(dialog).toBeHidden();
  const row = page.getByRole("main").getByRole("button", { name: /^Read 20 pages/ });
  await expect(row).toContainText("Weekly · since");

  // The row opens the same form on the habit.
  await row.click();
  const edit = page.getByRole("dialog", { name: "Edit habit" });
  await expect(edit.getByLabel("Name")).toHaveValue("read 20 pages");
  await expect(edit.getByRole("radio", { name: "Weekly" })).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(edit).toBeHidden();
  await expect(row).toBeFocused();
  // Saving lights the row up and hands focus back to it too.
  await row.click();
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(edit).toBeHidden();
  await expect(row).toBeFocused();
});

test("check a habit off on Today: it stays put as the check draws, then moves to Completed", async ({ page }) => {
  await page.goto("/");
  const todo = page.getByRole("region", { name: /^To do/ });
  const done = page.getByRole("region", { name: /^Completed/ });
  const read = check(page, /^Read 20 pages/);
  await expect(read).toHaveAttribute("aria-checked", "false");
  await read.click();
  await expect(read).toHaveAttribute("aria-checked", "true");
  await expect(todo.getByRole("checkbox", { name: /^Read 20 pages/ })).toBeVisible();
  await expect(done.getByRole("checkbox", { name: /^Read 20 pages/ })).toBeVisible();
  await expect(todo.getByRole("checkbox", { name: /^Read 20 pages/ })).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Checked off read 20 pages." })).toBeAttached();

  // Clearing it is one tap back, and the toast's Undo checks it again.
  await done.getByRole("checkbox", { name: /^Read 20 pages/ }).click();
  await expect(todo.getByRole("checkbox", { name: /^Read 20 pages/ })).toHaveAttribute("aria-checked", "false");
  await page.locator('[data-slot="toast"]').filter({ hasText: "Cleared read 20 pages" }).getByRole("button", { name: "Undo" }).click();
  await expect(done.getByRole("checkbox", { name: /^Read 20 pages/ })).toHaveAttribute("aria-checked", "true");
});

test("pick another day of the week and check a habit off for it", async ({ page }) => {
  await page.goto(`/?day=${daysAgo(1)}`);
  await expect(page.getByRole("heading", { name: "Yesterday", level: 1 })).toBeVisible();
  const day = page.getByRole("radiogroup", { name: "Day" });
  await expect(day.getByRole("radio", { checked: true })).toHaveAccessibleName(/0 of 1 daily habits done/);
  await expect(page.getByRole("button", { name: "Next week" })).toBeEnabled({ enabled: new Date().getDay() === 1 });

  await check(page, STRETCH).click();
  const done = page.getByRole("region", { name: /^Completed/ }).getByRole("checkbox", { name: STRETCH });
  // A past day's check has no real time, so it says only that it was done.
  await expect(done).toContainText(/Done$/);
  await expect(day.getByRole("radio", { checked: true })).toHaveAccessibleName(/1 of 1 daily habits done/);

  await page.getByRole("link", { name: "Go to today" }).click();
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
  const today = day.locator('[aria-current="date"]');
  await expect(today).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: "Next week" })).toBeDisabled();
  // A step back is a week back, on the same weekday.
  await page.getByRole("button", { name: "Previous week" }).click();
  await expect(page).toHaveURL(`/?day=${daysAgo(7)}`);
});

test("stats switch between week, month, quarter and year", async ({ page }) => {
  await page.goto("/stats");
  await expect(page.getByRole("heading", { name: "Completion" })).toBeVisible();
  await expect(page.getByRole("region", { name: "By habit" }).getByText("Stretch for 5 minutes")).toBeVisible();
  // A week has no calendar: its seven days are the chart.
  await expect(page.getByRole("heading", { name: "Daily habits" })).toHaveCount(0);

  await page.getByRole("radio", { name: "Month" }).click();
  await expect(page).toHaveURL("/stats?range=month");
  await expect(page.getByRole("heading", { name: "Daily habits" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next month" })).toBeDisabled();
  await page.getByRole("button", { name: "Previous month" }).click();
  await expect(page).toHaveURL(/range=month&at=/);
  await expect(page.getByRole("button", { name: "Next month" })).toBeEnabled();
  await page.getByRole("radio", { name: "Year" }).click();
  await expect(page.getByRole("heading", { name: "By month" })).toBeVisible();
});

test("log offline, then sync when the server answers again", async ({ page, browser }) => {
  const before = await serverEvents(browser, "seed-stretch");
  await page.goto("/");
  await expect(check(page, STRETCH)).toHaveAttribute("aria-checked", "false");

  // Every server call fails, as it does with no connection; the app's own files still load.
  await page.route("**/_serverFn/**", (route) => route.abort("internetdisconnected"));
  await check(page, STRETCH).click();
  await expect(page.getByRole("status").filter({ hasText: "Offline. 1 change waiting to sync." })).toBeVisible();

  // The change survives a reload while still offline.
  await page.reload();
  await expect(check(page, STRETCH)).toHaveAttribute("aria-checked", "true");

  await page.unroute("**/_serverFn/**");
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByRole("status").filter({ hasText: "waiting" })).toHaveCount(0);
  expect(await serverEvents(browser, "seed-stretch")).toBe(before + 1);
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
  await expect(page.getByRole("main").getByText(/stretch for 5 minutes/i).first()).toBeVisible();
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
  // An installed app's navigation bar and launch screen take these, whatever the app's theme: pinned to dark.
  expect([manifest.theme_color, manifest.background_color]).toEqual(["#1f1f1c", "#1f1f1c"]);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("main").getByText(/stretch for 5 minutes/i).first()).toBeVisible();
  // A page not opened yet still loads: the worker cached every built file when it installed.
  await page.getByRole("link", { name: "Stats" }).click();
  await expect(page.getByRole("heading", { name: "Stats", level: 1 })).toBeVisible();
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
  await expect(page.getByRole("main").getByText(/stretch for 5 minutes/i).first()).toBeVisible();
});

test("sign in again after the session ends, without losing a change", async ({ page, context, browser }) => {
  const before = await serverEvents(browser, "seed-stretch");
  await page.goto(`/?day=${daysAgo(2)}`);
  await expect(check(page, STRETCH)).toHaveAttribute("aria-checked", "false");

  await context.clearCookies();
  await check(page, STRETCH).click();
  const status = page.getByRole("status").filter({ hasText: "Signed out." });
  await expect(status).toContainText("1 change waiting to sync.");

  await status.getByRole("link", { name: "Sign in again" }).click();
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("status").filter({ hasText: "Signed out" })).toHaveCount(0);
  expect(await serverEvents(browser, "seed-stretch")).toBe(before + 1);
});

test("checks made offline in two tabs both sync", async ({ page, context, browser }) => {
  const before = await serverEvents(browser, "seed-stretch");
  await page.goto(`/?day=${daysAgo(3)}`);
  const second = await context.newPage();
  await second.goto(`/?day=${daysAgo(4)}`);
  await expect(check(second, STRETCH)).toHaveAttribute("aria-checked", "false");
  const status = (p: Page, text: string) => p.getByRole("status").filter({ hasText: text });

  // No connection in either tab: the installed app and a browser tab, say. Each checks a day off.
  await context.route("**/_serverFn/**", (route) => route.abort("internetdisconnected"));
  await check(page, STRETCH).click();
  await expect(status(page, "Offline. 1 change waiting to sync.")).toBeVisible();
  await check(second, STRETCH).click();
  await expect(status(second, "Offline. 2 changes waiting to sync.")).toBeVisible();

  // The first tab closes before it could sync; the second one sends both.
  await page.close();
  await context.unroute("**/_serverFn/**");
  await second.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(status(second, "waiting")).toHaveCount(0);
  expect(await serverEvents(browser, "seed-stretch")).toBe(before + 2);
});

test("a habit renamed on another device shows the new name when the app comes back", async ({ page, browser }) => {
  await page.goto("/");
  await expect(check(page, /^Read 20 pages/)).toBeVisible();

  const phone = await browser.newPage({ storageState: AUTH_FILE });
  await phone.goto("/habits");
  await phone.getByRole("main").getByRole("button", { name: /^Read 20 pages/ }).click();
  await phone.getByLabel("Name").fill("read 30 pages");
  const synced = phone.waitForResponse((r) => r.url().includes("/_serverFn/") && r.request().method() === "POST");
  await phone.getByRole("button", { name: "Save changes" }).click();
  await synced;
  await phone.close();

  // Coming back to the app fetches the new plan.
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(check(page, /^Read 30 pages/)).toBeVisible();
});

test("a page left open overnight moves on to the new day", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await expect(check(page, STRETCH)).toHaveAttribute("aria-checked", "true");
  const current = page.getByRole("radiogroup", { name: "Day" }).locator('[aria-current="date"]');
  await expect(current).toContainText(String(new Date().getDate()));

  // The app sits in the background past midnight, then comes back.
  const tomorrow = new Date(Date.now() + DAY);
  await page.clock.setSystemTime(tomorrow);
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(current).toContainText(String(tomorrow.getDate()));
  await expect(check(page, STRETCH)).toHaveAttribute("aria-checked", "false");
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

const ROUTES = ["/", `/?day=${daysAgo(1)}`, "/stats", "/stats?range=month", "/stats?range=quarter", "/stats?range=year", "/habits"];

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
      // Lime allows one primary button per view: Habits draws its Add habit in the title row or, on a phone, at the foot.
      expect(await page.locator('[data-slot="button"][data-variant="primary"]').filter({ visible: true }).count()).toBeLessThanOrEqual(1);
    });
  }
}

// Every transition runs on one of Lime's two curves and one of its durations, never the browser's ease, linear or 0s.
// Reads computed styles, so a class that compiles to a fallback fails here even when the source looks right.
const CURVES = ["cubic-bezier(0.4, 0, 0.2, 1)", "cubic-bezier(0.4, 0, 1, 1)"];
const DURATIONS = ["0.08s", "0.14s", "0.2s", "0.28s"];

async function transitions(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("*")].flatMap((el) => {
      const style = getComputedStyle(el);
      if (style.transitionProperty === "all" && style.transitionDuration === "0s") return [];
      const name = `${el.tagName.toLowerCase()}${el.getAttribute("data-slot") ? `[data-slot=${el.getAttribute("data-slot")}]` : ""}`;
      return [{ name, durations: style.transitionDuration.split(", "), curves: style.transitionTimingFunction.split(/,\s*(?![^(]*\))/) }];
    }),
  );
}

for (const route of ["/", "/stats?range=month", "/habits"]) {
  test(`every transition on ${route} uses Lime's curves and durations`, async ({ page }) => {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const wrong = (await transitions(page)).filter(
      (t) => t.durations.some((d) => !DURATIONS.includes(d)) || t.curves.some((c) => !CURVES.includes(c)),
    );
    expect(wrong.map((t) => `${t.name}: ${t.durations.join(" ")} ${t.curves.join(" ")}`)).toEqual([]);
  });
}

test("reduced motion stops every transition", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const moving = (await transitions(page)).filter((t) => t.durations.some((d) => d !== "0s"));
  expect(moving.map((t) => `${t.name}: ${t.durations.join(" ")}`)).toEqual([]);
});

/** Opens the account menu at the foot of the sidebar. */
async function accountMenu(page: Page) {
  await page.getByRole("complementary", { name: "Sidebar" }).getByRole("button", { name: /^Account/ }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  return menu;
}

test("the sidebar names who is signed in", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("complementary", { name: "Sidebar" })).toContainText(EMAIL);
  await accountMenu(page);
  // An open menu floats at the end of the page, outside every landmark, as a popup should.
  await expectNoAxeViolations(page, ["region"]);
});

test("the theme follows the system until the user picks one", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "dark");
  const toggle = (await accountMenu(page)).getByRole("menuitemcheckbox", { name: "Dark theme" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");

  // The phone's status bar matches the page's ground.
  const barColor = page.locator('meta[name="theme-color"]');
  await expect(barColor).toHaveAttribute("content", "#1f1f1c");

  await toggle.click();
  await expect(html).toHaveAttribute("data-theme", "light");
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(barColor).toHaveAttribute("content", "#f6f5f2");
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
  await expect(nav).toContainText(EMAIL);
  await expectNoAxeViolations(page);

  await nav.getByRole("link", { name: "Stats" }).click();
  await expect(page).toHaveURL(/\/stats/);
  await expect(nav).toBeHidden();
  await expect(menu).toBeFocused();
});

test("on a phone, the habit form opens as a sheet from the foot", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/habits");
  // The title row's Add habit gives way to one pinned at the foot.
  await expect(page.getByRole("button", { name: "Add habit" })).toHaveCount(1);
  await page.getByRole("button", { name: "Add habit" }).click();
  const sheet = page.getByRole("dialog", { name: "New habit" });
  await expect(sheet.getByRole("radio", { name: "Yearly" })).toBeInViewport();
  await expectNoAxeViolations(page);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
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
  await page.goto("/habits");
  const main = page.getByRole("main");
  for (const name of ["stretch for 5 minutes", "read 30 pages"]) {
    await main.getByRole("button", { name: new RegExp(`^${name}`, "i") }).click();
    await page.getByRole("dialog", { name: "Edit habit" }).getByRole("button", { name: "Archive habit" }).click();
    const dialog = page.getByRole("alertdialog", { name: `Archive ${name}?` });
    await expect(dialog.getByRole("button", { name: "Keep habit" })).toBeFocused();
    await expectNoAxeViolations(page);
    await dialog.getByRole("button", { name: "Archive habit" }).click();
    await expect(dialog).toBeHidden();
    await expect(main.getByRole("button", { name: new RegExp(`^${name}`, "i") })).toHaveCount(0);
  }

  await expect(page.getByRole("heading", { name: "No habits yet" })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "No habits yet" })).toBeVisible();
  // Stats still counts an archived habit in the range it was planned in, as the archive dialog promised.
  await page.goto("/stats?range=month");
  await expect(page.getByRole("region", { name: "By habit" }).getByText("Stretch for 5 minutes")).toBeVisible();
  await expect(page.getByRole("region", { name: "By habit" }).getByText("Archived").first()).toBeVisible();
  await expectNoAxeViolations(page);
});

// Runs last: signing out ends the session every other test shares.
test("sign out clears this device", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("habit-tracker:log"))).not.toBeNull();

  await (await accountMenu(page)).getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/sign-in");
  const saved = await page.evaluate(() => ["log", "outbox", "email"].map((k) => localStorage.getItem(`habit-tracker:${k}`)));
  expect(saved).toEqual([null, null, null]);
  await page.goto("/stats");
  await expect(page).toHaveURL("/sign-in");
});
