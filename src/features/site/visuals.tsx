import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { LESSONS } from "@/features/learn/lessons";
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
 * primitives, composed on a tinted stage. Decorative: one accessible label per figure, everything inside hidden and
 * inert. Sample values only (the iOS onboarding's sample instruments and round invented figures), never market data.
 */

/** The "Exemplo ilustrativo" caption under a visual, or under the whole bento grid. */
export function IllustrativeCaption() {
  const t = useTranslations("onboarding.preview");
  return <figcaption className="text-micro font-medium uppercase text-secondary-text">{t("illustrativeExample")}</figcaption>;
}

/** The tinted stage, the label and the "exemplo ilustrativo" caption around a visual. */
function ProductFigure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figure className="flex w-full flex-col items-center gap-3">
      <div role="img" aria-label={label} className="feature-stage w-full overflow-hidden rounded-card border border-card-border px-4 py-8 [--lean:0px] sm:p-10 sm:[--lean:1.5rem] lg:px-12 lg:py-14 lg:[--lean:2rem]">
        {/* Sample values never "arrive": no value roll, which a layout change (a badge hidden below 400 px and shown again) would replay. */}
        <div aria-hidden className="flex flex-col select-none [&_.motion-value]:animate-none">
          {children}
        </div>
      </div>
      <IllustrativeCaption />
    </figure>
  );
}

/** The card that leads a visual; it fills the stage's width. */
const MAIN_CARD = "panel flex flex-col gap-4 p-4 sm:gap-5 sm:p-5 lg:p-6";
/**
 * The smaller card lifted over the main one, on the side of the text: it leans out of the main card by the stage's
 * `--lean` (from 640 px), to the right, or to the left in a flipped `FeatureRow` (from 1024 px). Each visual sets the overlap.
 */
const FLOAT_CARD =
  "panel relative z-10 flex w-[84%] flex-col self-end border-field-border translate-x-(--lean) sm:w-[62%] lg:group-data-flip/feature:self-start lg:group-data-flip/feature:-translate-x-(--lean)";
/** The lead figure of a main card. */
const LEAD_FIGURE = "font-display text-[1.625rem] leading-tight font-semibold tracking-tight whitespace-nowrap text-primary-text sm:text-[1.75rem] lg:text-[2rem]";

/**
 * A line through `points` on a 320 × 120 box, stretched to the box's size, over an area that fades out, with a dot and
 * a soft halo on its last point (`end`). `id` names the area's gradient and must be unique on the page.
 */
