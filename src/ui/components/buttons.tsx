"use client";

import { useTranslations } from "next-intl";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

import { Link } from "@/i18n/navigation";

import { cn } from "../cn";
import { Icon, type IconName } from "../icons/icon";
import { Spinner } from "./states";

type Kind = "primary" | "secondary" | "outline" | "destructive";

/** Pill fills: accent for the main action, a grey fill for the rest, a hairline outline for quiet actions. */
const KIND: Record<Kind, string> = {
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

type Size = "regular" | "compact";

/** Class names of a pill button, for links and summaries styled as one. */
export const buttonClass = (kind: Kind = "primary", className?: string, size: Size = "regular") =>
  cn(size === "compact" ? COMPACT : BASE, KIND[kind], className);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: Kind;
  size?: Size;
  icon?: IconName;
  /** Keeps the title, blocks repeat presses and announces progress. */
  loading?: boolean;
};

/** Full-width pill button (iOS InvestButtonStyle + ActionButton); `className="w-auto"` sizes it to its title. */
export function Button({ kind = "primary", size, icon, loading = false, className, children, onClick, ...props }: ButtonProps) {
  const t = useTranslations("components.button");
  return (
    <button
      type="button"
      {...props}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={(event) => {
        if (loading) return event.preventDefault();
        onClick?.(event);
      }}
      className={buttonClass(kind, className, size)}
    >
      {loading ? <Spinner /> : icon ? <Icon name={icon} /> : null}
      <span>{children}</span>
      {loading ? <span className="sr-only">{t("processing")}</span> : null}
    </button>
  );
}

export function ButtonLink({
  kind = "primary",
  size,
  icon,
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & { kind?: Kind; size?: Size; icon?: IconName }) {
  return (
    <Link {...props} className={buttonClass(kind, className, size)}>
      {icon ? <Icon name={icon} /> : null}
      <span>{children}</span>
    </Link>
  );
}

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: IconName;
  label: string;
  /** `filled` sits on a grey disc; `plain` is a bare icon with a hover disc (top bar, toolbars). */
  variant?: "filled" | "plain";
};

/** Circular icon-only class names (48 px on phones, 44 px on desk), for links styled as an icon button. */
export const iconButtonClass = (variant: "filled" | "plain" = "filled", className?: string) =>
  cn(
    "motion-press relative inline-flex size-12 shrink-0 items-center justify-center rounded-full text-primary-text transition-colors desk:size-11 disabled:opacity-42",
    variant === "filled" ? "bg-action-surface hover:bg-track" : "hover:bg-action-surface",
    className,
  );

/** Circular icon-only button; the label is required. */
export function IconButton({ icon, label, variant = "filled", className, ...props }: IconButtonProps) {
  return (
    <button type="button" aria-label={label} title={label} {...props} className={iconButtonClass(variant, className)}>
      <Icon name={icon} />
    </button>
  );
}

type ActionTileProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: IconName;
  title: ReactNode;
  selected?: boolean;
};

/** Icon above a label; selected uses the soft accent fill and accent outline. */
export function ActionTile({ icon, title, selected = false, className, ...props }: ActionTileProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      {...props}
      className={cn(
        "motion-press flex min-h-20 desk:min-h-16 w-full flex-col items-center justify-center gap-2 rounded-large px-2 py-2 text-caption font-medium text-primary-text",
        "border-[length:var(--control-outline-width)]",
        selected ? "bg-accent-soft border-accent" : "bg-action-surface border-control-outline",
        className,
      )}
    >
      <Icon name={icon} className="text-section text-accent" />
      <span>{title}</span>
    </button>
  );
}
