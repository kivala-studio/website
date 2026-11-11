import Decimal from "decimal.js";

import type { PricePoint } from "./models";
import { type EpochMs, MINUTE_MS, startOfDay } from "./zone";

/*
 * iOS `ChartComparisonMath`. The displayed price per range is `comparisonDisplayedPrice`
 * (time-range.ts); nearest-point selection and drag pacing live in `chart/selection.ts`.
 */

export interface InstantRange {
  readonly start: EpochMs;
  readonly end: EpochMs;
}

const BUCKET_MS = 5 * MINUTE_MS;
const HUNDRED = new Decimal(100);

const positive = (value: Decimal) => value.isFinite() && value.gt(0);

/**
 * The last observation per five-minute bucket, matching the trade-candle resolution without
 * filling missing intervals. With `preservingFirstPoint`, the first point is a prior-close anchor
 * kept as is, and an observation in the anchor's own bucket keeps its actual time.
 */
export function fiveMinuteObservations(points: readonly PricePoint[], preservingFirstPoint = false): PricePoint[] {
  const first = preservingFirstPoint ? points[0] : undefined;
  const observations = first === undefined ? points : points.slice(1);
  const buckets = new Map<EpochMs, PricePoint>();
  for (const point of [...observations].sort((a, b) => a.date - b.date)) {
    if (!positive(point.value)) continue;
    const bucket = Math.floor(point.date / BUCKET_MS) * BUCKET_MS;
    // A reference at session opening must survive observations in that same bucket.
    const date = first !== undefined && bucket <= first.date ? point.date : bucket;
    buckets.set(bucket, { date, value: point.value });
  }
  const sorted = [...buckets.values()].sort((a, b) => a.date - b.date);
  return first === undefined ? sorted : [first, ...sorted];
}

/**
 * The span of observations every series shares inside `requested`; needs two shared observations,
 * which become both endpoints. `byDay` matches Luanda sessions instead of exact times.
 */
export function commonObservationInterval(
  histories: readonly (readonly PricePoint[])[],
  requested: InstantRange,
  byDay = false,
): InstantRange | undefined {
  if (histories.length === 0) return undefined;
  const sets = histories.map(
    (history) =>
      new Set(
        history
          .filter((point) => positive(point.value) && point.date >= requested.start && point.date <= requested.end)
          .map((point) => (byDay ? startOfDay(point.date) : point.date)),
      ),
  );
  const common = [...sets[0]].filter((date) => sets.every((set) => set.has(date)));
  if (common.length < 2) return undefined;
  return { start: Math.min(...common), end: Math.max(...common) };
}

/** The requested start or the newest first-available date; undefined while any instrument lacks history. */
export function effectiveStartDate(requestedStart: EpochMs, firstAvailableDates: readonly (EpochMs | undefined)[]): EpochMs | undefined {
  if (firstAvailableDates.length === 0 || firstAvailableDates.some((date) => date === undefined)) return undefined;
  return Math.max(requestedStart, ...(firstAvailableDates as EpochMs[]));
}

/** Performance rebased to the instrument's own starting price, in percent. */
export function performancePercent(price: Decimal, baseline: Decimal): Decimal | undefined {
  if (!positive(price) || !positive(baseline)) return undefined;
  return price.div(baseline).minus(1).times(HUNDRED);
}
