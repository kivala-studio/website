"use client";

import Decimal from "decimal.js";
import { useTranslations } from "next-intl";
import { type ReactNode, useMemo, useState } from "react";

import { type WirePoint, decodePoints } from "@/data/market/history-wire";
import {
  MARKET_MESSAGE_KEYS,
  type MarketSecurity,
  type PricePoint,
  type SecurityKind,
  type TimeRange,
  TIME_RANGE_LINE_WIDTH,
  displayPercentageChange,
  displayPrice,
  displayPriceChange,
  displayPriceDateLabel,
  displayPriceLabel,
  displayPriceVerification,
  hasUsableQuote,
  isRangeAvailable,
  kindLabelKey,
  marketSecurity,
  rangePerformance,
  rangePoints,
  referenceUnavailableKey,
  referenceUpdateIssue,
} from "@/domain/market";
import { PriceChart } from "@/features/chart/price-chart";
import { useMarketState, useMarketStore } from "@/features/market/market-provider";
import { cn } from "@/ui/cn";
import { SectionTabs, type TimeRange as RangeName, TimeRangePicker } from "@/ui/components/controls";
import { MarketStatusIndicator } from "@/ui/components/financial";
import { SectionHeader } from "@/ui/components/layout";
import { SecurityLogo } from "@/ui/components/rows";
import { ChartShimmer, SectionPlaceholder } from "@/ui/components/states";
import { useFormat } from "@/ui/format";
import { Icon } from "@/ui/icons/icon";

/** What the server knows about an instrument: identity and dated verified evidence, never a current price. */
export type InstrumentData = {
  id: string;
  symbol: string;
  /** Instrument or issuer name when it says more than the symbol. */
  name?: string;
  kind: SecurityKind;
  bond: boolean;
  currency: string;
  isin?: string;
  issuerName?: string;
  logoURL?: string;
  close?: { price: string; date: string; confirmedAt: number; change?: string };
};

const RANGES: Record<Exclude<RangeName, "oneDay" | "all">, TimeRange> = {
  oneWeek: "1S",
  oneMonth: "1M",
  threeMonths: "3M",
  sixMonths: "6M",
  oneYear: "1A",
};
const RANGE_NAMES = Object.keys(RANGES) as (keyof typeof RANGES)[];
const PERFORMANCE = [
  ["1S", "common.oneWeek"],
  ["1M", "common.oneMonth"],
  ["6M", "common.sixMonths"],
  ["1A", "common.oneYear"],
] as const;

const toneOf = (value: Decimal | undefined) =>
  value === undefined || value.isZero() ? "text-secondary-text" : value.gt(0) ? "text-positive" : "text-negative";

/** The store's view of this instrument once a snapshot has loaded, with the time it was assessed. */
function useLiveSecurity(id: string): { security?: MarketSecurity; at?: number; status?: MarketSecurity["marketStatus"] } {
  const state = useMarketState();
  const snapshot = state.load.kind === "loaded" ? state.load.snapshot : undefined;
  return useMemo(() => {
    const security = snapshot?.securities.find((item) => item.id === id);
    return { security, at: state.assessedAt, status: snapshot?.status };
  }, [snapshot, id, state.assessedAt]);
}

/** A current figure the policy allows; a last (expired) quote is not one and falls back to the dated close. */
function currentQuote(security: MarketSecurity | undefined, at: number | undefined) {
  if (!security || at === undefined) return undefined;
  const label = displayPriceLabel(security, at);
  const price = displayPrice(security, at);
  if (!label || !price || label === MARKET_MESSAGE_KEYS.price.lastQuote) return undefined;
  return { price, label, date: displayPriceDateLabel(security, at), amount: displayPriceChange(security, at), percentage: displayPercentageChange(security, at) };
}

