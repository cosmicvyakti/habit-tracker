import { useEffect, useRef } from "react";
import { useToast } from "@/components/lime/ui/toast";

/**
 * Registers the service worker, and tells a page left open across a deploy that a new version is out, with a reload,
 * as Spendly does. A fresh launch needs no telling: pages come from the network first (public/sw.js).
 */
export default function UpdateNotice() {
  const toast = useToast();
  // useToast returns a new object each render; the listener only needs the latest.
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    // Production only: in development the worker would serve stale modules, and files have no build hash in their names.
    if (!import.meta.env.PROD) return;
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});

    // This code ships in the entry file, whose name carries the build's hash, so a page the server serves now that
    // doesn't name it comes from a newer build. The query keeps the service worker's cached copy of / out of it.
    const mine = new URL(import.meta.url).pathname;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/?build", { cache: "no-store" });
        if (!response.ok || (await response.text()).includes(mine)) return;
      } catch {
        return; // Offline: the next return to the app checks again.
      }
      // Kept until answered. Nothing reloads by itself, so a change being typed is never lost.
      toastRef.current.show({
        id: "updated",
        title: "Habit tracker has been updated",
        timeout: 0,
        action: { label: "Reload app", onClick: () => window.location.reload() },
      });
    };
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, []);

  return null;
}
