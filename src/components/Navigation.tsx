import { Dialog } from "@base-ui/react/dialog";
import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Add, CalendarDays, ChartLine, Close, History, Icon, Menu } from "@/components/lime/icon";
import { Button, buttonVariants } from "@/components/lime/ui/button";
import { useLimePortal } from "@/lib/lime/portal";
import { cn } from "@/lib/lime/utils";
import SignOut from "./SignOut";
import ThemeToggle from "./ThemeToggle";

// Spendly's navigation: a slim sidebar on a wide screen, and on a phone a top bar whose menu opens every place over
// the whole screen. CSS picks which one shows, so the hidden one is out of the accessibility tree too.

const PLACES = [
  { to: "/", label: "Today", icon: CalendarDays, exact: true },
  { to: "/insights", label: "Insights", icon: ChartLine, exact: false },
  { to: "/log", label: "Log", icon: History, exact: false },
] as const;

// The page you are on wears a hovered row's fill, with bold words: a settled row says "here", a hover says "you could".
// Link sets aria-current="page" on the row it matches.
const HERE = "aria-[current=page]:bg-surface-2 aria-[current=page]:font-semibold aria-[current=page]:text-fg";
// The sidebar's rows: the icon over its name, so the sidebar stands slim.
const STACK = `flex w-full flex-col items-center gap-y-1 rounded-md py-2 text-xs text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg active:bg-surface-2 ${HERE}`;
// The phone's rows: the icon beside its name, a finger's height.
const ROW = `flex h-12 w-full items-center gap-x-4 rounded-md px-3 text-fg-2 transition-colors active:bg-surface-2 ${HERE}`;

function Place({ place, className, onClick }: { place: (typeof PLACES)[number]; className: string; onClick?: () => void }) {
  return (
    <Link to={place.to} activeOptions={{ exact: place.exact }} onClick={onClick} className={className}>
      <Icon icon={place.icon} size={20} />
      {place.label}
    </Link>
  );
}

/** "New habit" is /plan with no habit; editing a plan is /plan?habit=..., which this leaves unlit. */
function NewHabit({ className, onClick }: { className: string; onClick?: () => void }) {
  return (
    <Link to="/plan" search={{}} activeOptions={{ exact: true, includeSearch: true }} onClick={onClick} className={className}>
      <Icon icon={Add} size={20} />
      New habit
    </Link>
  );
}

/** The wide screen's navigation, held to the left edge: the theme at the head, the places, and Sign out at the foot. */
export function Sidebar() {
  return (
    <aside
      aria-label="Sidebar"
      className="sticky inset-bs-0 hidden h-dvh w-24 shrink-0 flex-col border-e border-line bg-surface md:flex"
    >
      <div className="flex h-14 shrink-0 items-center justify-center">
        <ThemeToggle />
      </div>
      <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
        <ul className="flex flex-col gap-y-0.5">
          {PLACES.map((p) => (
            <li key={p.to}>
              <Place place={p} className={STACK} />
            </li>
          ))}
          <li>
            <NewHabit className={STACK} />
          </li>
        </ul>
      </nav>
      {/* Pinned under the scroller, so Sign out stays in sight whatever the rows above hold. */}
      <div className="shrink-0 p-2">
        <SignOut className={STACK} />
      </div>
    </aside>
  );
}

/**
 * The phone's top bar, pinned as an app's navigation bar is: the menu at the start and the theme at the end. Once the
 * page's own title has scrolled under it, the bar says the title and draws its rule, so the reader knows where they are.
 */
export function TopBar() {
  const bar = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { title, scrolled } = useTitlePast(bar, pathname);
  return (
    <header
      ref={bar}
      data-scrolled={scrolled || undefined}
      className="sticky inset-bs-0 z-10 border-be border-transparent bg-page transition-colors data-scrolled:border-line md:hidden"
    >
      <div className="relative flex h-14 items-center justify-between px-2">
        <Button variant="ghost" size="icon" aria-label="Open navigation" onClick={() => setOpen(true)}>
          <Icon icon={Menu} size={20} />
        </Button>
        {/* The page's h1 says it to a screen reader; this is for the eye. */}
        <p
          aria-hidden="true"
          data-hidden={title ? undefined : true}
          className="pointer-events-none absolute inset-x-16 truncate text-center text-lg font-semibold tracking-tight transition-opacity data-hidden:opacity-0"
        >
          {title}
        </p>
        <ThemeToggle size="icon" />
      </div>
      <NavPage open={open} onOpenChange={setOpen} />
    </header>
  );
}

/**
 * Every place over the whole phone screen, opened from the top bar's corner and shut from the same spot. Base UI's
 * Dialog, so focus moves in, stays in, and goes back to the menu button, and Escape or Android's Back shuts it.
 * New habit is the one action, a key at the foot; Sign out sits under it.
 */
function NavPage({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const container = useLimePortal();
  const close = () => onOpenChange(false);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={container}>
        {/* Over the whole screen, so it fades in place rather than sliding over a page it hides entirely. */}
        <Dialog.Popup className="fixed inset-0 z-(--z-dialog) flex flex-col bg-page text-fg transition-opacity duration-(--dur-slow) ease-(--ease-out) data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:ease-(--ease-in)">
          <div className="flex h-14 shrink-0 items-center gap-x-1 px-2">
            {/* Where the menu button stood, so one spot opens and shuts it. */}
            <Dialog.Close aria-label="Close navigation" render={<Button variant="ghost" size="icon" />}>
              <Icon icon={Close} size={20} />
            </Dialog.Close>
            {/* The wordmark is for the eye; the dialog is named for what it is. */}
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <span aria-hidden="true" className="text-lg font-semibold tracking-tight">
              Habit tracker
            </span>
          </div>
          <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 pbs-4">
            <ul className="flex flex-col gap-y-0.5">
              {PLACES.map((p) => (
                <li key={p.to}>
                  <Place place={p} className={ROW} onClick={close} />
                </li>
              ))}
            </ul>
            <NewHabit className={cn(buttonVariants({ size: "lg" }), "mbs-auto mbe-3 w-full")} onClick={close} />
          </nav>
          <div className="shrink-0 border-bs border-line p-3">
            <SignOut className={ROW} />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** The page's title once it has scrolled under the bar, and whether the page has scrolled at all. */
function useTitlePast(bar: RefObject<HTMLElement | null>, pathname: string) {
  const [state, setState] = useState<{ title: string | null; scrolled: boolean }>({ title: null, scrolled: false });
  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      const edge = bar.current?.getBoundingClientRect().bottom ?? 0;
      const h1 = document.querySelector("main h1");
      const title = h1 && h1.getBoundingClientRect().bottom <= edge ? h1.textContent?.trim() || null : null;
      const scrolled = window.scrollY > 0;
      setState((s) => (s.title === title && s.scrolled === scrolled ? s : { title, scrolled }));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    // Read again as the page swaps in: a page that loads arrives after the address changes.
    const swapped = new MutationObserver(onScroll);
    const column = bar.current?.parentElement;
    if (column) swapped.observe(column, { childList: true, subtree: true, characterData: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      swapped.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [bar, pathname]);
  return state;
}
