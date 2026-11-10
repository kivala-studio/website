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
