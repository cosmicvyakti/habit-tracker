import { Fragment, type ReactNode } from "react";
import { Badge } from "@/components/lime/ui/badge";
import { cn } from "@/lib/lime/utils";

/**
 * A card, as Spendly draws one: a titled section on the `card` ground, its title inside it. Written out rather than
 * Lime's Card, whose ground is not `card`. Every card here is a section named by its title, so it is one.
 */
export function Card({ labelledBy, className, children }: { labelledBy: string; className?: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={cn("flex flex-col rounded-panel border border-line bg-card p-5 text-fg shadow-card", className)}
    >
      {children}
    </section>
  );
}

/**
 * A card's head: its title, an optional count beside it as a badge, and an optional action at the end. What follows a
 * " · " in the title qualifies it (a month, a range), so it reads as a quieter second voice on the same line.
 */
export function CardTitle({ id, title, count, action }: { id: string; title: string; count?: number; action?: ReactNode }) {
  return (
    <div className="mbe-4 flex min-h-(--control-md) items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <h2 id={id} className="truncate text-lg leading-tight font-semibold text-fg">
          {title.split(" · ").map((part, i) => (
            <Fragment key={i}>{i > 0 ? <span className="font-normal text-fg-3">{` · ${part}`}</span> : part}</Fragment>
          ))}
        </h2>
        {count !== undefined && <Badge className="tabular-nums">{count}</Badge>}
      </div>
      {action}
    </div>
  );
}

/** A card's foot: a summary line. The card must end with it. */
export function CardFoot({ children }: { children: ReactNode }) {
  return <p className="mbs-auto truncate pbs-4 text-sm text-fg-2">{children}</p>;
}
