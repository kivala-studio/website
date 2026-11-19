"use client";

import { useTranslations } from "next-intl";
import { type ButtonHTMLAttributes, type ComponentProps, type ReactNode, useRef } from "react";

import { Link } from "@/i18n/navigation";

import { cn } from "../cn";
import { Icon, type IconName } from "../icons/icon";
import { ICON_IN, useChangeAnimation } from "../motion/use-change-animation";
import { type ButtonKind as Kind, type ButtonSize as Size, buttonClass, iconButtonClass } from "./button-styles";
import { Spinner } from "./states";

export { buttonClass, iconButtonClass };

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: Kind;
  size?: Size;
  icon?: IconName;
  /** Keeps the title, blocks repeat presses and announces progress. */
  loading?: boolean;
};

/**
 * Full-width pill button (iOS InvestButtonStyle + ActionButton). `className="w-auto!"` sizes it to its title (`cn` does not
 * merge classes, and Tailwind emits `w-full` after `w-auto`); `sm:w-auto` does so from 640 px.
 */
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
  /** `filled` sits on a grey disc; `plain` is a bare icon with a hover disc (top bar, toolbars); `outline` a hairline ring. */
  variant?: "filled" | "plain" | "outline";
};

/** Circular icon-only button; the label is required. A new icon (eye ↔ eye-off) grows in. */
export function IconButton({ icon, label, variant = "filled", className, ...props }: IconButtonProps) {
  const glyph = useRef<SVGSVGElement>(null);
  useChangeAnimation(glyph, icon, ICON_IN);
  return (
    <button type="button" aria-label={label} title={label} {...props} className={iconButtonClass(variant, className)}>
      <Icon ref={glyph} name={icon} />
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
