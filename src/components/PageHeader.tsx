import type { ReactNode } from "react";

/**
 * A page's title row, as Spendly draws it. On the desktop it stays pinned at the top of the page while the page scrolls,
 * on a ground that reaches 20px below it so nothing scrolls into sight around it; `below` is held with it, such as
 * Today's week. On a phone the top bar says the title, so the h1 is for screen readers, and the aside and `below` keep
 * the row to themselves without pinning.
 */
export default function PageHeader({ title, aside, below }: { title: string; aside?: ReactNode; below?: ReactNode }) {
  return (
    <div className="sticky inset-bs-0 z-10 flex flex-col gap-4 bg-ground pbs-6 pbe-2 after:absolute after:inset-x-0 after:inset-bs-full after:-z-10 after:h-5 after:bg-ground phone:static phone:pbs-2 phone:after:hidden">
      {/* On a phone the row dissolves: the hidden title takes no room, and the aside, if it shows, stands on its own. */}
      <div className="flex min-h-(--control-md) flex-wrap items-center justify-between gap-x-4 gap-y-3 phone:contents">
        {/* min-w-min restores the floor, so a title wraps between words but never inside one beside a wide aside. */}
        <h1 className="min-w-min text-2xl font-semibold tracking-tight phone:sr-only">{title}</h1>
        {aside}
      </div>
      {below}
    </div>
  );
}
