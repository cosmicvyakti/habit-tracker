import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/lime/ui/button";
import { Empty, EmptyActions, EmptyDescription, EmptyTitle } from "@/components/lime/ui/empty";
import { ErrorState } from "@/components/lime/ui/error-state";

// What the router shows in place of a page. They render inside the header and the page frame, and use
// nothing but Lime and the router, so they still work when the error came before the app's providers.

/**
 * A page that couldn't load: most often the first open on a device that has no saved copy yet and no
 * connection. Loads again on Try again, and by itself when the connection comes back.
 */
export function LoadError() {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const retry = async () => {
    setRetrying(true);
    try {
      await router.invalidate();
    } finally {
      setRetrying(false);
    }
  };
  useEffect(() => {
    const onOnline = () => void retry();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  const offline = !navigator.onLine;
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-4 pb-8 sm:px-6 sm:pt-8">
      <h1 className="title-page">Couldn't load your habits</h1>
      <ErrorState
        className="mt-8"
        title={offline ? "You're offline" : "The server didn't answer"}
        description={
          offline
            ? "This device has no saved copy of your habits yet. They load as soon as you're back online."
            : "Check your connection, then try again."
        }
        onRetry={retry}
        retrying={retrying}
      />
    </main>
  );
}

export function NotFound() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-4 pb-8 sm:px-6 sm:pt-8">
      {/* No route matched, so no route's head sets the title; React lifts this one into <head>. */}
      <title>Page not found · Habit tracker</title>
      <h1 className="title-page">Page not found</h1>
      <Empty className="mt-8">
        <EmptyTitle aria-level={2}>Nothing is at this address</EmptyTitle>
        <EmptyDescription>The link may be old or mistyped.</EmptyDescription>
        <EmptyActions>
          {/* Base UI marks a non-button render as role="button"; this navigates, so it stays a link. */}
          <Button nativeButton={false} role="link" render={<Link to="/" />}>
            Go to Today
          </Button>
        </EmptyActions>
      </Empty>
    </main>
  );
}
