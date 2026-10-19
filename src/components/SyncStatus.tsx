import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useToast } from "@/components/lime/ui/toast";
import { startSync, useSyncState } from "../data";
import { count } from "./HabitCard";

/** Runs the sync for the whole app and says when changes are waiting. Silent while sync keeps up. */
export default function SyncStatus() {
  const queryClient = useQueryClient();
  const toast = useToast();
  // useToast returns a new object each render; the sync only needs the latest.
  const toastRef = useRef(toast);
  toastRef.current = toast;
  useEffect(() => startSync(queryClient, (title) => toastRef.current.show({ title })), [queryClient]);

  const { pending, problem } = useSyncState();
  return (
    // Always in the page, so screen readers announce it when text appears; it takes no space while empty.
    <p role="status" className="caption mx-auto w-full max-w-5xl px-4 text-fg-2 not-empty:pb-2 sm:px-6">
      {problem === "offline" && pending > 0 && `Offline. ${count(pending, "change")} waiting to sync.`}
      {problem === "signed-out" && (
        <>
          Signed out. {pending > 0 && `${count(pending, "change")} waiting to sync. `}
          <Link to="/sign-in" className="text-fg underline underline-offset-4">
            Sign in again
          </Link>
        </>
      )}
    </p>
  );
}
