import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useToast } from "@/components/lime/ui/toast";
import { startSync, useSyncState } from "../data";
import { count } from "./habit";

/**
 * Runs the sync for the whole app and says when changes are waiting: a quiet line while it is only offline, a notice
 * when signing in again is the fix. Silent while sync keeps up.
 */
export default function SyncStatus({ className }: { className: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  // useToast returns a new object each render; the sync only needs the latest.
  const toastRef = useRef(toast);
  toastRef.current = toast;
  useEffect(() => startSync(queryClient, (title) => toastRef.current.show({ title })), [queryClient]);

  const { pending, problem } = useSyncState();
  return (
    // Always in the page, so screen readers announce it when text appears; it takes no space while empty.
    <p role="status" className={`caption text-fg-2 ${className}`}>
      {problem === "offline" && pending > 0 && `Offline. ${count(pending, "change")} waiting to sync.`}
      {/* A failure, not a wait: Spendly's page notice, in the danger tint, until it is put right. */}
      {problem === "signed-out" && (
        <span className="body flex flex-wrap items-baseline gap-x-3 rounded-panel border border-danger bg-danger-tint px-6 py-3 text-fg">
          <span className="min-w-0 flex-1">Signed out. {pending > 0 && `${count(pending, "change")} waiting to sync.`}</span>
          <Link to="/sign-in" className="font-medium text-fg underline underline-offset-4">
            Sign in again
          </Link>
        </span>
      )}
    </p>
  );
}
