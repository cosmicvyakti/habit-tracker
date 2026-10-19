import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/lime/ui/alert-dialog";
import { Button } from "@/components/lime/ui/button";
import { useToast } from "@/components/lime/ui/toast";
import { clearDevice, useSyncState } from "../data";
import { signOut } from "../server/api";
import { count } from "./HabitCard";

/** Signs out and clears this device. Asks first when changes haven't synced, since signing out deletes them. */
export default function SignOut() {
  const navigate = useNavigate();
  const toast = useToast();
  const { pending } = useSyncState();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      await signOut();
    } catch {
      setBusy(false);
      setOpen(false);
      return toast.show({ title: "Couldn't sign out. Check your connection, then try again." });
    }
    clearDevice();
    setBusy(false);
    setOpen(false);
    await navigate({ to: "/sign-in" });
  }

  return (
    <>
      <Button variant="ghost" size="sm" pending={busy && !open} onClick={() => (pending ? setOpen(true) : go())}>
        Sign out
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out with {count(pending, "change")} not synced?</AlertDialogTitle>
            <AlertDialogDescription>
              Signing out deletes everything saved on this device, including changes that haven't reached the server. To keep them, stay
              signed in until you're back online.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>Stay signed in</AlertDialogClose>
            <Button variant="destructive" pending={busy} onClick={go}>
              Sign out
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