function SampleChart({ id, points, end, tone, className }: { id: string; points: string; end: [number, number]; tone: "positive" | "accent"; className?: string }) {
  const colour = tone === "positive" ? "var(--color-positive)" : "var(--color-accent)";
  return (
    <div className={cn("relative", className)}>
      <svg viewBox="0 0 320 120" preserveAspectRatio="none" focusable="false" className="absolute inset-0 size-full overflow-visible">
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={colour} stopOpacity="0.24" />
            <stop offset="100%" stopColor={colour} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[30, 60, 90].map((y) => (
          <line key={y} x1="0" x2="320" y1={y} y2={y} strokeDasharray="3 5" vectorEffect="non-scaling-stroke" className="stroke-chart-grid" />
        ))}
        <path d={`M${points} L${end[0]} 120 L0 120 Z`} fill={`url(#${id})`} />
        <path
          d={`M${points}`}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className={cn("fill-none", tone === "positive" ? "stroke-positive" : "stroke-accent")}
        />
      </svg>
      <span
        className={cn(
          "absolute size-3 -translate-1/2 rounded-full border-2 border-card-background ring-6",
          tone === "positive" ? "bg-positive ring-positive/20" : "bg-accent ring-accent/20",
        )}
        style={{ left: `${(end[0] / 320) * 100}%`, top: `${(end[1] / 120) * 100}%` }}
      />
    </div>
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

/** A statistic in a floating card: no frame of its own, the value a size down on phones. */
const FLOAT_STAT = "rounded-none border-0 px-2.5 py-1 sm:px-4 [&>dd]:text-secondary sm:[&>dd]:text-body";

const RANGES = ["oneDay", "oneWeek", "oneMonth", "threeMonths", "sixMonths", "oneYear"] as const;

/**
 * Market row: an instrument card as on `/mercado/[symbol]` (price, change, the range track, a month's line) under the
 * session's opening and high (the high alone below 368 px).
 */
export function InstrumentVisual({ label }: { label: string }) {
  const t = useTranslations();
  const format = useFormat();
  const symbol = t("onboarding.preview.symbol");
  return (
    <ProductFigure label={label}>
      <div className={MAIN_CARD}>
        <SampleInstrument symbol={symbol} kind={t("common.stocks")} />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className={LEAD_FIGURE}>{format.securityPrice(65000)}</span>
          <ChangeBadge value="2" />
        </div>
        <div className={cn(SEGMENT_TRACK, "text-caption font-medium")}>
          {[...RANGES, "all" as const].map((range) => (
            <span key={range} className={cn("flex min-h-7 flex-1 items-center justify-center rounded-small desk:rounded-[0.5rem]", segmentTone(range === "oneMonth"))}>
              {range === "all" ? t("common.all") : t(`market.range.${range}`)}
            </span>
          ))}
        </div>
        <SampleChart
          id="feature-instrument"
          tone="positive"
          end={[320, 14]}
          className="mt-1 h-32 sm:h-36 lg:h-40"
          points="0 92 C20 90 30 72 50 74 S80 96 100 84 S130 52 150 60 S180 82 200 66 S240 40 260 46 S300 24 320 14"
        />
      </div>
      <dl className={cn(FLOAT_CARD, "-mt-12 grid w-[94%] grid-cols-2 divide-x divide-hairline py-3 sm:w-[68%] max-[23rem]:grid-cols-1")}>
        <StatTile label={t("assetDetails.statistics.open")} value={format.securityPrice(64000)} className={cn(FLOAT_STAT, "max-[23rem]:hidden")} />
        <StatTile label={t("common.high")} value={format.securityPrice(66000)} className={FLOAT_STAT} />
      </dl>
    </ProductFigure>
  );
}

const WATCHLIST: { symbol: string; price: number; change: string; bond?: boolean; alert?: boolean }[] = [
  { symbol: "BAI", price: 65000, change: "2", alert: true },
  { symbol: "BFA", price: 50000, change: "-1" },
  { symbol: "OT", price: 100, change: "0.5", bond: true },
];

/** Watchlist row: a reached price alert arriving over three rows of `/lista` (logo, symbol, price, change, bell). */
export function WatchlistVisual({ label }: { label: string }) {
  const t = useTranslations();
  const format = useFormat();
  const [first] = WATCHLIST;
  return (
    <ProductFigure label={label}>
      <div className={cn(FLOAT_CARD, "flex-row items-center gap-3 p-3 sm:p-4")}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-medium bg-accent-soft text-accent">
          <Icon name="alert" />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-display text-secondary font-semibold text-primary-text">{t("formatting.notification.targetReached")}</span>
          <span className="text-caption text-secondary-text">{`${first.symbol} · ${format.securityPrice(first.price)}`}</span>
        </span>
      </div>
      <div className={cn(MAIN_CARD, "-mt-8 gap-2 pt-14 sm:gap-2 sm:pt-16 lg:pt-16")}>
        <p className="font-display text-secondary font-semibold text-primary-text">{t("common.watchlistTab")}</p>
        <ul className="flex flex-col">
          {WATCHLIST.map((row) => (
            <li key={row.symbol} className="flex min-h-13 items-center gap-2 border-b border-hairline last:border-b-0 sm:gap-3 lg:min-h-15">
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
    </ProductFigure>
  );
}

const ALLOCATION = [
  { key: "common.stocks", share: 70, grow: "grow-7", tone: "bg-accent" },
  { key: "common.bonds", share: 30, grow: "grow-3", tone: "bg-accent/35" },
] as const;

/** Portfolio row: the `/carteira` value card (value, change, trend) under the allocation by kind. */
export function PortfolioVisual({ label }: { label: string }) {
  const t = useTranslations();
  const format = useFormat();
  return (
    <ProductFigure label={label}>
      <div className={MAIN_CARD}>
        <div className="flex flex-col gap-1">
          <span className="text-caption text-secondary-text desk:text-secondary">{t("common.portfolioValue")}</span>
          <span className={LEAD_FIGURE}>{format.currency(1300000)}</span>
          <span className="font-display text-secondary font-semibold whitespace-nowrap text-positive">{`${format.currency(50000, { signed: true })} (${format.percent(4)})`}</span>
        </div>
        <SampleChart
          id="feature-portfolio"
          tone="accent"
          end={[320, 22]}
          className="mt-1 h-36 sm:h-40 lg:h-44"
          points="0 100 C24 98 36 90 54 92 S84 84 104 80 S136 86 158 72 S196 62 214 64 S250 46 270 44 S304 30 320 22"
        />
      </div>
      <div className={cn(FLOAT_CARD, "-mt-12 gap-3 p-4")}>
        <p className="font-display text-secondary font-semibold text-primary-text">{t("common.allocation")}</p>
        <div className="flex h-2 gap-1">
          {ALLOCATION.map((part) => (
            <span key={part.key} className={cn("rounded-full", part.grow, part.tone)} />
          ))}
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
          {ALLOCATION.map((part) => (
            <li key={part.key} className="flex items-center gap-2 text-caption text-secondary-text">
              <span className={cn("size-2 rounded-full", part.tone)} />
              <span>{t(part.key)}</span>
              <span className="font-display font-semibold text-primary-text">{format.percent(part.share, { digits: 0, signed: false })}</span>
            </li>
          ))}
        </ul>
      </div>
    </ProductFigure>
  );
}

/*
 * Bento miniatures: a few rows of a product area at small size, drawn inside `BentoCard`'s frame (which hides them
 * from assistive technology and makes them unselectable). Same rules as the visuals above: sample values, no controls.
 */

/** A small product card inside a miniature. */
const MINI_SURFACE = "rounded-[0.875rem] border border-card-border bg-card-background shadow-(--panel-shadow)";
/** A row inside a miniature's surface. */
const MINI_ROW = "flex min-h-11 items-center gap-3 border-b border-hairline last:border-b-0";
/** A preset chip as in the simulator, at miniature size. */
const miniChip = (selected: boolean) =>
  cn(
    "inline-flex min-h-7 items-center rounded-full border px-2.5 text-caption font-medium whitespace-nowrap",
    selected ? "border-transparent bg-accent-soft text-accent" : "border-field-border text-primary-text",
  );

/** `/simulador`: the projected value for a sample scenario, the horizon presets and the estimated evolution. */
export function SimulatorMiniature() {
  const t = useTranslations();
  const format = useFormat();
  const horizons = [t("common.oneYear"), ...[3, 5, 10].map((years) => t("simulation.duration.years", { arg1: String(years) }))];
  return (
    <div className={cn(MINI_SURFACE, "grid gap-x-6 gap-y-4 p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]")}>
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-caption text-secondary-text">{t("simulation.result.estimatedFinalValue")}</span>
          <span className="font-display text-[1.625rem] leading-tight font-semibold tracking-tight whitespace-nowrap text-primary-text sm:text-[1.875rem]">
            {format.currency(1600000)}
          </span>
          <span className="flex flex-wrap gap-x-1.5 text-caption">
            <span className="font-semibold whitespace-nowrap text-positive">{`${format.currency(600000, { signed: true })} (${format.percent(60, { digits: 0 })})`}</span>
            <span className="text-secondary-text">{t("simulation.result.ofInvested", { arg1: format.currency(1000000) })}</span>
          </span>
        </div>
        <div className="hidden flex-wrap gap-1.5 sm:flex">
          {horizons.map((label, index) => (
            <span key={label} className={miniChip(index === 2)}>
              {label}
            </span>
          ))}
        </div>
      </div>
      <svg viewBox="0 0 320 140" preserveAspectRatio="none" focusable="false" className="block h-28 w-full self-end overflow-visible md:h-full md:min-h-32">
        <defs>
          <linearGradient id="bento-simulation" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[35, 70, 105].map((y) => (
          <line key={y} x1="0" x2="320" y1={y} y2={y} strokeDasharray="3 5" vectorEffect="non-scaling-stroke" className="stroke-chart-grid" />
        ))}
        <path d="M0 104 C70 100 130 90 190 74 S280 38 320 22 L320 140 L0 140 Z" fill="url(#bento-simulation)" />
        <path d="M0 104 H320" strokeWidth={1.5} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" className="fill-none stroke-secondary-text" />
        <path d="M0 104 C70 100 130 90 190 74 S280 38 320 22" strokeWidth={2.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" className="fill-none stroke-accent" />
      </svg>
    </div>
  );
}

/** Daily volumes as bar heights; the last session is the unusual one. */
const VOLUME_BARS = ["h-[30%]", "h-[42%]", "h-[24%]", "h-[36%]", "h-[46%]", "h-[28%]", "h-[38%]", "h-[32%]", "h-[44%]", "h-[26%]", "h-[34%]", "h-full"];

/** `/atividade-invulgar`: one instrument's signals and its volume against the usual sessions. */
export function UnusualActivityMiniature() {
  const t = useTranslations();
  const format = useFormat();
  const times = (value: number) => `${format.number(value, { digits: 1 })}×`;
  return (
    <div className={cn(MINI_SURFACE, "flex flex-col gap-4 p-4")}>
      <SampleInstrument symbol={t("onboarding.preview.symbol")} kind={t("common.stocks")} />
      <ul className="flex flex-col gap-1.5 text-caption">
        <li>
          <span className="font-semibold text-primary-text">{times(3.2)}</span> <span className="text-secondary-text">{t("unusualActivity.signal.volume")}</span>
        </li>
        <li>
          <span className="font-semibold text-positive">{format.percent(4, { digits: 1 })}</span>{" "}
          <span className="text-secondary-text">{t("unusualActivity.signal.priceMove", { arg1: times(2.5) })}</span>
        </li>
      </ul>
      <div className="flex h-20 items-end gap-1">
        {VOLUME_BARS.map((height, index) => (
          <span key={index} className={cn("flex-1 rounded-[0.1875rem]", height, index === VOLUME_BARS.length - 1 ? "bg-accent" : "bg-accent/20")} />
        ))}
      </div>
    </div>
  );
}

/** `/noticias`: the feed's rows (kind, day, title), with sample titles in the app's own wording. */
export function NewsMiniature() {
  const t = useTranslations();
  const format = useFormat();
  const rows = [
    { kind: t("news.kind.weeklyRecap"), day: t("common.today"), title: t("intelligence.weeklyClose.headline", { arg1: format.count(6), arg2: format.count(10) }) },
    { kind: t("news.kind.article"), day: t("common.today"), title: t("intelligence.watchlistMover.headline", { arg1: t("onboarding.preview.symbol"), arg2: format.percent(2, { digits: 0 }) }) },
    { kind: t("news.kind.dailyRecap"), day: t("common.yesterday"), title: t("watchlist.breadth.headline", { arg1: format.count(4), arg2: format.count(2) }) },
  ];
  return (
    <ul className={cn(MINI_SURFACE, "flex flex-col px-4")}>
      {rows.map((row) => (
        <li key={row.kind} className="flex flex-col gap-1 border-b border-hairline py-3 last:border-b-0">
          <span className="text-caption text-secondary-text">{`${row.kind} · ${row.day}`}</span>
          <span className="line-clamp-2 font-display text-secondary font-medium text-primary-text">{row.title}</span>
        </li>
      ))}
    </ul>
  );
}

/** `/aprender`: the first lessons, two of them read. */
export function LearnMiniature() {
  const t = useTranslations();
  return (
    <ul className={cn(MINI_SURFACE, "flex flex-col px-3")}>
      {LESSONS.slice(0, 4).map((lesson, index) => (
        <li key={lesson.id} className={MINI_ROW}>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
            <Icon name={lesson.icon} className="text-[0.9375rem]" />
          </span>
          <span className="min-w-0 flex-1 truncate font-display text-secondary font-medium text-primary-text">{t(`learn.${lesson.id}.title`)}</span>
          {index < 2 ? <Icon name="check-circle" className="text-[1.0625rem] text-positive" /> : <Icon name="chevron-right" className="text-[1rem] text-tertiary-text" />}
        </li>
      ))}
    </ul>
  );
}

/** A sample week (Monday to Friday) and its dividend dates: day index → event. */
const SAMPLE_WEEK = { year: 2026, month: 10, firstDay: 23 };
const WEEK_EVENTS = [
  { day: 2, title: "market.event.exDividendDate", symbol: "BAI" },
  { day: 4, title: "market.event.dividendPayment", symbol: "BFA" },
] as const;

/** `/semana`: the week's days with their dated events marked, and the events. */
export function WeekAheadMiniature() {
  const t = useTranslations();
  const format = useFormat();
  const weekday = new Intl.DateTimeFormat(format.locale === "en" ? "en-GB" : "pt-AO", { weekday: "short", timeZone: "UTC" });
  const [selected] = WEEK_EVENTS;
  return (
    <div className="flex flex-col gap-3">
      <div className={cn(MINI_SURFACE, "grid grid-cols-5 gap-1 p-1.5")}>
        {[0, 1, 2, 3, 4].map((day) => {
          const date = SAMPLE_WEEK.firstDay + day;
          const active = day === selected.day;
          const marked = WEEK_EVENTS.some((event) => event.day === day);
          return (
            <span key={day} className={cn("flex flex-col items-center gap-0.5 rounded-[0.625rem] py-1.5", active ? "bg-accent-soft text-accent" : "text-primary-text")}>
              <span className={cn("text-micro uppercase", active ? "text-accent" : "text-secondary-text")}>
                {weekday.format(new Date(Date.UTC(SAMPLE_WEEK.year, SAMPLE_WEEK.month, date))).replace(".", "").slice(0, 3)}
              </span>
              <span className="font-display text-secondary font-semibold">{format.count(date)}</span>
              <span className={cn("size-1 rounded-full", marked ? "bg-accent" : "bg-transparent")} />
            </span>
          );
        })}
      </div>
      <ul className={cn(MINI_SURFACE, "flex grow flex-col px-3")}>
        {WEEK_EVENTS.map((event) => (
          <li key={event.day} className={MINI_ROW}>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Icon name="calendar" className="text-[0.9375rem]" />
            </span>
            <span className="min-w-0 flex-1 py-2 font-display text-secondary font-medium text-primary-text">{t(event.title)}</span>
            <span className="font-display text-caption font-semibold text-secondary-text">{event.symbol}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
