import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { LoadError, NotFound } from "./components/RouteStates";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const queryClient = new QueryClient();
  return createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // On the desktop the page scrolls inside <main>, not the window, so a new page opens at its top there too.
    scrollToTopSelectors: ["#content"],
    // Pages crossfade where the browser supports view transitions; motion.css sets the timing.
    defaultViewTransition: true,
    defaultErrorComponent: LoadError,
    defaultNotFoundComponent: NotFound,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
