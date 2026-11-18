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
import { IconButton } from "@/ui/components/buttons";
import { SectionTabs, type TimeRange as RangeName, TimeRangePicker } from "@/ui/components/controls";
import { ChangeBadge, MarketStatusIndicator } from "@/ui/components/financial";
import { Card, StatStrip } from "@/ui/components/layout";
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

/**
 * The instrument page (CoinStats coin page layout). From 1024 px: a sticky sidebar with the identity (the page's
 * h1), the price and its validity line, the account actions, the key statistics and the market information, beside
 * a content column with the tabs and their cards, the chart first. Below 1024 px the sidebar is the top block of one
 * column and the market information moves to the end.
 */
export function InstrumentView({
  instrument,
  history,
  back,
  overview,
  about,
}: {
  instrument: InstrumentData;
  /** Server-read daily closes; null when that read failed. */
  history: WirePoint[] | null;
  /** The link back to the market list, first in the sidebar. */
  back: ReactNode;
  /** Server-rendered cards placed after the chart in Visão geral, and in Sobre. */
  overview: ReactNode;
  about: ReactNode;
}) {
  const t = useTranslations();
  const format = useFormat();
  const account = useAccount();
  const { security, at, status } = useLiveSecurity(instrument.id);
  const state = useMarketState();
  const serverPoints = useMemo(() => (history ? decodePoints(history) : undefined), [history]);
  const points = state.histories[instrument.id] ?? serverPoints;
  const [tab, setTab] = useState(0);
  const money = (value: Decimal.Value) => format.securityPrice(value, { bond: instrument.bond, code: instrument.currency });

  const live = currentQuote(security, at);
  const close = instrument.close;
  let headline: string | undefined;
  let change: { amount?: Decimal; percentage: Decimal } | undefined;
  let caption: string;
  if (live) {
    headline = money(live.price);
    if (live.percentage) change = { amount: live.amount, percentage: live.percentage };
    const day = live.date?.kind === "today" ? t("common.today") : live.date?.kind === "yesterday" ? t("common.yesterday") : live.date ? format.civilDate(live.date.date) : undefined;
    caption = day ? `${t(live.label)} · ${day}` : t(live.label);
  } else if (close) {
    headline = money(close.price);
    if (close.change) change = { percentage: new Decimal(close.change) };
    caption = t(MARKET_MESSAGE_KEYS.price.lastVerifiedClose, { arg1: format.civilDate(close.date) });
  } else {
    caption = t(referenceUnavailableKey(security?.referenceUnavailableReason));
  }
  const issue = security ? referenceUpdateIssue(security.referenceUpdateStatus, security.referenceUpdateReason) : undefined;

  return (
    <div className="flex flex-col gap-6 lg:-mt-6 lg:grid lg:grid-cols-[19.5rem_minmax(0,1fr)] lg:items-start lg:gap-0">
      {/* Sticky under the 64 px top bar, as tall as the window, scrolling on its own when it runs longer. */}
      <div className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-16 lg:-ml-3 lg:h-[calc(100dvh-4rem)] lg:overflow-y-auto lg:overscroll-contain lg:border-r lg:border-hairline lg:py-6 lg:pr-6 lg:pl-3 lg:[scrollbar-width:thin]">
        <header className="flex flex-col gap-4">
          {back}
          <div className="flex items-center gap-3">
            <SecurityLogo symbol={instrument.symbol} logoUrl={instrument.logoURL} brandColor={instrument.bond ? "violet" : "blue"} size="header" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <h1 className="font-display text-body font-semibold break-words text-primary-text desk:text-lg">
                {instrument.name ? (
                  <>
                    {instrument.name} <span className="text-secondary font-medium text-secondary-text">{instrument.symbol}</span>
                  </>
                ) : (
                  instrument.symbol
                )}
              </h1>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-caption text-secondary-text">{t(kindLabelKey(instrument.kind))}</span>
                {status ? <MarketStatusIndicator status={status} /> : null}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1" data-testid="instrument-price">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={cn("font-display text-primary-text", headline ? "text-[1.75rem] leading-tight font-semibold tracking-tight" : "text-section")}>
                <span className="sr-only">{`${t("common.price")}: `}</span>
                {headline ?? t("common.priceUnconfirmed")}
              </span>
              {change ? <ChangeBadge value={change.percentage} /> : null}
              {change?.amount ? (
                <span className={cn("text-secondary font-semibold", toneOf(change.percentage))}>
                  {format.quoteChange(change.amount, { bond: instrument.bond, code: instrument.currency, signed: true })}
                </span>
              ) : null}
            </p>
            <p className="text-caption text-secondary-text" data-testid="instrument-price-label">
              {caption}
            </p>
            {issue ? (
              <p className="text-caption text-secondary-text">{issue.detailKey ? `${t(issue.key)}${t(issue.detailKey)}` : t(issue.key)}</p>
            ) : null}
          </div>
        </header>

        <InstrumentActions instrument={instrument} security={security} at={at} points={points} />
        <Statistics instrument={instrument} security={security} at={at} />
        <div className="max-lg:hidden">
          <MarketInformation instrument={instrument} status={status} variant="sidebar" />
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-6 lg:py-6 lg:pl-6">
        <SectionTabs
          label={t("common.security")}
          titles={account ? [t("assetDetails.tab.overview"), t("common.about"), t("assetDetails.tab.orders")] : [t("assetDetails.tab.overview"), t("common.about")]}
          selected={tab}
          onSelect={setTab}
          idPrefix="instrument"
        />
        <div role="tabpanel" id="instrument-panel-0" aria-labelledby="instrument-tab-0" hidden={tab !== 0} className="flex flex-col gap-6">
          <HistoryCard instrument={instrument} security={security} at={at} points={points} />
          {overview}
          {points && points.length > 1 ? <Performance instrument={instrument} points={points} /> : null}
          {account && points && points.length > 0 ? <LiquiditySection instrument={instrument} points={points} /> : null}
        </div>
        <div role="tabpanel" id="instrument-panel-1" aria-labelledby="instrument-tab-1" hidden={tab !== 1} className="flex flex-col gap-6">
          {about}
        </div>
        {account ? (
          <div role="tabpanel" id="instrument-panel-2" aria-labelledby="instrument-tab-2" hidden={tab !== 2} className="flex flex-col gap-6">
            <OrderBookPanel instrument={instrument} security={security} at={at} active={tab === 2} />
          </div>
        ) : null}
      </div>

      <div className="lg:hidden">
        <MarketInformation instrument={instrument} status={status} variant="card" />
      </div>
    </div>
  );
}

