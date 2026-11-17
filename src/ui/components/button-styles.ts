import { cn } from "../cn";

/*
 * Pill and icon-button class names, kept outside the client button module so server components can style links
 * (external store links, GET forms) as buttons too.
 */

export type ButtonKind = "primary" | "secondary" | "outline" | "destructive";
export type ButtonSize = "regular" | "compact";

/** Pill fills: accent for the main action, a grey fill for the rest, a hairline outline for quiet actions. */
const KIND: Record<ButtonKind, string> = {
  primary: "bg-accent text-on-accent hover:brightness-110",
  secondary:
    "bg-action-surface text-primary-text border-[length:var(--control-outline-width)] border-control-outline desk:border-0 hover:bg-track",
  outline: "border border-field-border bg-transparent text-primary-text hover:bg-action-surface",
  destructive: "bg-negative/12 text-negative",
};

// Phones keep the iOS 56 px capsule; desk is the web pill: 44 px (the target floor), 14 px medium text.
const BASE =
  "motion-press inline-flex w-full min-h-14 items-center justify-center gap-2 rounded-full px-5 py-4 text-center text-body font-semibold transition-[background-color,filter] desk:min-h-11 desk:px-5 desk:py-2 desk:text-secondary desk:font-medium disabled:opacity-42 aria-disabled:opacity-42";

// Compact pills keep 44 px everywhere and size to their title (card header actions, toolbars, the top bar).
const COMPACT = "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-secondary font-medium whitespace-nowrap transition-[background-color,filter] motion-press disabled:opacity-42 aria-disabled:opacity-42";

/** Class names of a pill button, for links and summaries styled as one. */
export const buttonClass = (kind: ButtonKind = "primary", className?: string, size: ButtonSize = "regular") =>
  cn(size === "compact" ? COMPACT : BASE, KIND[kind], className);

/** Circular icon-only class names (48 px on phones, 44 px on desk), for links styled as an icon button. */
export const iconButtonClass = (variant: "filled" | "plain" | "outline" = "filled", className?: string) =>
  cn(
    "motion-press relative inline-flex size-12 shrink-0 items-center justify-center rounded-full text-primary-text transition-colors desk:size-11 disabled:opacity-42",
    { filled: "bg-action-surface hover:bg-track", plain: "hover:bg-action-surface", outline: "border border-field-border hover:bg-action-surface" }[variant],
    className,
  );
