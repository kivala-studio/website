import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { cn } from "@/ui/cn";
import { type ButtonKind, buttonClass, SEGMENT_TRACK, segmentTone } from "@/ui/components/button-styles";
import { ChangeBadge } from "@/ui/components/financial";
import { StatTile } from "@/ui/components/layout";
import { type BrandColor, SecurityLogo } from "@/ui/components/rows";
import { useFormat } from "@/ui/format";
import { Icon } from "@/ui/icons/icon";

import { APP_STORE_URL } from "./site";

/** The App Store is the only store until the Android app exists. A pill like `ButtonLink`, primary by default. */
export function StoreButton({ kind = "primary", className }: { kind?: ButtonKind; className?: string }) {
  const t = useTranslations("site.store");
  return (
    <a href={APP_STORE_URL} className={buttonClass(kind, className)}>
      {t("download")}
    </a>
  );
}

/*
 * Landing feature visuals (the CoinStats landing look): a cropped piece of the web product, built from the same
 * primitives, floating on a soft stage. Decorative: one accessible label per figure, everything inside hidden and
 * inert. Sample values only (the iOS onboarding's sample instruments and round invented figures), never market data.
 */

/** The stage, the label and the "exemplo ilustrativo" caption around a visual. */
function ProductFigure({ label, children }: { label: string; children: ReactNode }) {
  const t = useTranslations("onboarding.preview");
  return (
    <figure className="flex w-full flex-col items-center gap-3">
      <div role="img" aria-label={label} className="relative isolate w-full overflow-hidden rounded-card border border-card-border px-4 py-6 sm:px-8 sm:py-10">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(75%_65%_at_15%_10%,var(--accent-soft),transparent)]" />
        <div aria-hidden className="flex flex-col select-none">
          {children}
        </div>
      </div>
      <figcaption className="text-micro font-medium uppercase text-secondary-text">{t("illustrativeExample")}</figcaption>
    </figure>
  );
}

/** The leading card of a visual; its bottom padding leaves room for the card that overlaps it. */
const MAIN_CARD = "panel flex w-[94%] flex-col gap-4 self-start p-4 pb-14 sm:w-[86%] sm:p-5 sm:pb-16";
/** The smaller card lifted over the lower right of the main one. */
const FLOAT_CARD = "panel relative -mt-10 flex w-[82%] flex-col gap-3 self-end p-4 sm:w-[62%]";

/** A line (and its area) through `points` on a 320 × 120 box, stretched to the card's width. */
function SampleChart({ points, tone, className }: { points: string; tone: "positive" | "accent"; className?: string }) {
  const stroke = tone === "positive" ? "stroke-positive" : "stroke-accent";
  const fill = tone === "positive" ? "fill-positive/10" : "fill-accent/12";
  return (
    <svg viewBox="0 0 320 120" preserveAspectRatio="none" focusable="false" className={cn("block w-full overflow-visible", className)}>
      {[30, 60, 90].map((y) => (
        <line key={y} x1="0" x2="320" y1={y} y2={y} strokeDasharray="3 5" vectorEffect="non-scaling-stroke" className="stroke-chart-grid" />
      ))}
      <path d={`M${points} L320 120 L0 120 Z`} className={fill} />
      <path d={`M${points}`} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" className={cn("fill-none", stroke)} />
    </svg>
  );
}

/** The sample instrument header: logo, symbol and kind. */
function SampleInstrument({ symbol, kind, brandColor = "blue" }: { symbol: string; kind: string; brandColor?: BrandColor }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <SecurityLogo symbol={symbol} brandColor={brandColor} size="s" />
      <span className="flex min-w-0 flex-col">
        <span className="font-display text-secondary font-semibold text-primary-text">{symbol}</span>
        <span className="truncate text-caption text-secondary-text">{kind}</span>
      </span>
    </span>
  );
}

const RANGES = ["oneDay", "oneWeek", "oneMonth", "threeMonths", "sixMonths", "oneYear"] as const;

/** Market row: an instrument card as on `/mercado/[symbol]` (price, change, a month's line, the range track) and two statistics. */
export function InstrumentVisual({ label }: { label: string }) {
  const t = useTranslations();
  const format = useFormat();
  const symbol = t("onboarding.preview.symbol");
  return (
    <ProductFigure label={label}>
      <div className={MAIN_CARD}>
        <SampleInstrument symbol={symbol} kind={t("common.stocks")} />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-display text-[1.625rem] leading-tight font-semibold tracking-tight whitespace-nowrap text-primary-text sm:text-[1.75rem]">
            {format.securityPrice(65000)}
          </span>
          <ChangeBadge value="2" />
        </div>
        <SampleChart tone="positive" className="h-24 sm:h-28" points="0 92 C20 90 30 72 50 74 S80 96 100 84 S130 52 150 60 S180 82 200 66 S240 40 260 46 S300 24 320 14" />
        <div className={cn(SEGMENT_TRACK, "text-caption font-medium")}>
          {[...RANGES, "all" as const].map((range) => (
            <span key={range} className={cn("flex min-h-7 flex-1 items-center justify-center rounded-small desk:rounded-[0.5rem]", segmentTone(range === "oneMonth"))}>
              {range === "all" ? t("common.all") : t(`market.range.${range}`)}
            </span>
          ))}
        </div>
      </div>
      <dl className={cn(FLOAT_CARD, "grid gap-2 sm:grid-cols-2")}>
        <StatTile label={t("assetDetails.statistics.open")} value={format.securityPrice(64000)} className="[&>dd]:text-body" />
        <StatTile label={t("common.high")} value={format.securityPrice(66000)} className="[&>dd]:text-body" />
      </dl>
    </ProductFigure>
  );
}