/**
 * The price history card: the range control on a segmented track, then the chart. Scrubbing shows the chosen
 * observation (value, change from the range's first point, date) over the plot; the sidebar keeps the price.
 */
function HistoryCard({
  instrument,
  security,
  at,
  points,
}: {
  instrument: InstrumentData;
  security?: MarketSecurity;
  at?: number;
  points?: readonly PricePoint[];
}) {
  const t = useTranslations();
  const format = useFormat();
  const store = useMarketStore();
  const state = useMarketState();
  const account = useAccount();
  const [rangeName, setRangeName] = useState<RangeName>("oneWeek");
  const [selected, setSelected] = useState<number>();
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

  const selectedPoint = selected === undefined ? undefined : visible[selected];
  let readout: { value: string; change?: { text: string; tone: string }; date: string } | undefined;
  if (selectedPoint) {
    const first = visible[0].value;
    let change: { text: string; tone: string } | undefined;
    if (!first.isZero()) {
      const amount = selectedPoint.value.minus(first);
      const percentage = amount.div(first).times(100);
      change = {
        text: `${format.quoteChange(amount, { bond: instrument.bond, code: instrument.currency, signed: true })} (${format.percent(percentage)})`,
        tone: toneOf(percentage),
      };
    }
    readout = { value: money(selectedPoint.value), change, date: format.date(selectedPoint.date) };
  }
  const placeholder = "flex h-[258px] flex-col items-center justify-center gap-3 px-6 text-center text-secondary-text";

  return (
    <Card role="region" aria-label={t("assetDetails.history.header")} className="flex flex-col gap-4">
      <div className="sm:self-start">
        <TimeRangePicker
          variant="segmented"
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
      <div className="relative">
        {chartLoading ? (
          <ChartShimmer className="h-[258px]" />
        ) : range === "1D" && visible.length < 2 ? (
          <div className={placeholder} data-testid="intraday-empty">
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
          <div className={placeholder}>
            <Icon name="chart" className="text-display" />
            <p className="text-body">{t("assetDetails.chart.notEnoughData")}</p>
          </div>
        )}
        {/* The slider's value text already speaks the chosen observation. */}
        {readout && selected !== undefined ? (
          <div
            aria-hidden
            data-testid="chart-readout"
            className={cn(
              "pointer-events-none absolute top-0 flex flex-col gap-0.5 rounded-small border border-hairline bg-elevated-background/95 px-3 py-2 shadow-raised",
              selected < visible.length / 2 ? "right-16" : "left-0",
            )}
          >
            <span className="font-display text-body font-semibold text-primary-text">{readout.value}</span>
            {readout.change ? <span className={cn("text-caption font-semibold", readout.change.tone)}>{readout.change.text}</span> : null}
            <span className="text-caption text-secondary-text">{readout.date}</span>
          </div>
        ) : null}
      </div>
      {intradayLine ? (
        <div className="flex flex-wrap items-center gap-2 text-caption" data-testid="intraday-status">
          <span className={intradayLine.stale ? "font-semibold text-warning" : "text-secondary-text"}>{t(intradayLine.key)}</span>
          {intradayLine.stale ? (
            <IconButton icon="refresh" variant="outline" label={t("assetDetails.accessibility.retrySession")} onClick={intraday.reload} />
          ) : null}
          {intradayLine.showsLastTradeNote ? <span className="basis-full text-secondary-text">{t("assetDetails.chart.lastTradeNote")}</span> : null}
        </div>
      ) : null}
    </Card>
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
    <Card title={t("common.performance")} titleId="performance">
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
    </Card>
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
    <section aria-labelledby="statistics">
      <h2 id="statistics" className="sr-only">
        {t("assetDetails.statistics.header")}
      </h2>
      <StatStrip variant="grid" items={items.map(([title, value]) => ({ title, value }))} className="sm:grid-cols-3 lg:grid-cols-2" />
    </section>
  );
}

