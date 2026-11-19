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
// `motion-press` fades the fill, the hover brightness and the disabled opacity, and presses the pill.
const BASE =
  "motion-press inline-flex w-full min-h-14 items-center justify-center gap-2 rounded-full px-5 py-4 text-center text-body font-semibold desk:min-h-11 desk:px-5 desk:py-2 desk:text-secondary desk:font-medium disabled:opacity-42 aria-disabled:opacity-42";

// Compact pills keep 44 px everywhere and size to their title (card header actions, toolbars, the top bar).
const COMPACT = "motion-press inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-secondary font-medium whitespace-nowrap disabled:opacity-42 aria-disabled:opacity-42";

/** Class names of a pill button, for links and summaries styled as one. */
export const buttonClass = (kind: ButtonKind = "primary", className?: string, size: ButtonSize = "regular") =>
  cn(size === "compact" ? COMPACT : BASE, KIND[kind], className);

/** Circular icon-only class names (48 px on phones, 44 px on desk), for links styled as an icon button. */
export const iconButtonClass = (variant: "filled" | "plain" | "outline" = "filled", className?: string) =>
  cn(
    "motion-press relative inline-flex size-12 shrink-0 items-center justify-center rounded-full text-primary-text desk:size-11 disabled:opacity-42",
    { filled: "bg-action-surface hover:bg-track", plain: "hover:bg-action-surface", outline: "border border-field-border hover:bg-action-surface" }[variant],
    className,
  );

/**
 * The fill of a selected item drawn by its `::before`, behind its content and in its own corners, so
 * `useSlidingIndicator` can glide it from item to item. Give the fill colour (and shadow) with `before:` classes.
 */
export const INDICATOR_FILL = "relative isolate before:absolute before:inset-0 before:-z-10 before:rounded-[inherit]";
/** The other items of such a group sit above the gliding fill, so it passes under their labels, not over them. */
export const INDICATOR_IDLE = "relative z-[1]";

/** A segmented control's groove, and the fill of one segment (the chosen one raised on it). */
export const SEGMENT_TRACK = "flex gap-1 rounded-medium bg-track p-1";
export const segmentTone = (selected: boolean) =>
  selected ? cn(INDICATOR_FILL, "text-primary-text before:bg-raised before:shadow-raised") : cn(INDICATOR_IDLE, "text-secondary-text");

/**
 * A choice chip (presets, filters inside a form): a hairline pill, the chosen one in the soft accent fill. Pair it
 * with `aria-pressed`. The fill is the chip's `::before`, so a single-choice group can glide it with
 * `useSlidingIndicator(value, { selector: '[aria-pressed="true"]' })` on the group.
 */
export const chipClass = (selected: boolean, className?: string) =>
  cn(
    "motion-press inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-full border px-4 text-secondary font-medium whitespace-nowrap disabled:opacity-42 aria-disabled:opacity-42",
    selected
      ? "relative isolate border-transparent text-accent before:absolute before:-inset-px before:-z-10 before:rounded-[inherit] before:bg-accent-soft"
      : cn(INDICATOR_IDLE, "border-field-border text-primary-text hover:bg-action-surface"),
    className,
  );