export function InstrumentView({
  instrument,
  history,
  overview,
  about,
}: {
  instrument: InstrumentData;
  /** Server-read daily closes; null when that read failed. */
  history: WirePoint[] | null;
  /** Server-rendered sections placed before the client sections of each tab. */
  overview: ReactNode;
  about: ReactNode;
}) {
  const t = useTranslations();
  const format = useFormat();
  const store = useMarketStore();
  const state = useMarketState();
  const { security, at, status } = useLiveSecurity(instrument.id);
  const serverPoints = useMemo(() => (history ? decodePoints(history) : undefined), [history]);
  const points = state.histories[instrument.id] ?? serverPoints;
  const [rangeName, setRangeName] = useState<keyof typeof RANGES>("oneWeek");
  const [selected, setSelected] = useState<number>();
  const [tab, setTab] = useState(0);
  const range = RANGES[rangeName];
  const visible = useMemo(() => (points ? rangePoints(range, points) : []), [points, range]);
  const money = (value: Decimal.Value) => format.securityPrice(value, { bond: instrument.bond, code: instrument.currency });
  const changeText = (amount: Decimal | undefined, percentage: Decimal) =>
    amount === undefined
      ? format.percent(percentage)
      : `${format.quoteChange(amount, { bond: instrument.bond, code: instrument.currency, signed: true })} (${format.percent(percentage)})`;

  const live = currentQuote(security, at);
  const close = instrument.close;
  const selectedPoint = selected === undefined ? undefined : visible[selected];

  let headline: string;
  let movement: { text: string; tone: string } | undefined;
  let caption: string;
  if (selectedPoint) {
    headline = money(selectedPoint.value);
    const first = visible[0].value;
    if (!first.isZero()) {
      const amount = selectedPoint.value.minus(first);
      const percentage = amount.div(first).times(100);
      movement = { text: changeText(amount, percentage), tone: toneOf(percentage) };
    }
    caption = format.date(selectedPoint.date);
  } else if (live) {
    headline = money(live.price);
    if (live.percentage) movement = { text: changeText(live.amount, live.percentage), tone: toneOf(live.percentage) };
    const day = live.date?.kind === "today" ? t("common.today") : live.date?.kind === "yesterday" ? t("common.yesterday") : live.date ? format.civilDate(live.date.date) : undefined;
    caption = day ? `${t(live.label)} · ${day}` : t(live.label);
  } else if (close) {
    headline = money(close.price);
    if (close.change) movement = { text: format.percent(close.change), tone: toneOf(new Decimal(close.change)) };
    caption = t(MARKET_MESSAGE_KEYS.price.lastVerifiedClose, { arg1: format.civilDate(close.date) });
  } else {
    headline = t("common.priceUnconfirmed");
    caption = t(referenceUnavailableKey(security?.referenceUnavailableReason));
  }
  const issue = !selectedPoint && security ? referenceUpdateIssue(security.referenceUpdateStatus, security.referenceUpdateReason) : undefined;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col items-center gap-3 text-center">
        <SecurityLogo symbol={instrument.symbol} logoUrl={instrument.logoURL} brandColor={instrument.bond ? "violet" : "blue"} size="l" />
        <div className="flex flex-col gap-1">
          <h1 className="text-section text-primary-text">{instrument.symbol}</h1>
          {instrument.name ? <p className="text-secondary text-secondary-text">{instrument.name}</p> : null}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-caption text-secondary-text">{t(kindLabelKey(instrument.kind))}</span>
          {status ? <MarketStatusIndicator status={status} /> : null}
        </div>
        <div className="flex flex-col items-center gap-1" data-testid="instrument-price">
          <p className={cn("text-primary-text", selectedPoint || live || close ? "text-headline" : "text-display")}>
            <span className="sr-only">{`${t("common.price")}: `}</span>
            {headline}
          </p>
          {movement ? <p className={cn("text-secondary font-semibold", movement.tone)}>{movement.text}</p> : null}
          <p className="text-caption text-secondary-text" data-testid="instrument-price-label">
            {caption}
          </p>
          {issue ? (
            <p className="text-caption text-secondary-text">{issue.detailKey ? `${t(issue.key)}${t(issue.detailKey)}` : t(issue.key)}</p>
          ) : null}
        </div>
      </header>

      <section aria-label={t("assetDetails.history.header")} className="flex flex-col gap-4">
        {points === undefined ? (
          state.loadingHistories[instrument.id] ? (
            <ChartShimmer className="h-[258px]" />
          ) : (
            <div className="flex h-[258px] flex-col justify-center">
              <SectionPlaceholder title={t("assetDetails.history.header")} failed onRetry={() => void store.loadHistory(instrument.id, { force: true })} />
            </div>
          )
        ) : visible.length >= 2 ? (
          <PriceChart
            points={visible}
            bond={instrument.bond}
            currency={instrument.currency}
            lineWidth={TIME_RANGE_LINE_WIDTH[range]}
            selected={selected}
            onSelect={setSelected}
          />
        ) : (
          <div className="flex h-[258px] flex-col items-center justify-center gap-3 px-6 text-center text-secondary-text">
            <Icon name="chart" className="text-display" />
            <p className="text-body">{t("assetDetails.chart.notEnoughData")}</p>
          </div>
        )}
        <div className="self-end">
          <TimeRangePicker
            label={t("assetDetails.history.header")}
            ranges={RANGE_NAMES}
            value={rangeName}
            isEnabled={(name) => !!points && isRangeAvailable(RANGES[name as keyof typeof RANGES], points)}
            onChange={(name) => {
              setSelected(undefined);
              setRangeName(name as keyof typeof RANGES);
            }}
          />
        </div>
      </section>

      <div className="flex flex-col gap-8">
        <SectionTabs
          label={t("common.security")}
          titles={[t("assetDetails.tab.overview"), t("common.about")]}
          selected={tab}
          onSelect={setTab}
          idPrefix="instrument"
        />
        <div role="tabpanel" id="instrument-panel-0" aria-labelledby="instrument-tab-0" hidden={tab !== 0} className="flex flex-col gap-8">
          {overview}
          {points && points.length > 1 ? <Performance instrument={instrument} points={points} /> : null}
          <Statistics instrument={instrument} security={security} at={at} />
          <MarketInformation instrument={instrument} status={status} />
        </div>
        <div role="tabpanel" id="instrument-panel-1" aria-labelledby="instrument-tab-1" hidden={tab !== 1} className="flex flex-col gap-8">
          {about}
        </div>
      </div>
    </div>
  );
}