const STATUS_TONE = { unknown: "text-secondary-text", closed: "text-secondary-text", openingSoon: "text-warning", open: "text-positive" } as const;

/** Label–value rows: the sidebar's last block from 1024 px (heading for assistive tech only), a card at the end of the page below. */
function MarketInformation({
  instrument,
  status = "unknown",
  variant,
}: {
  instrument: InstrumentData;
  status?: MarketSecurity["marketStatus"];
  variant: "sidebar" | "card";
}) {
  const t = useTranslations();
  const rows: [string, string, string?][] = [[t("assetDetails.marketInfo.symbol"), instrument.symbol]];
  if (instrument.isin) rows.push([t("assetDetails.bondFacts.isin"), instrument.isin]);
  rows.push([t("assetDetails.marketInfo.type"), t(kindLabelKey(instrument.kind))]);
  if (instrument.issuerName) rows.push([t("common.issuer"), instrument.issuerName]);
  rows.push([t("common.currency"), instrument.currency], [t("common.market"), "BODIVA"]);
  rows.push([t("assetDetails.marketInfo.tradingStatus"), t(MARKET_MESSAGE_KEYS.status[status]), STATUS_TONE[status]]);
  const list = (
    <dl className="flex flex-col">
      {rows.map(([title, value, tone]) => (
        <div key={title} className="flex min-h-11 items-baseline justify-between gap-5 border-b border-hairline py-2.5 last:border-b-0">
          <dt className="text-secondary text-secondary-text">{title}</dt>
          <dd className={cn("text-right text-secondary font-medium break-all text-primary-text", tone)}>{value}</dd>
        </div>
      ))}
    </dl>
  );
  if (variant === "card") {
    return (
      <Card title={t("common.marketInformation")} titleId="market-information-card" bodyClassName="pt-1!">
        {list}
      </Card>
    );
  }
  return (
    <section aria-labelledby="market-information">
      <h2 id="market-information" className="sr-only">
        {t("common.marketInformation")}
      </h2>
      {list}
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
