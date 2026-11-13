"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

import { type MarketSecurity, type TimeRange, TIME_RANGE_DAYS, currentQuotePrices, displayPrice, isBondKind } from "@/domain/market";
import {
  type PortfolioTransaction,
  ledgerPositions,
  ledgerResults,
  portfolioAllocations,
  portfolioPeriodChange,
  portfolioSummary,
  portfolioValueSeries,
  validateLedger,
  valuePositions,
} from "@/domain/portfolio";
import { priceScalesOf } from "@/domain/portfolio/records";
import { useAccountStores } from "@/features/account/account-provider";
import type { CatalogueRow } from "@/features/market/browse/price-cell";
import { useMarketState, useMarketStore } from "@/features/market/market-provider";

import { PORTFOLIO_REFRESH_MS } from "./portfolio-store";

/** What the portfolio pages know about an instrument: the catalogue's identity, then the live snapshot. */
export type PortfolioInstrument = {
  id: string;
  symbol: string;
  name: string;
  kind: MarketSecurity["kind"];
  currency: string;
  bond: boolean;
  logoURL?: string;
};

export type ValueState = "pending" | "full" | "partial" | "unavailable";

/** The ledger store for this page: loaded on arrival, re-read every minute while visible, suspended on leave. */
export function usePortfolioStore() {
  const store = useAccountStores()!.portfolio;
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => {
    void store.load();
    const refresh = () => {
      if (document.hidden) return;
      const { loadedAt } = store.getSnapshot();
      if (loadedAt === null || Date.now() - loadedAt >= PORTFOLIO_REFRESH_MS - 1000) void store.load({ quiet: true });
    };
    const timer = setInterval(refresh, PORTFOLIO_REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      store.suspend();
    };
  }, [store]);
  return { store, snapshot };
}

/**
 * The ledger valued in the browser: positions and results from the W2 calculator, current value only from
 * quotes the policy accepts as current (a closing reference never values a position).
 */
export function usePortfolio(rows: readonly CatalogueRow[], renderedAt: number) {
  const { store, snapshot } = usePortfolioStore();
  const market = useMarketState();
  const marketStore = useMarketStore();
  const live = market.load.kind === "loaded" ? market.load.snapshot : undefined;
  const at = market.assessedAt;
  const asOf = at ?? renderedAt;
  const transactions = snapshot.transactions;

  const instruments = useMemo(() => {
    const map = new Map<string, PortfolioInstrument>();
    for (const row of rows) map.set(row.id, { id: row.id, symbol: row.symbol, name: row.name, kind: row.kind, currency: row.currency, bond: row.bond, logoURL: row.logoURL });
    for (const security of live?.securities ?? []) {
      if (!map.has(security.id))
        map.set(security.id, { id: security.id, symbol: security.symbol, name: security.name, kind: security.kind, currency: security.currency ?? "AOA", bond: isBondKind(security.kind), logoURL: security.logoURL });
    }
    return map;
  }, [rows, live]);
  const securities = useMemo(() => new Map((live?.securities ?? []).map((security) => [security.id, security])), [live]);
  const priceScales = useMemo(() => priceScalesOf([...instruments.values()]), [instruments]);

  const ledger = useMemo(() => {
    const options = { asOf, priceScales };
    const valid = validateLedger(transactions, options) === "valid";
    return { valid, positions: ledgerPositions(transactions, options), results: ledgerResults(transactions, options) };
  }, [transactions, asOf, priceScales]);

  const prices = useMemo(() => (live && at !== undefined ? Object.fromEntries(currentQuotePrices(live.securities, at)) : undefined), [live, at]);
  const valuations = useMemo(() => valuePositions(ledger.positions, prices ?? {}), [ledger.positions, prices]);
  const summary = useMemo(() => portfolioSummary(valuations), [valuations]);
  const allocations = useMemo(() => portfolioAllocations(valuations), [valuations]);
  const priced = valuations.length - summary.missingPriceCount;
  const valueState: ValueState = prices === undefined ? "pending" : priced === 0 ? "unavailable" : summary.missingPriceCount > 0 ? "partial" : "full";

  // Daily closes of every instrument the ledger ever held, for the value chart.
  const held = useMemo(() => [...new Set(transactions.filter((item) => item.kind !== "income").map((item) => item.securityId))].sort(), [transactions]);
  useEffect(() => {
    for (const id of held) void marketStore.loadHistory(id);
  }, [held, marketStore]);
  const histories = useMemo(() => Object.fromEntries(held.flatMap((id) => (market.histories[id] ? [[id, market.histories[id]]] : []))), [held, market.histories]);
  const historyPending = held.some((id) => market.histories[id] === undefined && !market.historyErrors[id]);

  const series = useCallback(
    (range: TimeRange) => {
      const points = portfolioValueSeries(transactions, histories, { asOf, priceScales, rangeDays: TIME_RANGE_DAYS[range] ?? null });
      return { points, change: portfolioPeriodChange(points) };
    },
    [transactions, histories, asOf, priceScales],
  );

  /** The current price the instrument page would show, for the editor's reference line. */
  const lastQuote = (id: string) => {
    const security = securities.get(id);
    return security && at !== undefined && prices?.[id] !== undefined ? displayPrice(security, at) : undefined;
  };

  return {
    store,
    status: snapshot.status,
    transactions,
    instruments,
    securities,
    asOf,
    valid: ledger.valid,
    positions: ledger.positions,
    results: ledger.results,
    valuations,
    summary,
    allocations,
    valueState,
    historyPending,
    series,
    lastQuote,
    recordsOf: (securityId: string): PortfolioTransaction[] => transactions.filter((item) => item.securityId === securityId),
  };
}

export type PortfolioModel = ReturnType<typeof usePortfolio>;
