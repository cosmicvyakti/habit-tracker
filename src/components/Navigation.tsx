import { Dialog } from "@base-ui/react/dialog";
import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type RefObject } from "react";
import { CalendarDays, ChartLine, ChevronSort, Icon, ListChecks, LogOut, PanelLeftClose, PanelLeftOpen } from "@/components/lime/icon";
import { Button } from "@/components/lime/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/lime/ui/dropdown-menu";
import { useLimePortal } from "@/lib/lime/portal";
import { cn } from "@/lib/lime/utils";
import { useEmail } from "../data";
import { useSignOut } from "./SignOut";
import { useTheme } from "./ThemeToggle";

// Spendly's navigation: an ink sidebar down the left edge on a wide screen, and on a phone a top bar whose menu opens
// every place over the whole screen. CSS picks which one shows (`phone:`), so the hidden one is out of the
// accessibility tree too. Both end with who is signed in, which opens the theme and Sign out.

const PLACES = [
  { to: "/", label: "Today", icon: CalendarDays, exact: true },
  { to: "/stats", label: "Stats", icon: ChartLine, exact: false },
  { to: "/habits", label: "Habits", icon: ListChecks, exact: false },
] as const;

// The page you are on wears what a hovered row wears, the fill, and bold words: a settled row says "here", a hover
// says "you could". The rest stand in fg-3. Link sets aria-current="page" on the row it matches.
const HERE = "aria-[current=page]:bg-surface aria-[current=page]:font-semibold aria-[current=page]:text-fg";
// The sidebar's rows: the name beside its icon, Lime's default control height.
const SIDE_ROW = `flex h-(--control-md) items-center gap-x-3 rounded-md px-3 text-base text-fg-3 transition-colors duration-(--dur-instant) ease-out hover:bg-surface hover:text-fg ${HERE}`;
// The phone's rows: a finger's height, on the page's own ground, the icon quieter than the name.
const PHONE_ROW =
  "flex h-12 items-center gap-x-4 rounded-md px-3 text-base text-fg-2 transition-colors duration-(--dur-instant) ease-out active:bg-surface-2 aria-[current=page]:bg-surface-2 aria-[current=page]:font-semibold aria-[current=page]:text-fg";

