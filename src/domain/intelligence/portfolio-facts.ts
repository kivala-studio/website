import type Decimal from "decimal.js";

import type { MarketCalendar } from "../market/calendar";
import { permitsInsight } from "../market/quality";
import { type EpochMs, DAY_MS, startOfDay } from "../market/zone";
import type { IntelligenceDebugRun } from "./debug";
import { Dec, percentage, percentageChange } from "./math";
import type {
  AssetPriceChangeFact,
  InsightPeriod,
  PortfolioAllocationFact,
  PortfolioAllocationGroup,
  PortfolioAllocationPosition,
  PortfolioInsightInput,
  PortfolioPerformancePosition,
  PortfolioPricePerformanceFact,
  PortfolioSecurityMetadata,
} from "./models";
import { periodContains } from "./models";
import { add, multiply, quantities, subtract, tradedOnNoon, tradingDay, validatePortfolioInput } from "./portfolio-validation";

/*
 * iOS `PortfolioFactCalculator`: deterministic valuation and allocation of a fixed ledger against verified
 * closes. No titles, surface policies or insight identities.
 */

export type PortfolioMeasurement = "allocation" | "performance";

export interface PortfolioFacts {
  readonly allocation: PortfolioAllocationFact | null;
  readonly performance: PortfolioPricePerformanceFact | null;
}

export interface PortfolioFactOptions {
  readonly comparisonPeriod: InsightPeriod;
  readonly calendar: MarketCalendar | null | undefined;
  readonly asOf: EpochMs;
  readonly maximumAgeMs: number;
  readonly enabled?: ReadonlySet<PortfolioMeasurement>;
  readonly debugRun?: IntelligenceDebugRun | null;
}

const byKey = <T>(map: ReadonlyMap<string, T>) => [...map].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
const compareIDs = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function calculatePortfolioFacts(
  input: PortfolioInsightInput,
  prices: ReadonlyMap<string, AssetPriceChangeFact>,
  options: PortfolioFactOptions,
): PortfolioFacts | null {
  const { comparisonPeriod, calendar, asOf, maximumAgeMs, debugRun } = options;
  const enabled = options.enabled ?? new Set<PortfolioMeasurement>(["allocation", "performance"]);
  const week = input.week;
  const lastSession = calendar?.sessions(week, asOf)?.at(-1);
  const closing =
    Number.isFinite(week.start) &&
    Number.isFinite(week.endExclusive) &&
    week.start < week.endExclusive &&
    week.endExclusive === comparisonPeriod.endExclusive &&
    lastSession !== undefined &&
    lastSession.closesAt <= asOf &&
    comparisonPeriod.start < week.start &&
    permitsInsight(validatePortfolioInput(input, asOf, maximumAgeMs))
      ? quantities(input.transactions, week.endExclusive)
      : null;
  if (!closing) {
    debugRun?.note("portfolio-context", "REJECTED", "invalid-comparison-calendar-or-ledger");
    return null;
  }
  const metadata = new Map(input.securities.map((security) => [security.assetID, security]));

  const eligible = (id: string): AssetPriceChangeFact | null => {
    const item = metadata.get(id);
    const fact = prices.get(id);
    if (
      !item ||
      !item.supportsUnitValuation ||
      item.currencyCode !== "AOA" ||
      item.symbol === "" ||
      !fact ||
      fact.currencyCode !== "AOA" ||
      !(fact.firstObservedAt < week.start)
    ) {
      debugRun?.note("portfolio-price-input", "REJECTED", "unsupported-metadata-currency-or-baseline", { id });
      return null;
    }
    return fact;
  };

  const allocation = enabled.has("allocation") ? allocationFact(closing, metadata, week.endExclusive, eligible) : null;
  if (!enabled.has("performance")) return { allocation, performance: null };
  const opening = input.transactions.some((transaction) => periodContains(week, startOfDay(tradingDay(transaction))))
    ? null
    : quantities(input.transactions, week.start);
  if (!opening) {
    debugRun?.note("portfolioPricePerformance", "REJECTED", "period-flows-or-invalid-opening-ledger");
    return { allocation, performance: null };
  }
  return { allocation, performance: performanceFact(opening, metadata, input, eligible) };
}

