import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../cn";

/** Surface for actions, grouped input and supporting information. Prices and rows stay on the canvas. */
export function Card({
  surface = "card",
  compact = false,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { surface?: "card" | "elevated"; compact?: boolean }) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-large border-[length:var(--card-outline-width)] border-card-outline",
        surface === "card" ? "bg-card-background" : "bg-elevated-background",
        compact ? "p-4" : "p-5",
        "desk:panel",
        className,
      )}
    />
  );
}

export function SectionHeader({ title, action, id }: { title: string; action?: ReactNode; id?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 id={id} className="text-section text-primary-text">{title}</h2>
      {action}
    </div>
  );
}

export function PageHeading({ title, eyebrow }: { title: string; eyebrow?: string }) {
  return (
    <header className="flex flex-col gap-1">
      {eyebrow ? <p className="text-caption text-secondary-text">{eyebrow}</p> : null}
      <h1 className="text-display text-primary-text">{title}</h1>
    </header>
  );
}

/**
 * The web grouping surface: a hairline panel with an optional title row. On phones it is the canvas itself
 * unless `always` is set, so stacked iOS layouts keep their plain sections.
 */
export function Panel({
  title,
  titleId,
  action,
  always = false,
  flush = false,
  className,
  children,
  ...props
}: Omit<HTMLAttributes<HTMLElement>, "title"> & {
  title?: ReactNode;
  titleId?: string;
  action?: ReactNode;
  always?: boolean;
  /** Content reaches the panel edges (tables, row lists); otherwise it is padded. */
  flush?: boolean;
}) {
  return (
    <section
      aria-labelledby={title && titleId ? titleId : undefined}
      {...props}
      className={cn("flex min-w-0 flex-col", always ? "panel" : "lg:panel", className)}
    >
      {title ? (
        <div className={cn("flex min-h-11 items-center justify-between gap-3 pb-2", always ? "border-b border-hairline px-4 py-2" : "lg:border-b lg:border-hairline lg:px-4 lg:py-2")}>
          <h2 id={titleId} className="text-section text-primary-text">
            {title}
          </h2>
          {action}
        </div>
      ) : null}
      <div className={cn("flex min-w-0 flex-col gap-4", !flush && (always ? "p-4" : "lg:p-4"))}>{children}</div>
    </section>
  );
}

/** Label-over-value cells divided by hairlines (key statistics, session facts). */
export function StatStrip({ items, className }: { items: readonly { title: string; value: ReactNode; tone?: string }[]; className?: string }) {
  return (
    <div className={cn("overflow-hidden", className)}>
      <dl className="-mr-px -mb-px grid grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
        {items.map((item) => (
          <div key={item.title} className="flex min-w-0 flex-col gap-0.5 border-r border-b border-hairline px-4 py-3">
            <dt className="truncate text-caption text-secondary-text">{item.title}</dt>
            <dd className={cn("truncate text-body font-semibold text-primary-text", item.tone)}>{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
