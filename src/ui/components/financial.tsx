import Decimal from "decimal.js";
import { useTranslations } from "next-intl";

import type { Numeric } from "@/domain/format";

import { cn } from "../cn";
import { useFormat } from "../format";
import { Icon, type IconName } from "../icons/icon";
import { AnimatedText } from "./animated-value";

const STYLE = {
  display: "text-headline",
  price: "text-price",
  standard: "text-body font-medium",
} as const;

/**
 * Formatted instrument value that rolls when it changes. Prices are neutral text; colour belongs to changes only,
 * except `live`: a current quote that changes to another shows a tint of its direction that fades out.
 */
export function FinancialValue({
  value,
  bond = false,
  code = "AOA",
  digits,
  style = "standard",
  live = false,
  className,
}: {
  value: Numeric;
  bond?: boolean;
  code?: string;
  digits?: number;
  style?: keyof typeof STYLE;
  /** A current quote: a change to another current quote also flashes the direction's tint (`AnimatedText`). */
  live?: boolean;
  className?: string;
}) {
  const format = useFormat();
  const text = format.securityPrice(value, { bond, code, digits });
  return (
    <AnimatedText
      text={text}
      numeric={new Decimal(value).toString()}
      live={live}
      className={cn("inline-block whitespace-nowrap font-display text-primary-text", STYLE[style], className)}
    />
  );
}

const direction = (value: Decimal): { tone: string; icon: IconName } =>
  value.gt(0)
    ? { tone: "text-positive bg-positive/12", icon: "arrow-up-right" }
    : value.lt(0)
      ? { tone: "text-negative bg-negative/12", icon: "arrow-down-right" }
      : { tone: "text-secondary-text bg-secondary-text/12", icon: "remove" };

/** Signed change capsule with arrow; read as "Subiu …" / "Desceu …". The figure rolls and the tint fades when it changes. */
export function ChangeBadge({ value, className }: { value: Numeric; className?: string }) {
  const t = useTranslations();
  const format = useFormat();
  const decimal = new Decimal(value);
  const text = format.percent(decimal);
  const { tone, icon } = direction(decimal);
  const spoken = decimal.gt(0)
    ? t("components.financial.roseAccessibility", { arg1: text })
    : decimal.lt(0)
      ? t("components.financial.fellAccessibility", { arg1: text.replace("-", "") })
      : t("common.unchanged");
  return (
    <span className={cn("inline-flex min-h-7 shrink-0 items-center gap-1 rounded-full px-2 font-display text-caption font-semibold transition-colors desk:min-h-6 desk:rounded-md desk:px-1.5", tone, className)}>
      <Icon name={icon} aria-hidden />
      <span aria-hidden className="inline-flex">
        <AnimatedText text={text} numeric={decimal.toString()} className="inline-block" />
      </span>
      <span className="sr-only">{`${t("common.change")}: ${spoken}`}</span>
    </span>
  );
}

/** Label, value and optional caption cell; missing values show "—". */
export function MarketMetric({ title, value, detail, icon }: { title: string; value: string | null; detail?: string; icon?: IconName }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {icon ? <Icon name={icon} className="text-accent" /> : null}
      <span className="font-display text-body font-medium text-primary-text">{value ?? "—"}</span>
      <span className="text-caption text-secondary-text">{title}</span>
      {detail ? <span className="text-caption text-tertiary-text">{detail}</span> : null}
    </div>
  );
}

export type MarketStatus = "unknown" | "closed" | "openingSoon" | "open";

const STATUS_KEY = {
  unknown: "common.unavailable",
  closed: "market.status.closed",
  openingSoon: "common.comingSoon",
  open: "market.status.open",
} as const;

const STATUS_DOT = {
  unknown: "bg-tertiary-text",
  closed: "bg-tertiary-text",
  openingSoon: "bg-warning",
  open: "bg-positive",
} as const;

/** A status dot and its word; `value` sets it as a stat tile's figure instead of a caption. A change cross-fades the word and the dot's colour. */
export function MarketStatusIndicator({ status, size = "caption" }: { status: MarketStatus; size?: "caption" | "value" }) {
  const t = useTranslations();
  const title = t(STATUS_KEY[status]);
  return (
    <span className={cn("inline-flex items-center gap-2", size === "value" ? "text-primary-text" : "text-caption font-medium text-secondary-text")}>
      <span aria-hidden className={cn("rounded-full transition-colors duration-base", size === "value" ? "size-2" : "size-[7px]", STATUS_DOT[status])} />
      <span aria-hidden className="inline-flex">
        <AnimatedText text={title} className="inline-block" />
      </span>
      <span className="sr-only">{t("common.marketStatus", { arg1: title })}</span>
    </span>
  );
}