function Places({
  className,
  gap,
  quietIcon,
  onNavigate,
}: {
  className: string;
  gap: string;
  quietIcon?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <ul className={cn("flex flex-col", gap)}>
      {PLACES.map((p) => (
        <li key={p.to}>
          <Link to={p.to} activeOptions={{ exact: p.exact, includeSearch: false }} onClick={onNavigate} className={className}>
            {({ isActive }) => (
              <>
                <Icon icon={p.icon} size={20} className={cn(quietIcon && !isActive && "text-fg-3")} />
                {p.label}
              </>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Who is signed in, at the foot of the navigation, as Spendly's phone navigation shows them: the initial in a disc, the
 * name over the email, which opens the theme and Sign out. There is no settings page, so these two live here.
 */
function Account({ className, disc }: { className: string; disc: string }) {
  const email = useEmail();
  const { dark, toggle } = useTheme();
  const { signOut, busy, dialog } = useSignOut();
  return (
    <>
      <DropdownMenu>
        {/* The row's corners come from this frame, so its fill is rounded as the rows above are; the ring sits inside. */}
        <div className="overflow-clip rounded-md">
          <DropdownMenuTrigger
            className={cn(
              "flex w-full items-center gap-x-3 px-2 text-start transition-colors duration-(--dur-instant) ease-out focus-visible:-outline-offset-2",
              className,
            )}
          >
            {/* fg-2 on the disc, not fg-3: a single letter has no word shape to be guessed from. */}
            <span
              aria-hidden="true"
              className={cn("grid shrink-0 place-items-center rounded-full bg-surface-2 text-lg font-semibold text-fg-2", disc)}
            >
              {(email?.[0] ?? "?").toUpperCase()}
            </span>
            {email ? (
              <span className="min-w-0 flex-1">
                {/* The account has no name of its own, so the email's first part stands for it. */}
                <span aria-hidden="true" className="block truncate font-semibold text-fg">
                  {email.split("@")[0]}
                </span>
                <span className="block truncate text-xs text-fg-3">
                  <span className="sr-only">Account, signed in as </span>
                  {email}
                </span>
              </span>
            ) : (
              <span className="min-w-0 flex-1 truncate font-semibold text-fg">Account</span>
            )}
            <Icon icon={ChevronSort} size={16} className="text-fg-3" />
          </DropdownMenuTrigger>
        </div>
        <DropdownMenuContent side="top" align="start" className="min-w-56">
          <DropdownMenuCheckboxItem checked={dark} onCheckedChange={toggle} closeOnClick={false}>
            Dark theme
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut} disabled={busy}>
            <Icon icon={LogOut} size={16} />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {dialog}
    </>
  );
}

/**
 * The wide screen's navigation, held to the left edge: the places, then who is signed in, pinned at the foot. It wears
 * Lime's night theme in both themes, as Spendly's does: `lime` with its own data-theme takes the night tokens. `after:`
 * carries its ink a corner's width past its edge, under the page's rounded corners.
 */
export function Sidebar() {
  return (
    <aside
      aria-label="Sidebar"
      data-theme="dark"
      className="lime sticky inset-bs-0 flex h-dvh w-60 shrink-0 flex-col bg-page text-fg after:absolute after:inset-y-0 after:inset-s-full after:w-(--radius-panel) after:bg-page phone:hidden"
    >
      <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 pbs-6">
        <Places className={SIDE_ROW} gap="gap-2" />
      </nav>
      {/* Pinned under the scroller, so who is signed in stays in sight whatever the rows above hold. */}
      <div className="shrink-0 p-3">
        <Account className="h-14 hover:bg-surface data-popup-open:bg-surface" disc="size-8" />
      </div>
    </aside>
  );
}

/**
 * The phone's top bar, pinned as an app's navigation bar is: the menu at the start and the page's title in the middle.
 * The page's own h1 is visually hidden on a phone (PageHeader), so the bar says the title instead, and draws its rule
 * once the page scrolls under it.
 */
export function TopBar() {
  const bar = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { title, scrolled } = usePageTitle(bar, pathname);
  return (
    <header
      ref={bar}
      data-scrolled={scrolled || undefined}
      className="sticky inset-bs-0 z-20 -mx-4 hidden border-be border-transparent bg-ground pbs-safe transition-colors duration-(--dur-fast) ease-out data-scrolled:border-line phone:block"
    >
      <div className="top-bar-row h-12 px-2">
        <Button variant="ghost" size="icon" aria-label="Open navigation" onClick={() => setOpen(true)} className="justify-self-start">
          <Icon icon={PanelLeftOpen} size={20} />
        </Button>
        {/* The page's h1 says it to a screen reader; this is for the eye. */}
        <p aria-hidden="true" className="truncate text-center text-xl font-semibold tracking-tight">
          {title}
        </p>
        {/* Kept for a page's one icon action, so the title stays centred. */}
        <span />
      </div>
      <NavPage open={open} onOpenChange={setOpen} />
    </header>
  );
}

/**
 * Every place over the whole phone screen, opened from the top bar's corner and shut from the same spot. Base UI's
 * Dialog, so focus moves in, stays in, and goes back to the menu button, and Escape or Android's Back shuts it. Who is
 * signed in sits at the foot, as on the sidebar.
 */
function NavPage({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const container = useLimePortal();
  const close = () => onOpenChange(false);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={container}>
        <Dialog.Popup className="navpage fixed inset-0 z-(--z-dialog) flex flex-col bg-ground pbs-safe pbe-safe text-fg">
          <div className="flex h-12 shrink-0 items-center gap-x-1 px-2">
            {/* Where the menu button stood, so one spot opens and shuts it. */}
            <Dialog.Close aria-label="Close navigation" render={<Button variant="ghost" size="icon" />}>
              <Icon icon={PanelLeftClose} size={20} />
            </Dialog.Close>
            {/* The wordmark is for the eye; the dialog is named for what it is. */}
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <span aria-hidden="true" className="text-xl font-semibold tracking-tight">
              Habit tracker
            </span>
          </div>
          <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 pbs-4">
            <Places className={PHONE_ROW} gap="gap-y-0.5" quietIcon onNavigate={close} />
          </nav>
          <div className="shrink-0 border-bs border-line p-3">
            <Account className="h-16 active:bg-surface-2" disc="size-10" />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** The page's title, from its h1, and whether the page has scrolled at all. */
function usePageTitle(bar: RefObject<HTMLElement | null>, pathname: string) {
  const [state, setState] = useState<{
    title: string | null;
    scrolled: boolean;
  }>({ title: null, scrolled: false });
  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      const title = document.querySelector("main h1")?.textContent?.trim() || null;
      const scrolled = window.scrollY > 0;
      setState((s) => (s.title === title && s.scrolled === scrolled ? s : { title, scrolled }));
    };
    const onChange = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onChange, { passive: true });
    // Read again as the page swaps in: a page that loads arrives after the address changes.
    const swapped = new MutationObserver(onChange);
    const page = bar.current?.parentElement;
    if (page)
      swapped.observe(page, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    return () => {
      window.removeEventListener("scroll", onChange);
      swapped.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [bar, pathname]);
  return state;
}
