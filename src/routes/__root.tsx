import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Outlet, redirect, Scripts, useRouterState } from "@tanstack/react-router";
import { ReactNode, Suspense } from "react";
import { buttonVariants } from "@/components/lime/ui/button";
import { ToastProvider } from "@/components/lime/ui/toast";
import lime from "@/components/lime/styles.css?url";
import fonts from "../fonts.css?url";
import { LimePortalProvider } from "@/lib/lime/portal";
import { cn } from "@/lib/lime/utils";
import { Sidebar, TopBar } from "../components/Navigation";
import SyncStatus from "../components/SyncStatus";
import ThemeToggle, { applyTheme, BAR_COLOR, THEME_KEY } from "../components/ThemeToggle";
import UpdateNotice from "../components/UpdateNotice";
import { AutoMigrateV1 } from "../components/V1Import";
import { signedIn } from "../data";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Habit tracker" },
    ],
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

// Lime switches on data-theme and ignores the system setting, so the system setting is only the default.
const THEME_SCRIPT = `try { (${applyTheme.toString()})(localStorage.getItem("${THEME_KEY}") ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"), ${JSON.stringify(BAR_COLOR)}); } catch {}`;

function Root() {
  const { queryClient } = Route.useRouteContext();
  const atSignIn = useRouterState({ select: (s) => s.location.pathname === "/sign-in" });
  return (
    <QueryClientProvider client={queryClient}>
      <LimePortalProvider>
        <ToastProvider>
          <UpdateNotice />
          <div className="min-h-dvh bg-page text-fg">
            {atSignIn ? (
              <>
                <header className="border-be border-line">
                  <div className="mx-auto flex min-h-14 w-full max-w-5xl items-center justify-between px-4 py-2 sm:px-6">
                    <span className="label">Habit tracker</span>
                    <ThemeToggle />
                  </div>
                  <SyncStatus />
                </header>
                <Suspense fallback={null}>
                  <Outlet />
                </Suspense>
              </>
            ) : (
              <div className="flex">
                {/* The first stop for a keyboard, ahead of the sidebar's six; it slides into view only while focused. */}
                <a
                  href="#content"
                  className={cn(buttonVariants(), "fixed! start-2 top-2 z-50 -translate-y-[200%] focus-visible:translate-y-0")}
                >
                  Skip to content
                </a>
                <Sidebar />
                {/* On a phone the top bar says the page's title, so the page's own h1 stays for screen readers only, and
                    what came under it moves up to the bar. */}
                <div className="min-w-0 flex-1 max-md:[&_main_h1]:sr-only max-md:[&_main_h1+*]:mbs-0">
                  <TopBar />
                  <SyncStatus />
                  {/* Importing needs a session, so it waits until the user is past sign-in. */}
                  <AutoMigrateV1 />
                  {/* The skip link's target: the next Tab after it lands on the page's first control. */}
                  <div id="content">
                    <Suspense fallback={null}>
                      <Outlet />
                    </Suspense>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ToastProvider>
      </LimePortalProvider>
    </QueryClientProvider>
  );
}
