import Decimal from "decimal.js";

import { type AssetPriceChangeFact, type FinancialFact, type InformationSignificance, type Insight, type WatchlistBreadthFact, WATCHLIST_SIGNIFICANCE } from "./models";

/*
 * iOS `FinancialMath`, `FinancialFactCalculator` (breadth, market summary), `InsightSignificance`, `InsightInterpretation`.
 * Foundation `Decimal` keeps 38 significant digits and rounds `.plain` (half up); `Dec` matches it.
 */

export const Dec = Decimal.clone({ precision: 38, rounding: Decimal.ROUND_HALF_UP, minE: -128, maxE: 165 });
export type Numeric = Decimal | string | number;
const dec = (value: Numeric) => new Dec(value);
const HUNDRED = new Dec(100);

export function percentage(value: Numeric, total: Numeric): Decimal | null {
  const v = dec(value);
  const t = dec(total);
  if (v.isNaN() || t.isNaN() || !t.greaterThan(0)) return null;
  const result = v.div(t).times(HUNDRED);
  return result.isFinite() ? result : null;
}

/** Unrounded percentage points. Presentation chooses precision; invalid or overflowing values fail closed. */
export function percentageChange(start: Numeric, end: Numeric): Decimal | null {
  const s = dec(start);
  const e = dec(end);
  if (s.isNaN() || e.isNaN() || !s.greaterThan(0) || e.lessThan(0)) return null;
  const result = e.minus(s).div(s).times(HUNDRED);
  return result.isFinite() ? result : null;
}

export function breadth(changes: readonly AssetPriceChangeFact[]): WatchlistBreadthFact {
  return {
    rising: changes.filter((c) => c.percentageChange.greaterThan(0)).length,
    falling: changes.filter((c) => c.percentageChange.lessThan(0)).length,
    unchanged: changes.filter((c) => c.percentageChange.isZero()).length,
    assetCount: changes.length,
  };
}

export interface MarketSummary {
  readonly breadth: WatchlistBreadthFact;
  readonly strongestRisingAssetID: string | null;
  readonly strongestFallingAssetID: string | null;
}

const byID = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function marketSummary(assetIDs: ReadonlySet<string>, facts: ReadonlyMap<string, AssetPriceChangeFact>): MarketSummary | null {
  if (assetIDs.size === 0 || [...assetIDs].some((id) => !facts.has(id))) return null;
  const changes = [...assetIDs].map((id) => facts.get(id)!);
  const rising = [...changes].sort((a, b) => b.percentageChange.comparedTo(a.percentageChange) || byID(a.assetID, b.assetID));
  const falling = changes.filter((c) => c.percentageChange.lessThan(0)).sort((a, b) => a.percentageChange.comparedTo(b.percentageChange) || byID(a.assetID, b.assetID));
  return {
    breadth: breadth(changes),
    strongestRisingAssetID: rising.find((c) => c.percentageChange.greaterThan(0))?.assetID ?? null,
    strongestFallingAssetID: falling[0]?.assetID ?? null,
  };
}

/** Editorial significance of calculated facts, independent of user behaviour and ranking weights. */
export const SIGNIFICANCE = {
  noteworthyMovement: new Dec(WATCHLIST_SIGNIFICANCE.minimumMovement),
  significantMovement: new Dec(3),
  materialMovement: new Dec(5),
  concentrationDisclosure: new Dec(50),
} as const;

export function movementSignificance(value: Numeric): InformationSignificance {
  const magnitude = dec(value);
  if (magnitude.isNaN()) return "routine";
  const abs = magnitude.abs();
  if (abs.greaterThanOrEqualTo(SIGNIFICANCE.materialMovement)) return "material";
  if (abs.greaterThanOrEqualTo(SIGNIFICANCE.significantMovement)) return "significant";
  if (abs.greaterThanOrEqualTo(SIGNIFICANCE.noteworthyMovement)) return "noteworthy";
  return "routine";
}

export type InsightDirection = "rising" | "falling" | "unchanged";

export interface InsightInterpretation {
  readonly movementPercentage: Decimal | null;
  readonly significance: InformationSignificance;
  readonly direction: InsightDirection | null;
}

export function movementPercentage(fact: FinancialFact): Decimal | null {
  switch (fact.kind) {
    case "priceChange":
      return fact.value.percentageChange;
    case "watchlistMovement":
      return fact.value.movement.percentageChange;
    case "watchlistSessionRun":
      return fact.value.percentage;
    case "watchlistClosingExtreme":
      return fact.value.percentageBeyondPrevious;
    case "portfolioPerformance":
      return fact.value.percentage;
    default:
      return null;
  }
}

export function interpret(fact: FinancialFact): InsightInterpretation {
  const movement = movementPercentage(fact);
  let significance: InformationSignificance;
  switch (fact.kind) {
    case "watchlistInformation":
      significance = "noteworthy";
      break;
    case "breadth":
      significance = "significant";
      break;
    case "portfolioAllocation": {
      const first = fact.value.positions[0];
      significance = first && first.percentage.greaterThanOrEqualTo(SIGNIFICANCE.concentrationDisclosure) ? "significant" : "routine";
      break;
    }
    default:
      significance = movementSignificance(movement ?? 0);
  }
  const direction = movement === null ? null : movement.greaterThan(0) ? "rising" : movement.lessThan(0) ? "falling" : "unchanged";
  return { movementPercentage: movement, significance, direction };
}

export const insightInterpretation = (insight: Insight) => interpret(insight.fact);
