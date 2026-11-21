import { cn } from "../cn";

/*
 * Pill and icon-button class names, kept outside the client button module so server components can style links
 * (external store links, GET forms) as buttons too.
 */

export type ButtonKind = "primary" | "secondary" | "outline" | "destructive";
export type ButtonSize = "regular" | "compact" | "large";

/** Pill fills: solid accent for the main action, the soft accent tint for the rest, a hairline outline for quiet actions. */
const KIND: Record<ButtonKind, string> = {
  primary: "bg-accent text-on-accent hover:brightness-110",
  secondary: "bg-accent-soft text-primary-text hover:bg-accent-soft-hover",
  outline: "border border-field-border bg-transparent text-primary-text hover:bg-action-surface",
  destructive: "bg-negative/12 text-negative",
};

// Phones keep the iOS 56 px capsule; desk is the web pill: 44 px (the target floor), 14 px medium text.
// `motion-press` fades the fill, the hover brightness and the disabled opacity, and presses the pill.
const BASE =
  "motion-press inline-flex w-full min-h-14 items-center justify-center gap-2 rounded-full px-5 py-4 text-center text-body font-semibold desk:min-h-11 desk:px-5 desk:py-2 desk:text-secondary desk:font-medium disabled:opacity-42 aria-disabled:opacity-42";

// Compact pills keep 44 px everywhere and size to their title (card header actions, toolbars, the top bar).
const COMPACT = "motion-press inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-secondary font-medium whitespace-nowrap disabled:opacity-42 aria-disabled:opacity-42";

// Large pills are the hero's calls to action: 64 px (72 on desk), 32 px of padding, sized to their title.
const LARGE =
  "motion-press inline-flex min-h-16 shrink-0 items-center justify-center gap-2.5 rounded-full px-8 text-body font-medium whitespace-nowrap desk:min-h-18 desk:text-[1.125rem] disabled:opacity-42 aria-disabled:opacity-42";

const SIZE: Record<ButtonSize, string> = { regular: BASE, compact: COMPACT, large: LARGE };

/** A pill's shape, type and press without its fill: for a pill on a stage fill, which brings its own colours. */
export const buttonShape = (size: ButtonSize = "regular") => SIZE[size];

/** Class names of a pill button, for links and summaries styled as one. */
export const buttonClass = (kind: ButtonKind = "primary", className?: string, size: ButtonSize = "regular") => cn(SIZE[size], KIND[kind], className);

export type IconButtonVariant = "filled" | "surface" | "plain" | "outline";

/**
 * Circular icon-only class names (48 px on phones, 44 px on desk), for links styled as an icon button. `filled` sits
 * on the soft accent tint, `surface` on the card fill (an opaque disc on the canvas: the top bar), `plain` is a bare
 * icon with a hover disc, `outline` a hairline ring.
 */
export const iconButtonClass = (variant: IconButtonVariant = "filled", className?: string) =>
  cn(
    "motion-press relative inline-flex size-12 shrink-0 items-center justify-center rounded-full text-primary-text desk:size-11 disabled:opacity-42",
    {
      filled: "bg-accent-soft hover:bg-accent-soft-hover",
      surface: "bg-card-background hover:bg-accent-soft",
      plain: "hover:bg-action-surface",
      outline: "border border-field-border hover:bg-action-surface",
    }[variant],
    className,
  );

/**
 * A section label on a stage: a small pill on the card fill (or the soft accent tint on a card) with an optional
 * leading icon. Not a control, so it has no target size; render it through `SectionChip`.
 */
export const sectionChipClass = (tone: "card" | "soft" = "card", className?: string) =>
  cn(
    "inline-flex min-h-9 w-fit items-center gap-2 rounded-full px-4 py-2 font-display text-secondary font-medium whitespace-nowrap text-primary-text",
    tone === "card" ? "bg-card-background" : "bg-accent-soft",
    className,
  );

/**
 * Lifts a piece of the top bar once the page scrolls under it (`top-bar-float` in motion.css). Not for a field or a
 * ringed control: the focus glow and rings are box shadows too.
 */
export const TOP_BAR_FLOAT = "top-bar-float";

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
