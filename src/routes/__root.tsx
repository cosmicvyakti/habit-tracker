import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Link, Outlet, redirect, Scripts, useRouterState } from "@tanstack/react-router";
import { ReactNode, Suspense, useEffect, useState } from "react";
import { Icon, Moon, Sun } from "@/components/lime/icon";
import { Button } from "@/components/lime/ui/button";
import { ToastProvider } from "@/components/lime/ui/toast";
import lime from "@/components/lime/styles.css?url";
import fonts from "../fonts.css?url";
import { LimePortalProvider } from "@/lib/lime/portal";
import SignOut from "../components/SignOut";
import SyncStatus from "../components/SyncStatus";
import { AutoMigrateV1 } from "../components/V1Import";
import { signedIn } from "../data";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [{ charSet: "utf-8" }, { name: "viewport", content: "width=device-width, initial-scale=1" }, { title: "Habit Tracker" }],
    links: [
      { rel: "stylesheet", href: fonts },
      { rel: "stylesheet", href: lime },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  beforeLoad: async ({ location }) => {
    if (location.pathname !== "/sign-in" && !(await signedIn())) throw redirect({ to: "/sign-in" });
  },
  shellComponent: Shell,
  component: Root,
});

function Shell({ children }: { children: ReactNode }) {
  return (
    // Lime's reset reaches only elements inside the scope, so the scope sits on <html> to cover <body>'s margin too.
    <html lang="en" className="lime">
      <head>
        {/* Runs before the first paint, so a dark page never flashes light. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const THEME_KEY = "habit-tracker:theme";
// Lime switches on data-theme and ignores the system setting, so the system setting is only the default.
const THEME_SCRIPT = `try { document.documentElement.dataset.theme = localStorage.getItem("${THEME_KEY}") ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); } catch {}`;

function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === "dark");
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Dark theme"
      aria-pressed={dark}
      onClick={() => {
        const theme = dark ? "light" : "dark";
        document.documentElement.dataset.theme = theme;
        try {
          localStorage.setItem(THEME_KEY, theme);
        } catch {
          // Private browsing can block storage; the theme still applies until reload.
        }
        setDark(!dark);
      }}
    >
      <Icon icon={dark ? Sun : Moon} />
    </Button>
  );
}

const NAV = [
  { to: "/", label: "Today", exact: true },
  { to: "/insights", label: "Insights", exact: false },
  { to: "/log", label: "Log", exact: false },
  { to: "/plan", label: "New habit", exact: true },
] as const;

function Root() {
  const { queryClient } = Route.useRouteContext();
  const atSignIn = useRouterState({ select: (s) => s.location.pathname === "/sign-in" });
  // Production only: in development the worker would serve stale modules.
  useEffect(() => {
    if (import.meta.env.PROD && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <LimePortalProvider>
        <ToastProvider>
          <div className="min-h-dvh bg-page text-fg">
            <header className="border-b border-line">
              <div className="mx-auto flex min-h-14 w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 sm:px-6">
                <span className="label">Habit tracker</span>
                {!atSignIn && (
                  <nav aria-label="Main" className="ms-auto flex flex-wrap gap-x-4 gap-y-1">
                    {NAV.map((n) => (
                      <Link
                        key={n.to}
                        to={n.to}
                        // "New habit" is /plan with no habit; editing a plan is /plan?habit=...
                        search={n.to === "/plan" ? {} : undefined}
                        activeOptions={{ exact: n.exact, includeSearch: n.to === "/plan" }}
                        activeProps={{ className: "label py-2 text-fg underline underline-offset-4" }}
                        inactiveProps={{ className: "label py-2 text-fg-2" }}
                      >
                        {n.label}
                      </Link>
                    ))}
                  </nav>
                )}
                {/* A line of its own on a phone, at the end, so it never squeezes the navigation. */}
                <div className={`flex items-center justify-end gap-2 ${atSignIn ? "ms-auto" : "basis-full sm:basis-auto"}`}>
                  <ThemeToggle />
                  {!atSignIn && <SignOut />}
                </div>
              </div>
              <SyncStatus />
            </header>
            {/* Importing needs a session, so it waits until the user is past sign-in. */}
            {!atSignIn && <AutoMigrateV1 />}
            <Suspense fallback={null}>
              <Outlet />
            </Suspense>
          </div>
        </ToastProvider>
      </LimePortalProvider>
    </QueryClientProvider>
  );
}