function Performance({ instrument, points }: { instrument: InstrumentData; points: readonly PricePoint[] }) {
  const t = useTranslations();
  const format = useFormat();
  const security = useMemo(
    () => marketSecurity({ id: instrument.id, symbol: instrument.symbol, kind: instrument.kind, history: points }),
    [instrument.id, instrument.symbol, instrument.kind, points],
  );
  return (
    <section aria-labelledby="performance" className="flex flex-col gap-4">
      <SectionHeader id="performance" title={t("common.performance")} />
      <dl className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4">
        {PERFORMANCE.map(([range, key]) => {
          const value = rangePerformance(security, range);
          return (
            <div key={range} className="flex flex-col gap-1">
              <dt className="text-caption text-secondary-text">{t(key)}</dt>
              <dd className={cn("text-body font-semibold", value === undefined ? "text-tertiary-text" : toneOf(value))}>
                {value === undefined ? "—" : format.percent(value)}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

function Fact({ title, value, tone }: { title: string; value: string; tone?: string }) {
  return (
    <div className="flex min-h-18 flex-col justify-center gap-1 border-b border-separator py-2">
      <dt className="text-caption text-secondary-text">{title}</dt>
      <dd className={cn("text-body text-primary-text", tone)}>{value}</dd>
    </div>
  );
}

function Statistics({ instrument, security, at }: { instrument: InstrumentData; security?: MarketSecurity; at?: number }) {
  const t = useTranslations();
  const format = useFormat();
  const money = (value: Decimal.Value) => format.securityPrice(value, { bond: instrument.bond, code: instrument.currency });
  const live = currentQuote(security, at);
  const usable = security && at !== undefined && hasUsableQuote(security, at);
  const details = usable ? security.details : undefined;
  const verifiedAt = security && at !== undefined ? displayPriceVerification(security, at) : instrument.close?.confirmedAt;
  const items: [string, string][] = [];
  if (live) items.push([t("common.price"), money(live.price)]);
  if (details?.openingPrice) items.push([t("assetDetails.statistics.open"), money(details.openingPrice)]);
  if (details?.highPrice) items.push([t("common.high"), money(details.highPrice)]);
  if (details?.lowPrice) items.push([t("assetDetails.statistics.low"), money(details.lowPrice)]);
  items.push([t("markets.sort.volume"), usable ? format.count(security.volume) : t("common.unavailable")]);
  if (details?.tradeCount !== undefined) items.push([t("assetDetails.statistics.tradeCount"), format.count(details.tradeCount)]);
  items.push([
    t("common.lastVerificationDate"),
    verifiedAt === undefined ? t("assetDetails.statistics.verificationUnavailable") : format.timestamp(verifiedAt),
  ]);
  return (
    <section aria-labelledby="statistics" className="flex flex-col gap-2">
      <SectionHeader id="statistics" title={t("assetDetails.statistics.header")} />
      <dl className="grid grid-cols-1 gap-x-6 min-[24rem]:grid-cols-2">
        {items.map(([title, value]) => (
          <Fact key={title} title={title} value={value} />
        ))}
      </dl>
    </section>
  );
}

const STATUS_TONE = { unknown: "text-secondary-text", closed: "text-secondary-text", openingSoon: "text-warning", open: "text-positive" } as const;

function MarketInformation({ instrument, status = "unknown" }: { instrument: InstrumentData; status?: MarketSecurity["marketStatus"] }) {
  const t = useTranslations();
  const rows: [string, string, string?][] = [[t("assetDetails.marketInfo.symbol"), instrument.symbol]];
  if (instrument.isin) rows.push([t("assetDetails.bondFacts.isin"), instrument.isin]);
  rows.push([t("assetDetails.marketInfo.type"), t(kindLabelKey(instrument.kind))]);
  if (instrument.issuerName) rows.push([t("common.issuer"), instrument.issuerName]);
  rows.push([t("common.currency"), instrument.currency], [t("common.market"), "BODIVA"]);
  rows.push([t("assetDetails.marketInfo.tradingStatus"), t(MARKET_MESSAGE_KEYS.status[status]), STATUS_TONE[status]]);
  return (
    <section aria-labelledby="market-information" className="flex flex-col gap-2">
      <SectionHeader id="market-information" title={t("common.marketInformation")} />
      <dl className="flex flex-col">
        {rows.map(([title, value, tone]) => (
          <div key={title} className="flex items-baseline justify-between gap-5 border-b border-separator py-3">
            <dt className="text-secondary text-secondary-text">{title}</dt>
            <dd className={cn("text-right text-secondary font-medium break-all text-primary-text", tone)}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Dividend yield needs a usable current quote; otherwise "—". */
export function DividendYield({ id, amount }: { id: string; amount: string }) {
  const format = useFormat();
  const { security, at } = useLiveSecurity(id);
  const usable = security && at !== undefined && hasUsableQuote(security, at) && security.price.gt(0);
  return <>{usable ? format.percent(new Decimal(amount).div(security.price).times(100), { signed: false }) : "—"}</>;
}
