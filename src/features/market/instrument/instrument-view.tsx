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
  TIME_RANGE_LINE_WIDTH,
  displayPercentageChange,
  displayPrice,
  displayPriceChange,
  displayPriceDateLabel,
  displayPriceLabel,
  displayPriceVerification,
  hasUsableQuote,
  intradayChartPoints,
  intradayEmptyKey,
  intradayStatusLine,
  isRangeAvailable,
  kindLabelKey,
  marketSecurity,
  rangePerformance,
  rangePoints,
  referenceUnavailableKey,
  referenceUpdateIssue,
} from "@/domain/market";
import { useAccount } from "@/features/account/account-provider";
import { PriceChart } from "@/features/chart/price-chart";
import { RANGE_OF } from "@/features/chart/ranges";
import { useMarketState, useMarketStore } from "@/features/market/market-provider";
import { cn } from "@/ui/cn";
import { SectionTabs, type TimeRange as RangeName, TimeRangePicker } from "@/ui/components/controls";
import { MarketStatusIndicator } from "@/ui/components/financial";
import { Panel, SectionHeader, StatStrip } from "@/ui/components/layout";
import { SecurityLogo } from "@/ui/components/rows";
import { ChartShimmer, SectionPlaceholder } from "@/ui/components/states";
import { useFormat } from "@/ui/format";
import { Icon } from "@/ui/icons/icon";

import { InstrumentActions, LiquiditySection, OrderBookPanel, useFullHistory, useIntraday } from "./account-panels";

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

