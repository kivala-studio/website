"use client";

import { useTranslations } from "next-intl";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

import { Link } from "@/i18n/navigation";

import { cn } from "../cn";
import { Icon, type IconName } from "../icons/icon";
import { Spinner } from "./states";

type Kind = "primary" | "secondary" | "destructive";

const KIND: Record<Kind, string> = {
  primary: "bg-accent text-on-accent",
  secondary:
    "bg-action-surface text-primary-text border-[length:var(--control-outline-width)] border-control-outline",
  destructive: "bg-negative/12 text-negative",
};

const BASE =
  "motion-press inline-flex w-full min-h-14 items-center justify-center gap-2 rounded-full px-5 py-4 text-center text-body font-semibold disabled:opacity-42 aria-disabled:opacity-42";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: Kind;
  icon?: IconName;
  /** Keeps the title, blocks repeat presses and announces progress. */
  loading?: boolean;
};

/** Full-width capsule button (iOS InvestButtonStyle + ActionButton). */
export function Button({ kind = "primary", icon, loading = false, className, children, onClick, ...props }: ButtonProps) {
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
      className={cn(BASE, KIND[kind], className)}
    >
      {loading ? <Spinner /> : icon ? <Icon name={icon} /> : null}
      <span>{children}</span>
      {loading ? <span className="sr-only">{t("processing")}</span> : null}
    </button>
  );
}

export function ButtonLink({ kind = "primary", icon, className, children, ...props }: ComponentProps<typeof Link> & { kind?: Kind; icon?: IconName }) {
  return (
    <Link {...props} className={cn(BASE, KIND[kind], className)}>
      {icon ? <Icon name={icon} /> : null}
      <span>{children}</span>
    </Link>
  );
}

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & { icon: IconName; label: string };

/** Circular 48 px icon-only button; the label is required. */
export function IconButton({ icon, label, className, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={cn(
        "motion-press inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-action-surface text-primary-text disabled:opacity-42",
        className,
      )}
    >
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
        "motion-press flex min-h-20 w-full flex-col items-center justify-center gap-2 rounded-large px-2 py-2 text-caption font-medium text-primary-text",
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
