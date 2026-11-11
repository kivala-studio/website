"use client";

import Decimal from "decimal.js";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { decodePoints, type WirePoint } from "@/data/market/history-wire";
import {
  type IntradayChartSnapshot,
  type MarketSecurity,
  type OrderBookLevel,
  type PricePoint,
  assetShareContent,
  availableOrderBook,
  canExportPriceHistory,
  decodeIntradayChart,
  decodeOrderBookRows,
  depthBarScale,
  exportPriceHistoryCSV,
  isBondKind,
  liquidityProfile,
  orderBookDepthLimit,
  orderBookFromRows,
  orderBookLayout,
  priceHistoryCSVFileName,
} from "@/domain/market";
import { FREE_PLAN_LIMITS } from "@/domain/account/access";
import { useAccount } from "@/features/account/account-provider";
import { WatchStar } from "@/features/search/watch-star";
import { useMarketState } from "@/features/market/market-provider";
import { cn } from "@/ui/cn";
import { Button } from "@/ui/components/buttons";
import { Dialog } from "@/ui/components/dialog";
import { SectionHeader } from "@/ui/components/layout";
import { SectionPlaceholder } from "@/ui/components/states";
import { useFormat } from "@/ui/format";
import { Icon } from "@/ui/icons/icon";

import { ComparisonSheet } from "./comparison-sheet";
import type { InstrumentData } from "./instrument-view";

type Remote<T> = { data?: T; failed: boolean; loading: boolean };

/**
 * One account endpoint for this instrument: fetched while `enabled`, again every `everyMs` while the tab is
 * visible, and applied only when it still answers for the signed-in account. No automatic retry on failure.
 */
