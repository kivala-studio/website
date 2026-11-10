import Decimal from "decimal.js";

import type { MarketSecurity, PricePoint } from "./models";
import { DAY_MS, type EpochMs, isSameDay, startOfDay } from "./zone";

export const TIME_RANGES = ["1D", "1S", "1M", "3M", "6M", "1A", "Tudo"] as const;
export type TimeRange = (typeof TIME_RANGES)[number];

export const TIME_RANGE_LABEL_KEYS: Record<TimeRange, string> = {
  "1D": "market.range.oneDay",
  "1S": "market.range.oneWeek",
  "1M": "market.range.oneMonth",
  "3M": "market.range.threeMonths",
  "6M": "market.range.sixMonths",
  "1A": "market.range.oneYear",
  Tudo: "common.all",
};

/** Calendar days covered by each range; `Tudo` is the whole series. */
export const TIME_RANGE_DAYS: Record<TimeRange, number | undefined> = {
  "1D": 1,
  "1S": 7,
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1A": 365,
  Tudo: undefined,
};

/** Chart stroke width per range: longer ranges draw thinner lines. */
export const TIME_RANGE_LINE_WIDTH: Record<TimeRange, number> = {
  "1D": 2.5,
  "1S": 2.5,
  "1M": 2,
  "3M": 1.5,
  "6M": 1.3,
  "1A": 1,
  Tudo: 0.6,
};

/**
 * A range needs two points. `1D` needs them on one Luanda day; fixed ranges need a span of at least
 * max(7, 90 % of the range) and two points inside it. `1S` and `Tudo` only need two points.
 */
export function isRangeAvailable(range: TimeRange, points: readonly PricePoint[]): boolean {
  if (points.length < 2) return false;
  const dates = points.map((point) => point.date);
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  if (range === "1D") return isSameDay(minDate, maxDate);
  const dayCount = TIME_RANGE_DAYS[range];
  if (dayCount === undefined || range === "1S") return true;
  const days = Math.floor((maxDate - minDate) / DAY_MS);
  const threshold = Math.max(7, Math.floor(dayCount * 0.9));
  const windowStart = maxDate - (dayCount - 1) * DAY_MS;
  return days >= threshold && points.filter((point) => point.date >= windowStart).length >= 2;
}

/** Ranges with enough history; `1S` when none qualifies. */
export function availableRanges(points: readonly PricePoint[]): TimeRange[] {
  const ranges = TIME_RANGES.filter((range) => isRangeAvailable(range, points));
  return ranges.length === 0 ? ["1S"] : ranges;
}

/** Points inside the range, ending at the last point. */
export function rangePoints(range: TimeRange, points: readonly PricePoint[]): PricePoint[] {
  const end = points.at(-1)?.date;
  if (end === undefined) return [];
  if (range === "1D") return points.filter((point) => isSameDay(point.date, end));
  const dayCount = TIME_RANGE_DAYS[range];
  if (dayCount === undefined) return [...points];
  const start = end - (dayCount - 1) * DAY_MS;
  return points.filter((point) => point.date >= start);
}

const HUNDRED = new Decimal(100);
const ZERO = new Decimal(0);

/** Change from the first to the last point of the range; zero when there is no comparable pair. */
export function rangeMovement(
  security: MarketSecurity,
  range: TimeRange,
  intradayPoints?: readonly PricePoint[],
): { amount: Decimal; percentage: Decimal } {
  const none = { amount: ZERO, percentage: ZERO };
  if (security.quoteAvailability !== "available") return none;
  const points = range === "1D" ? (intradayPoints ?? rangePoints(range, security.history)) : rangePoints(range, security.history);
  const first = points[0]?.value;
  const last = points.at(-1)?.value;
  if (first === undefined || last === undefined || first.isZero() || points.length < 2) return none;
  const amount = last.minus(first);
  return { amount, percentage: amount.div(first).times(HUNDRED) };
}

/** Percentage performance over an available range. */
export function rangePerformance(security: MarketSecurity, range: TimeRange): Decimal | undefined {
  if (security.quoteAvailability !== "available" || !isRangeAvailable(range, security.history)) return undefined;
  const points = rangePoints(range, security.history);
  const first = points[0]?.value;
  const last = points.at(-1)?.value;
  if (first === undefined || last === undefined || first.isZero()) return undefined;
  return last.minus(first).div(first).times(HUNDRED);
}

/** The price a comparison chart ends on: the last intraday point for `1D`, otherwise the quote. */
export function comparisonDisplayedPrice(
  range: TimeRange,
  quotedPrice: Decimal,
  intradayPoints: readonly PricePoint[],
): Decimal | undefined {
  if (range === "1D") return intradayPoints.findLast((point) => point.value.isFinite() && point.value.gt(0))?.value;
  return quotedPrice.isFinite() && quotedPrice.gt(0) ? quotedPrice : undefined;
}

/**
 * Intraday points with the previous close prepended as an anchor 1 ms before the session opens
 * (or before the first point, if earlier). The anchor carries no trade or volume data.
 */
export function intradayChartPoints(
  security: MarketSecurity,
  points: readonly PricePoint[],
  sessionOpensAt: EpochMs,
): PricePoint[] {
  const first = points[0];
  if (!first) return [];
  const sessionDay = startOfDay(sessionOpensAt);
  const closes = security.history.filter((point) => point.date < sessionDay && point.value.isFinite() && point.value.gt(0));
  const close = security.closingPrice;
  if (close && close.tradingDate < sessionDay && close.price.isFinite() && close.price.gt(0)) {
    closes.push({ date: close.tradingDate, value: close.price });
  }
  if (closes.length === 0) return [...points];
  const previous = closes.reduce((latest, point) => (point.date > latest.date ? point : latest));
  return [{ date: Math.min(sessionOpensAt, first.date) - 1, value: previous.value }, ...points];
}