const WATCHLIST: { symbol: string; price: number; change: string; bond?: boolean; alert?: boolean }[] = [
  { symbol: "BAI", price: 65000, change: "2", alert: true },
  { symbol: "BFA", price: 50000, change: "-1" },
  { symbol: "OT", price: 100, change: "0.5", bond: true },
];

/** Watchlist row: three rows of `/lista` (logo, symbol, price, change, bell) under a reached price alert. */
export function WatchlistVisual({ label }: { label: string }) {
  const t = useTranslations();
  const format = useFormat();
  const [first] = WATCHLIST;
  return (
    <ProductFigure label={label}>
      <div className={cn(MAIN_CARD, "gap-2")}>
        <p className="font-display text-secondary font-semibold text-primary-text">{t("common.watchlistTab")}</p>
        <ul className="flex flex-col">
          {WATCHLIST.map((row) => (
            <li key={row.symbol} className="flex min-h-12 items-center gap-2 border-b border-hairline last:border-b-0 sm:gap-3">
              <SecurityLogo symbol={row.symbol} brandColor={row.bond ? "violet" : "blue"} size="s" />
              <span className="min-w-0 flex-1 truncate font-display text-secondary font-medium text-primary-text">{row.symbol}</span>
              <span className="font-display text-secondary font-semibold whitespace-nowrap text-primary-text">
                {format.securityPrice(row.price, { bond: row.bond })}
              </span>
              <span className="flex min-w-18 justify-end max-[25rem]:hidden">
                <ChangeBadge value={row.change} />
              </span>
              <Icon name={row.alert ? "alert" : "notification"} className={cn("text-[1.125rem]", row.alert ? "text-accent" : "text-secondary-text")} />
            </li>
          ))}
        </ul>
      </div>
      <div className={cn(FLOAT_CARD, "flex-row items-center")}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Icon name="alert" />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-display text-secondary font-semibold text-primary-text">{t("formatting.notification.targetReached")}</span>
          <span className="text-caption text-secondary-text">{`${first.symbol} · ${format.securityPrice(first.price)}`}</span>
        </span>
      </div>
    </ProductFigure>
  );
}

const ALLOCATION = [
  { key: "common.stocks", share: 70, grow: "grow-7", tone: "bg-accent" },
  { key: "common.bonds", share: 30, grow: "grow-3", tone: "bg-accent/35" },
] as const;

/** Portfolio row: the `/carteira` value card (value, change, trend) and the allocation by kind. */
export function PortfolioVisual({ label }: { label: string }) {
  const t = useTranslations();
  const format = useFormat();
  return (
    <ProductFigure label={label}>
      <div className={MAIN_CARD}>
        <div className="flex flex-col gap-1">
          <span className="text-caption text-secondary-text">{t("common.portfolio")}</span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-display text-[1.625rem] leading-tight font-semibold tracking-tight whitespace-nowrap text-primary-text sm:text-[1.75rem]">
              {format.currency(1250000)}
            </span>
            <ChangeBadge value="4" />
          </span>
        </div>
        <SampleChart tone="accent" className="h-24 sm:h-28" points="0 100 L27 96 L53 98 L80 86 L107 88 L133 74 L160 78 L187 64 L213 66 L240 54 L267 58 L293 42 L320 34" />
      </div>
      <div className={FLOAT_CARD}>
        <p className="font-display text-secondary font-semibold text-primary-text">{t("common.allocation")}</p>
        <div className="flex h-2 gap-1">
          {ALLOCATION.map((part) => (
            <span key={part.key} className={cn("rounded-full", part.grow, part.tone)} />
          ))}
        </div>
        <ul className="flex flex-col gap-1.5">
          {ALLOCATION.map((part) => (
            <li key={part.key} className="flex items-center gap-2 text-caption text-secondary-text">
              <span className={cn("size-2 rounded-full", part.tone)} />
              <span className="flex-1">{t(part.key)}</span>
              <span className="font-display font-semibold text-primary-text">{format.percent(part.share, { digits: 0, signed: false })}</span>
            </li>
          ))}
        </ul>
      </div>
    </ProductFigure>
  );
}
