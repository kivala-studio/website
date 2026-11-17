import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../cn";

/** The page column for site and app pages: 1200 px at most, centred, 16 px gutters on phones and 24 px from 640 px. */
export const PAGE_CONTAINER = "mx-auto w-full max-w-300 px-4 sm:px-6";

/** A card's title row: the section title (22 px on desk) and an optional action on the right (a "Ver tudo" pill). */
export function CardHeader({ title, titleId, action, className }: { title: ReactNode; titleId?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1", className)}>
      <h2 id={titleId} className="text-section text-primary-text">
        {title}
      </h2>
      {action}
    </div>
  );
}

/**
 * Surface for actions, grouped input and supporting information. Prices and rows stay on the canvas. On desk it
 * is the web card (22 px corners, faint border, soft shadow, 24 px padding). With a `title` it gets a header row;
 * `flush` lets content (tables, row lists) reach the edges under it.
 */
export function Card({
  surface = "card",
  compact = false,
  title,
  titleId,
  action,
  flush = false,
  className,
  children,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  surface?: "card" | "elevated";
  compact?: boolean;
  title?: ReactNode;
  titleId?: string;
  action?: ReactNode;
  flush?: boolean;
}) {
  const padding = compact ? "p-4" : "p-5 desk:p-6";
  return (
    <div
      role={title && titleId ? "region" : undefined}
      aria-labelledby={title && titleId ? titleId : undefined}
      {...props}
      className={cn(
        "rounded-large border-[length:var(--card-outline-width)] border-card-outline",
        surface === "card" ? "bg-card-background" : "bg-elevated-background",
        !title && !flush && padding,
        "desk:panel",
        className,
      )}
    >
      {title ? (
        <>
          <CardHeader title={title} titleId={titleId} action={action} className={compact ? "px-4 pt-3" : "px-5 pt-4 desk:px-6 desk:pt-5"} />
          <div className={cn(!flush && (compact ? "px-4 pt-2 pb-4" : "px-5 pt-3 pb-5 desk:px-6 desk:pb-6"), flush && "pt-2")}>{children}</div>
        </>
      ) : (
        children
      )}
    </div>
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
 * The web grouping surface: a card with an optional title row (title + action). On phones it is the canvas itself
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
        <CardHeader
          title={title}
          titleId={titleId}
          action={action}
          className={cn("pb-2", always ? "px-4 pt-3 lg:px-6 lg:pt-5" : "lg:px-6 lg:pt-5")}
        />
      ) : null}
      <div
        className={cn(
          "flex min-w-0 flex-col gap-4",
          !flush && (always ? "p-4 lg:p-6" : "lg:p-6"),
          !flush && !!title && (always ? "pt-2 lg:pt-2" : "lg:pt-2"),
        )}
      >
        {children}
      </div>
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