function performanceFact(
  holdings: ReadonlyMap<string, Decimal>,
  metadata: ReadonlyMap<string, PortfolioSecurityMetadata>,
  input: PortfolioInsightInput,
  eligible: (id: string) => AssetPriceChangeFact | null,
): PortfolioPricePerformanceFact | null {
  if (holdings.size === 0) return null;
  let start: Decimal = new Dec(0);
  let end: Decimal = new Dec(0);
  const values: { id: string; quantity: Decimal; start: Decimal; end: Decimal; contribution: Decimal }[] = [];
  let boundary: AssetPriceChangeFact | null = null;
  for (const [id, quantity] of byKey(holdings)) {
    const fact = eligible(id);
    if (!fact) return null;
    if (boundary && (boundary.firstObservedAt !== fact.firstObservedAt || boundary.lastObservedAt !== fact.lastObservedAt)) return null;
    boundary = fact;
    const first = multiply(quantity, fact.startPrice);
    const last = multiply(quantity, fact.endPrice);
    const nextStart = first && add(start, first);
    const nextEnd = last && add(end, last);
    const contribution = first && last && subtract(last, first);
    if (!first || !last || !nextStart || !nextEnd || !contribution) return null;
    start = nextStart;
    end = nextEnd;
    values.push({ id, quantity, start: first, end: last, contribution });
  }
  const change = boundary && subtract(end, start);
  const total = percentageChange(start, end);
  if (!boundary || !change || total === null) return null;
  // Date-only trades cannot establish holdings at an earlier close after a weekend or holiday change.
  const baselineCutoff = startOfDay(boundary.firstObservedAt) + DAY_MS;
  if (input.transactions.some((transaction) => tradedOnNoon(transaction) >= baselineCutoff && tradedOnNoon(transaction) < input.week.start)) return null;
  const positions: PortfolioPerformancePosition[] = [];
  for (const item of values) {
    const points = percentage(item.contribution, start);
    const security = metadata.get(item.id);
    if (points === null || !security) return null;
    positions.push({
      assetID: item.id,
      symbol: security.symbol,
      quantity: item.quantity,
      startValue: item.start,
      endValue: item.end,
      contribution: item.contribution,
      percentagePoints: points,
    });
  }
  positions.sort((a, b) => b.contribution.comparedTo(a.contribution) || compareIDs(a.assetID, b.assetID));
  return {
    startValue: start,
    endValue: end,
    change,
    percentage: total,
    firstObservedAt: boundary.firstObservedAt,
    lastObservedAt: boundary.lastObservedAt,
    positions,
    advancing: positions.filter((position) => position.contribution.greaterThan(0)).length,
    declining: positions.filter((position) => position.contribution.lessThan(0)).length,
    unchanged: positions.filter((position) => position.contribution.isZero()).length,
  };
}

function allocationFact(
  holdings: ReadonlyMap<string, Decimal>,
  metadata: ReadonlyMap<string, PortfolioSecurityMetadata>,
  cutoff: EpochMs,
  eligible: (id: string) => AssetPriceChangeFact | null,
): PortfolioAllocationFact | null {
  if (holdings.size === 0) return null;
  let total: Decimal = new Dec(0);
  const values: { id: string; quantity: Decimal; fact: AssetPriceChangeFact; value: Decimal }[] = [];
  for (const [id, quantity] of byKey(holdings)) {
    const fact = eligible(id);
    if (!fact || (values[0] && values[0].fact.lastObservedAt !== fact.lastObservedAt)) return null;
    const value = multiply(quantity, fact.endPrice);
    const next = value && add(total, value);
    if (!value || !next) return null;
    total = next;
    values.push({ id, quantity, fact, value });
  }
  const observedAt = values[0]?.fact.lastObservedAt;
  if (!total.greaterThan(0) || observedAt === undefined) return null;
  const positions: PortfolioAllocationPosition[] = [];
  for (const item of values) {
    const weight = percentage(item.value, total);
    const security = metadata.get(item.id);
    if (weight === null || !security) return null;
    positions.push({ assetID: item.id, symbol: security.symbol, quantity: item.quantity, price: item.fact.endPrice, value: item.value, percentage: weight });
  }
  positions.sort((a, b) => b.value.comparedTo(a.value) || compareIDs(a.assetID, b.assetID));
  const issuers = groups(positions, total, (position) => {
    const item = metadata.get(position.assetID);
    const id = clean(item?.issuerID);
    const name = clean(item?.issuerName);
    return id && name ? [id, name] : null;
  });
  // Only catalogue metadata; no sector inferred from a security name or symbol.
  const sectors = groups(positions, total, (position) => {
    const name = clean(metadata.get(position.assetID)?.sector);
    return name ? [name, name] : null;
  });
  return { totalValue: total, observedAt, holdingsCutoff: cutoff, positions, issuers, sectors };
}

function groups(
  positions: readonly PortfolioAllocationPosition[],
  total: Decimal,
  key: (position: PortfolioAllocationPosition) => readonly [string, string] | null,
): PortfolioAllocationGroup[] | null {
  const values = new Map<string, { name: string; ids: string[]; value: Decimal }>();
  for (const position of positions) {
    const pair = key(position);
    if (!pair) return null;
    const [id, name] = pair;
    const current = values.get(id) ?? { name, ids: [], value: new Dec(0) };
    const value = add(current.value, position.value);
    if (current.name !== name || !value) return null;
    values.set(id, { name, ids: [...current.ids, position.assetID], value });
  }
  const result: PortfolioAllocationGroup[] = [];
  for (const [id, item] of values) {
    const share = percentage(item.value, total);
    if (share === null) return null;
    result.push({ id, name: item.name, assetIDs: [...item.ids].sort(), value: item.value, percentage: share });
  }
  return result.sort((a, b) => b.value.comparedTo(a.value) || compareIDs(a.id, b.id));
}