/** Visitors: daily closes up to a year. Accounts add today's session (`1D`) and the full history (`Tudo`, Plus). */
const PUBLIC_RANGES: readonly RangeName[] = ["oneWeek", "oneMonth", "threeMonths", "sixMonths", "oneYear"];
const ACCOUNT_RANGES: readonly RangeName[] = ["oneDay", ...PUBLIC_RANGES, "all"];
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
  const account = useAccount();
  const { security, at, status } = useLiveSecurity(instrument.id);
  const serverPoints = useMemo(() => (history ? decodePoints(history) : undefined), [history]);
  const points = state.histories[instrument.id] ?? serverPoints;
  const [rangeName, setRangeName] = useState<RangeName>("oneWeek");
  const [selected, setSelected] = useState<number>();
  const [tab, setTab] = useState(0);
  const range = RANGE_OF[rangeName];
  const intraday = useIntraday(instrument.id, account !== null && range === "1D");
  const full = useFullHistory(instrument.id, account !== null && account.unlocksPlus && range === "Tudo");
  const today = at !== undefined ? state.calendar?.day(at, at) : undefined;
  const sessionOpensAt = today?.kind === "trading" ? today.session.opensAt : undefined;
  const visible = useMemo(() => {
    if (range === "1D") {
      const data = intraday.data?.points ?? [];
      return security && sessionOpensAt !== undefined ? intradayChartPoints(security, data, sessionOpensAt) : [...data];
    }
    if (range === "Tudo") return full.data ? rangePoints(range, full.data) : [];
    return points ? rangePoints(range, points) : [];
  }, [points, range, intraday.data, full.data, security, sessionOpensAt]);
  const chartLoading = range === "1D" ? intraday.data === undefined && !intraday.failed : range === "Tudo" ? full.data === undefined && !full.failed : false;
  const intradayLine = range === "1D" ? intradayStatusLine(intraday.data, intraday.failed) : undefined;
  const ranges = account ? ACCOUNT_RANGES : PUBLIC_RANGES;
  const rangeEnabled = (name: RangeName) => {
    if (name === "oneDay") return today?.kind !== "nonTrading";
    if (name === "all") return !!points && points.length >= 2;
    return !!points && isRangeAvailable(RANGE_OF[name], points);
  };
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
    <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_18.75rem] lg:items-start lg:gap-6">
      <div className="flex min-w-0 flex-col gap-8 lg:gap-6">
    {/* From 1024 px: one panel with the identity and actions on top, the price, the chart and the key statistics. */}
    <div className="flex flex-col gap-8 lg:panel lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-4 lg:gap-y-5 lg:overflow-hidden lg:p-5 lg:pb-0">
      <header className="flex flex-col items-center gap-3 text-center lg:contents lg:text-left">
        <div className="flex flex-col items-center gap-3 lg:min-w-0 lg:flex-row">
          <SecurityLogo symbol={instrument.symbol} logoUrl={instrument.logoURL} brandColor={instrument.bond ? "violet" : "blue"} size="l" />
          <div className="flex min-w-0 flex-col items-center gap-1 lg:items-start lg:gap-0.5">
            <div className="flex flex-col gap-1 lg:flex-row lg:items-baseline lg:gap-2">
              <h1 className="text-section text-primary-text">{instrument.symbol}</h1>
              {instrument.name ? <p className="text-secondary text-secondary-text lg:truncate">{instrument.name}</p> : null}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-caption text-secondary-text">{t(kindLabelKey(instrument.kind))}</span>
              {status ? <MarketStatusIndicator status={status} /> : null}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1 lg:col-span-2 lg:items-start" data-testid="instrument-price">
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

      <div className="lg:col-start-2 lg:row-start-1 lg:self-center">
        <InstrumentActions instrument={instrument} security={security} at={at} points={points} />
      </div>

      <section aria-label={t("assetDetails.history.header")} className="flex flex-col gap-4 lg:col-span-2 lg:-mx-2">
        {chartLoading ? (
          <ChartShimmer className="h-[258px]" />
        ) : range === "1D" && visible.length < 2 ? (
          <div className="flex h-[258px] flex-col items-center justify-center gap-3 px-6 text-center text-secondary-text" data-testid="intraday-empty">
            <Icon name="chart" className="text-display" />
            <p className="text-body">{t(intradayEmptyKey(intraday.data, intraday.failed))}</p>
          </div>
        ) : range === "Tudo" && full.failed ? (
          <div className="flex h-[258px] flex-col justify-center">
            <SectionPlaceholder title={t("assetDetails.history.header")} failed onRetry={full.reload} />
          </div>
        ) : points === undefined && range !== "1D" ? (
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
        {intradayLine ? (
          <div className="flex flex-wrap items-center gap-2 text-caption" data-testid="intraday-status">
            <span className={intradayLine.stale ? "font-semibold text-warning" : "text-secondary-text"}>{t(intradayLine.key)}</span>
            {intradayLine.stale ? (
              <button
                type="button"
                onClick={intraday.reload}
                aria-label={t("assetDetails.accessibility.retrySession")}
                className="inline-flex size-11 items-center justify-center rounded-full border border-separator text-primary-text"
              >
                <Icon name="refresh" />
              </button>
            ) : null}
            {intradayLine.showsLastTradeNote ? <span className="basis-full text-secondary-text">{t("assetDetails.chart.lastTradeNote")}</span> : null}
          </div>
        ) : null}
        <div className="self-end lg:px-2">
          <TimeRangePicker
            label={t("assetDetails.history.header")}
            ranges={ranges}
            value={rangeName}
            isEnabled={rangeEnabled}
            onChange={(name) => {
              if (name === "all" && account && !account.unlocksPlus) return account.requestUpgrade("history");
              setSelected(undefined);
              setRangeName(name);
            }}
          />
        </div>
      </section>

      <Statistics instrument={instrument} security={security} at={at} />
    </div>

      <div className="flex flex-col gap-8 lg:panel lg:gap-6 lg:px-5 lg:pb-6">
        <SectionTabs
          label={t("common.security")}
          titles={account ? [t("assetDetails.tab.overview"), t("common.about"), t("assetDetails.tab.orders")] : [t("assetDetails.tab.overview"), t("common.about")]}
          selected={tab}
          onSelect={setTab}
          idPrefix="instrument"
        />
        <div role="tabpanel" id="instrument-panel-0" aria-labelledby="instrument-tab-0" hidden={tab !== 0} className="flex flex-col gap-8">
          {overview}
          {points && points.length > 1 ? <Performance instrument={instrument} points={points} /> : null}
          {account && points && points.length > 0 ? <LiquiditySection instrument={instrument} points={points} /> : null}
        </div>
        <div role="tabpanel" id="instrument-panel-1" aria-labelledby="instrument-tab-1" hidden={tab !== 1} className="flex flex-col gap-8">
          {about}
        </div>
        {account ? (
          <div role="tabpanel" id="instrument-panel-2" aria-labelledby="instrument-tab-2" hidden={tab !== 2} className="flex flex-col gap-8">
            <OrderBookPanel instrument={instrument} security={security} at={at} active={tab === 2} />
          </div>
        ) : null}
      </div>
      </div>

      <aside className="lg:sticky lg:top-20">
        <MarketInformation instrument={instrument} status={status} />
      </aside>
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
    <section aria-labelledby="statistics" className="flex flex-col gap-2 lg:col-span-2 lg:-mx-5 lg:border-t lg:border-hairline">
      <h2 id="statistics" className="text-section text-primary-text lg:sr-only">
        {t("assetDetails.statistics.header")}
      </h2>
      <StatStrip items={items.map(([title, value]) => ({ title, value }))} className="max-lg:rounded-large max-lg:border max-lg:border-hairline max-lg:bg-card-background" />
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
    <Panel title={t("common.marketInformation")} titleId="market-information" flush>
      <dl className="flex flex-col lg:px-4">
        {rows.map(([title, value, tone]) => (
          <div key={title} className="flex items-baseline justify-between gap-5 border-b border-separator py-3 lg:border-hairline lg:py-2.5 lg:last:border-b-0">
            <dt className="text-secondary text-secondary-text">{title}</dt>
            <dd className={cn("text-right text-secondary font-medium break-all text-primary-text", tone)}>{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

/** Dividend yield needs a usable current quote; otherwise "—". */
export function DividendYield({ id, amount }: { id: string; amount: string }) {
  const format = useFormat();
  const { security, at } = useLiveSecurity(id);
  const usable = security && at !== undefined && hasUsableQuote(security, at) && security.price.gt(0);
  return <>{usable ? format.percent(new Decimal(amount).div(security.price).times(100), { signed: false }) : "—"}</>;
}
