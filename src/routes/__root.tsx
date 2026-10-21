import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Outlet, redirect, Scripts, useRouterState } from "@tanstack/react-router";
import { ReactNode, Suspense } from "react";
import { buttonVariants } from "@/components/lime/ui/button";
import { ToastProvider } from "@/components/lime/ui/toast";
import app from "../app.css?url";
import motion from "../motion.css?url";
import { LimePortalProvider } from "@/lib/lime/portal";
import { cn } from "@/lib/lime/utils";
import { Sidebar, TopBar } from "../components/Navigation";
import SyncStatus from "../components/SyncStatus";
import ThemeToggle, { applyTheme, BAR_COLOR, THEME_KEY } from "../components/ThemeToggle";
import UpdateNotice from "../components/UpdateNotice";
import { signedIn } from "../data";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Habit tracker" },
    ],
    links: [
      { rel: "preload", href: "/fonts/figtree.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: app },
      { rel: "stylesheet", href: motion },
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
    // The theme script sets data-theme before React hydrates, so that one difference is expected.
    <html lang="en" className="lime" suppressHydrationWarning>
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

// Lime switches on data-theme and ignores the system setting, so the system setting is only the default.
const THEME_SCRIPT = `try { (${applyTheme.toString()})(localStorage.getItem("${THEME_KEY}") ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"), ${JSON.stringify(BAR_COLOR)}); } catch {}`;

function Root() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const atSignIn = pathname === "/sign-in";
  return (
    <QueryClientProvider client={queryClient}>
      <LimePortalProvider>
        <ToastProvider>
          <UpdateNotice />
          {atSignIn ? (
            // Spendly's sign-in: the page centred, no chrome. Before there is an account the theme has no settings to
            // live in, so its toggle stands alone in the corner.
            <div className="relative flex min-h-dvh flex-col items-center justify-center bg-ground px-4 pbs-safe pbe-safe text-fg">
              <div className="absolute inset-e-4 inset-bs-4">
                <ThemeToggle />
              </div>
              <SyncStatus className="w-full max-w-sm not-empty:pbe-4" />
              <Suspense fallback={null}>
                <Outlet />
              </Suspense>
            </div>
          ) : (
            // Spendly's layout: the ink sidebar held to the left edge, then the page, which scrolls itself so its
            // rounded corners stay where they are. Below the floor the phone's chrome takes over: a top bar inside the
            // page, and the document scrolls. The page is positioned, so it paints over the sidebar's ink that runs
            // under its rounded corners.
            <div className="flex h-dvh text-fg phone:block phone:h-auto phone:min-h-dvh">
              {/* The first stop for a keyboard, ahead of the sidebar; it slides into view only while focused. */}
              <a
                href="#content"
                className={cn(buttonVariants({ variant: "outline" }), "fixed! start-2 top-2 z-50 -translate-y-[200%] focus-visible:translate-y-0")}
              >
                Skip to content
              </a>
              <Sidebar />
              <main
                // The skip link's target. tabIndex -1 so it can take the focus, and the keys then scroll the page.
                id="content"
                tabIndex={-1}
                className="relative min-w-0 flex-1 overflow-y-auto rounded-s-panel border-s border-line bg-ground px-8 pbe-10 phone:overflow-visible phone:rounded-none phone:border-0 phone:px-4 phone:pbe-safe-5"
              >
                <TopBar />
                {/* The page stops growing and centres past 64rem, as Spendly's do; Stats, a dashboard, past 88rem. */}
                <div className={cn("mx-auto w-full", pathname === "/stats" ? "max-w-wide" : "max-w-5xl")}>
                  <SyncStatus className="not-empty:pbs-4" />
                  <Suspense fallback={null}>
                    <Outlet />
                  </Suspense>
                </div>
              </main>
            </div>
          )}
        </ToastProvider>
      </LimePortalProvider>
    </QueryClientProvider>
  );
}