export function useAccountResource<T>(
  url: string,
  decode: (body: Record<string, unknown>) => T,
  { enabled, everyMs }: { enabled: boolean; everyMs?: number },
): Remote<T> & { reload: () => void } {
  const account = useAccount();
  const userID = account?.userID;
  const [state, setState] = useState<Remote<T>>({ failed: false, loading: false });
  const [attempt, setAttempt] = useState(0);
  const decodeRef = useRef(decode);
  useEffect(() => {
    decodeRef.current = decode;
  });

  useEffect(() => {
    if (!enabled || !userID) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      if (document.hidden) return;
      setState((previous) => ({ ...previous, loading: true }));
      try {
        const response = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as Record<string, unknown>;
        if (body.userID !== userID) return;
        const data = decodeRef.current(body);
        setState({ data, failed: false, loading: false });
      } catch {
        if (controller.signal.aborted) return;
        setState((previous) => ({ ...previous, failed: true, loading: false }));
        return;
      }
      if (everyMs) timer = setTimeout(() => void run(), everyMs);
    };
    const onVisibility = () => {
      clearTimeout(timer);
      if (!document.hidden && everyMs) void run();
    };
    void run();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [url, enabled, everyMs, userID, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { ...state, reload };
}

/** Today's 5-minute series (`1D`), refreshed every minute while shown. */
export function useIntraday(id: string, enabled: boolean) {
  return useAccountResource<IntradayChartSnapshot>(`/api/account/intraday/${id}`, (body) => decodeIntradayChart(body.chart, Date.now()), {
    enabled,
    everyMs: 60_000,
  });
}

/** Every daily close the account may read (`Tudo`, CSV). */
export function useFullHistory(id: string, enabled: boolean) {
  return useAccountResource<PricePoint[]>(
    `/api/account/history/${id}`,
    (body) => {
      if (!Array.isArray(body.points)) throw new Error("points");
      return decodePoints(body.points as WirePoint[]);
    },
    { enabled },
  );
}

function download(text: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: fileName });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const ACTION = "motion-press inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-action-surface text-primary-text disabled:opacity-42";

/**
 * The instrument's account actions (iOS toolbar and bottom bar): compare, alerts, star, share and history
 * export. Nothing for visitors.
 */
export function InstrumentActions({ instrument, security, at, points }: { instrument: InstrumentData; security?: MarketSecurity; at?: number; points?: readonly PricePoint[] }) {
  const t = useTranslations();
  const format = useFormat();
  const account = useAccount();
  const [copied, setCopied] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [comparing, setComparing] = useState(false);
  const exportable = points !== undefined && canExportPriceHistory(points);
  const alerts = useAccountResource(
    `/api/account/alerts/${instrument.id}`,
    (body) => ({ enabled: Number(body.enabled) || 0, paused: Number(body.paused) || 0 }),
    { enabled: account !== null },
  );
  if (!account) return null;

  const share = async () => {
    const translate = (key: string, values?: Record<string, string>) => t(key as never, values as never);
    const content = security && at !== undefined ? assetShareContent(security, at, format, translate) : { subject: instrument.symbol, text: instrument.symbol };
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: content.subject, text: content.text, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(`${content.text}\n${url}`).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportHistory = async () => {
    if (!account.unlocksPlus) return account.requestUpgrade("priceExport");
    const response = await fetch(`/api/account/history/${instrument.id}`, { cache: "no-store" }).catch(() => null);
    const body = response?.ok ? ((await response.json()) as { userID?: string; points?: WirePoint[] }) : null;
    const rows = body?.userID === account.userID && Array.isArray(body.points) ? decodePoints(body.points) : points;
    if (rows && canExportPriceHistory(rows)) download(exportPriceHistoryCSV(rows), priceHistoryCSVFileName(instrument.symbol));
  };

  const counts = alerts.data;
  const alertLabel = !counts || counts.enabled + counts.paused === 0
    ? t("common.createAlert")
    : counts.enabled > 0
      ? counts.enabled === 1
        ? t("assetDetails.alerts.oneActive")
        : t("common.activeAlertsCount", { arg1: format.count(counts.enabled) })
      : counts.paused === 1
        ? t("assetDetails.alerts.onePaused")
        : t("assetDetails.alerts.manyPaused", { arg1: format.count(counts.paused) });
  const alertIcon = !counts || counts.enabled + counts.paused === 0 ? "notification" : "alert";

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-2" data-testid="instrument-actions">
      <div className="flex items-center justify-center gap-2">
        <WatchStar id={instrument.id} symbol={instrument.symbol} variant="toolbar" />
        <button type="button" onClick={() => void share()} aria-label={t("assetDetails.accessibility.shareInstrument")} title={t("assetDetails.accessibility.shareInstrument")} className={ACTION}>
          <Icon name={copied ? "check" : "share"} />
        </button>
        {exportable ? (
          <button
            type="button"
            onClick={() => void exportHistory()}
            aria-label={t("assetDetails.exportHistory")}
            title={t("assetDetails.exportHistory")}
            className={ACTION}
            data-testid="export-history"
          >
            <Icon name={account.unlocksPlus ? "download" : "lock"} />
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:flex lg:gap-2">
        <Button kind="secondary" icon="chart" onClick={() => setComparing(true)} disabled={!security} data-testid="compare" className="lg:w-auto">
          {t("common.compare")}
        </Button>
        <Button icon={alertIcon} onClick={() => setAlertsOpen(true)} data-testid="alerts" className="lg:w-auto">
          {alertLabel}
        </Button>
      </div>
      <Dialog open={alertsOpen} onClose={() => setAlertsOpen(false)} title={alertLabel}>
        <div className="px-5 pt-2 pb-8">
          <p className="text-body text-secondary-text">{t(counts && counts.enabled + counts.paused > 0 ? "assetDetails.accessibility.alertHintManage" : "assetDetails.accessibility.alertHintCreate")}</p>
        </div>
      </Dialog>
      {security ? <ComparisonSheet open={comparing} onClose={() => setComparing(false)} base={security} /> : null}
    </div>
  );
}

/** `Ordens`: the latest verified book, five levels a side without Pro, refreshed every minute while shown. */
export function OrderBookPanel({ instrument, security, at, active }: { instrument: InstrumentData; security?: MarketSecurity; at?: number; active: boolean }) {
  const t = useTranslations();
  const format = useFormat();
  const account = useAccount();
  const open = security?.marketStatus === "open";
  const book = useAccountResource(
    `/api/account/order-book/${instrument.id}`,
    (body) => (body.book === null ? {} : orderBookFromRows(decodeOrderBookRows([body.book]))),
    { enabled: active && account !== null, everyMs: open ? 60_000 : undefined },
  );
  if (!account) return null;
  const title = t("common.orderBook");
  if (book.data === undefined) return <SectionPlaceholder title={title} failed={book.failed} onRetry={book.reload} />;
  const levels = security && at !== undefined ? availableOrderBook({ ...security, ...book.data }, at) : undefined;
  if (!levels || levels.length === 0) {
    return (
      <section aria-labelledby="order-book" className="flex flex-col gap-3" data-testid="order-book">
        <SectionHeader id="order-book" title={title} />
        <p className="text-secondary text-secondary-text">{t("assetDetails.orders.emptyMessage")}</p>
      </section>
    );
  }
  const layout = orderBookLayout(levels, orderBookDepthLimit(account.unlocksPro));
  const money = (value: Decimal) => format.securityPrice(value, { bond: instrument.bond, code: instrument.currency });
  const levelWord = (count: number) => `${format.count(count)} ${t(count === 1 ? "legacy.nivel" : "legacy.niveis")}`;
  const cell = (level: OrderBookLevel | undefined, side: "bid" | "ask") => {
    if (!level) return <span className="flex min-h-16 items-center justify-center text-tertiary-text">—</span>;
    const scale = depthBarScale(level, layout.maximumQuantity).times(100).toNumber();
    const count = level.orderCount;
    return (
      <span
        className={cn("relative flex min-h-16 flex-col justify-center gap-0.5 overflow-hidden px-3 py-2", side === "bid" ? "items-end text-right" : "items-start text-left")}
        aria-label={t("assetDetails.accessibility.level", {
          arg1: t(side === "bid" ? "common.buy" : "common.sell"),
          arg2: format.count(level.level),
          arg3: money(level.price),
          arg4: format.quantity(level.quantity),
        })}
      >
        <span aria-hidden className={cn("absolute inset-y-1", side === "bid" ? "right-0 bg-positive/12" : "left-0 bg-negative/12")} style={{ width: `${scale}%` }} />
        <span aria-hidden className={cn("relative text-body font-semibold tabular-nums", side === "bid" ? "text-positive" : "text-negative")}>{money(level.price)}</span>
        <span aria-hidden className="relative text-caption text-secondary-text tabular-nums">
          {t("assetDetails.orderBook.quantity", { arg1: format.quantity(level.quantity) })}
          {count !== undefined ? ` · ${format.count(count)} ${t(count === 1 ? "legacy.ordem" : "legacy.ordens")}` : ""}
        </span>
      </span>
    );
  };
  return (
    <section aria-labelledby="order-book" className="flex flex-col gap-4" data-testid="order-book">
      <div className="flex flex-col gap-1">
        <SectionHeader id="order-book" title={title} />
        <p className="text-caption text-secondary-text">{t("assetDetails.orderBook.subtitle")}</p>
      </div>
      {layout.spread ? (
        <p className="flex items-baseline justify-between gap-3 border-b border-separator pb-3">
          <span className="text-secondary text-secondary-text">{t("common.bidAskSpread")}</span>
          <span className="text-body font-semibold text-primary-text tabular-nums">{money(layout.spread)}</span>
        </p>
      ) : null}
      <div className="grid grid-cols-2 text-caption font-semibold">
        <span className="pr-3 text-right text-positive">
          {t("common.buy")} · {levelWord(layout.bidCount)}
        </span>
        <span className="pl-3 text-negative">
          {t("common.sell")} · {levelWord(layout.askCount)}
        </span>
      </div>
      <ol className="flex flex-col" data-testid="order-book-levels">
        {layout.pairs.map((pair) => (
          <li key={pair.rank} className="grid grid-cols-2 divide-x divide-separator border-b border-separator">
            {cell(pair.bid, "bid")}
            {cell(pair.ask, "ask")}
          </li>
        ))}
      </ol>
      {layout.isTruncated || (!account.unlocksPro && layout.depth >= FREE_PLAN_LIMITS.orderBookLevels) ? (
        <Button kind="secondary" icon="lock" className="self-start" onClick={() => account.requestUpgrade("orderBookDepth")} data-testid="order-book-unlock">
          {/* The server withholds deeper levels from non-Pro accounts, so their number is known only when it sent them. */}
          {layout.isTruncated ? t("orderBook.unlockDepth", { arg1: format.count(layout.depth) }) : t("subscriptions.management.proTitle")}
        </Button>
      ) : null}
      <p className="text-caption text-secondary-text">{t("assetDetails.orderBook.barsNote")}</p>
      {layout.hasUnknownCounts ? <p className="text-caption text-secondary-text">{t("assetDetails.orderBook.countsNote")}</p> : null}
    </section>
  );
}

/** `Liquidez` (Plus): sessions with trades and average value over the last 20 sessions. */
export function LiquiditySection({ instrument, points }: { instrument: InstrumentData; points: readonly PricePoint[] }) {
  const t = useTranslations();
  const format = useFormat();
  const account = useAccount();
  const state = useMarketState();
  const index = state.load.kind === "loaded" ? state.load.snapshot.index.history : undefined;
  const now = state.assessedAt;
  const profile = useMemo(
    () =>
      now === undefined
        ? undefined
        : liquidityProfile({
            history: points,
            sessionDates: (index ?? []).map((point) => point.date),
            priceScale: new Decimal(isBondKind(instrument.kind) ? "0.01" : "1"),
            heldQuantity: new Decimal(0),
            now,
          }),
    [points, index, now, instrument.kind],
  );
  if (!account) return null;
  return (
    <section aria-labelledby="liquidity" className="flex flex-col gap-3" data-testid="liquidity">
      <SectionHeader id="liquidity" title={t("liquidity.title")} />
      {!account.unlocksPlus ? (
        <Button kind="secondary" icon="lock" className="self-start" onClick={() => account.requestUpgrade("liquidity")}>
          {t("liquidity.unlock")}
        </Button>
      ) : profile ? (
        <dl className="grid grid-cols-1 gap-x-6 min-[24rem]:grid-cols-2">
          <div className="flex min-h-18 flex-col justify-center gap-1 border-b border-separator py-2">
            <dt className="text-caption text-secondary-text">{t("liquidity.sessions")}</dt>
            <dd className="text-body text-primary-text">{t("liquidity.sessionsValue", { arg1: format.count(profile.tradedSessions), arg2: format.count(profile.sessions) })}</dd>
          </div>
          {instrument.bond ? null : (
            <div className="flex min-h-18 flex-col justify-center gap-1 border-b border-separator py-2">
              <dt className="text-caption text-secondary-text">{t("liquidity.averageValue")}</dt>
              <dd className="text-body text-primary-text">{format.currency(profile.averageDailyValue, { digits: 0 })}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="text-secondary text-secondary-text">{t("assetDetails.chart.notEnoughData")}</p>
      )}
    </section>
  );
}
