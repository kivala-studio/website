import type { HistoryAssessment, PriceObservation } from "../market/history-validation";
import { permitsInsight } from "../market/quality";
import { percentageChange } from "./math";
import type { AssetPriceChangeFact, WatchlistClosingExtremeFact, WatchlistSessionRunFact } from "./models";

/*
 * iOS `FinancialFactCalculator.priceChanges` and `WatchlistFactCalculator`: measurements of verified series only.
 * Significance gates belong to the semantic generators.
 */

/** First and last verified close of each series, only when the period itself passed validation. */
export function priceChanges(quality: HistoryAssessment): Map<string, AssetPriceChangeFact> {
  const result = new Map<string, AssetPriceChangeFact>();
  if (!permitsInsight(quality.period)) return result;
  for (const [id, rows] of quality.verified) {
    const first = rows[0];
    const last = rows.at(-1);
    if (!first || !last) continue;
    const percentage = percentageChange(first.price, last.price);
    if (percentage === null) continue;
    result.set(id, {
      assetID: first.assetID,
      currencyCode: first.currencyCode,
      startPrice: first.price,
      endPrice: last.price,
      percentageChange: percentage,
      firstObservedAt: first.observedAt,
      lastObservedAt: last.observedAt,
    });
  }
  return result;
}

/** The run of strictly rising or falling closes that ends on the last session. */
export function sessionRun(rows: readonly PriceObservation[]): WatchlistSessionRunFact | null {
  if (rows.length < 2) return null;
  const last = rows[rows.length - 1];
  const previous = rows[rows.length - 2];
  const direction = last.price.greaterThan(previous.price) ? 1 : last.price.lessThan(previous.price) ? -1 : 0;
  if (direction === 0) return null;
  let firstIndex = rows.length - 1;
  while (firstIndex > 0) {
    const current = rows[firstIndex].price;
    const before = rows[firstIndex - 1].price;
    if (!((direction > 0 && current.greaterThan(before)) || (direction < 0 && current.lessThan(before)))) break;
    firstIndex -= 1;
  }
  const sessions = rows.length - 1 - firstIndex;
  const percentage = percentageChange(rows[firstIndex].price, last.price);
  if (percentage === null) return null;
  return {
    assetID: last.assetID,
    direction,
    sessions,
    startPrice: rows[firstIndex].price,
    endPrice: last.price,
    percentage,
    firstObservedAt: rows[firstIndex].observedAt,
    lastObservedAt: last.observedAt,
  };
}

/** A last close beyond every earlier close in the series. */
export function closingExtreme(rows: readonly PriceObservation[]): WatchlistClosingExtremeFact | null {
  if (rows.length < 2) return null;
  const first = rows[0];
  const last = rows[rows.length - 1];
  const earlier = rows.slice(0, -1).map((row) => row.price);
  const high = earlier.reduce((max, price) => (price.greaterThan(max) ? price : max));
  const low = earlier.reduce((min, price) => (price.lessThan(min) ? price : min));
  const isHigh = last.price.greaterThan(high);
  if (!isHigh && !last.price.lessThan(low)) return null;
  const previous = isHigh ? high : low;
  const gap = percentageChange(previous, last.price);
  if (gap === null) return null;
  return {
    assetID: last.assetID,
    isHigh,
    previousExtreme: previous,
    closingPrice: last.price,
    percentageBeyondPrevious: gap,
    observationCount: rows.length,
    firstObservedAt: first.observedAt,
    lastObservedAt: last.observedAt,
  };
}
