import { useSyncExternalStore } from "react";

/**
 * The one breakpoint, the same width as `phone:` in app.css. CSS picks the chrome; this is for what CSS cannot change,
 * such as whether a form opens as a dialog or as a sheet from the foot.
 */
const PHONE_QUERY = "(width < 48rem)";

function subscribe(onChange: () => void) {
  const list = window.matchMedia(PHONE_QUERY);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

export function usePhone(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}
