import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { type MarketSecurity, type PricePoint, type QuoteAvailability, marketSecurity } from "./models";
import { dailyPriceChange } from "./quote-policy";
import {
  TIME_RANGES,
  TIME_RANGE_LINE_WIDTH,
  type TimeRange,
  availableRanges,
  comparisonDisplayedPrice,
  isRangeAvailable,
  rangeMovement,
  rangePerformance,
  rangePoints,
} from "./time-range";
import { DAY_MS, parseInstant } from "./zone";

const END = 1_800_000_000_000;
const point = (date: number, value: number): PricePoint => ({ date, value: new Decimal(value) });
const daily = (count: number) => Array.from({ length: count }, (_, offset) => point(END + (offset - count + 1) * DAY_MS, 100 + offset));
const values = (points: readonly PricePoint[]) => points.map((item) => item.value.toNumber());

function makeSecurity(input: { price?: number; percentageChange?: number; history?: PricePoint[]; quoteAvailability?: QuoteAvailability } = {}): MarketSecurity {
  return marketSecurity({
    id: "AAA",
    symbol: "AAA",
    name: "Título AAA",
    issuer: "Emitente AAA",
    kind: "equity",
    price: new Decimal(input.price ?? 100),
    percentageChange: new Decimal(input.percentageChange ?? 1.5),
    volume: new Decimal(100),
    history: input.history ?? [],
    quoteAvailability: input.quoteAvailability ?? "available",
  });
}

describe("time ranges", () => {
  it("one day keeps only the latest trading day ticks", () => {
    const points = [point(END - DAY_MS, 98), point(END - 300_000, 100), point(END, 102)];
    expect(values(rangePoints("1D", points))).toEqual([100, 102]);
    expect(isRangeAvailable("1D", points.slice(-2))).toBe(true);
  });

  it("the comparison uses the latest intraday price for one day", () => {
    const points = [point(100_000, 97_000), point(200_000, 100_000)];
    expect(comparisonDisplayedPrice("1D", new Decimal(97_000), points)?.toNumber()).toBe(100_000);
    expect(comparisonDisplayedPrice("1S", new Decimal(97_000), points)?.toNumber()).toBe(97_000);
  });

  it("the daily price change is derived from the percentage change", () => {
    expect(dailyPriceChange(makeSecurity({ price: 102, percentageChange: 2 }), END).toNumber()).toBeCloseTo(2, 4);
  });

  it("performance uses the selected historical range", () => {
    const security = makeSecurity({ history: daily(40) });
    expect(rangePerformance(security, "1S")?.toNumber()).toBeCloseTo(((139 - 133) / 133) * 100, 4);
    expect(rangePerformance(security, "1M")?.toNumber()).toBeCloseTo(((139 - 110) / 110) * 100, 4);
    expect(rangePerformance(security, "6M")).toBeUndefined();
    expect(rangePerformance(security, "1A")).toBeUndefined();
  });

  it("an unavailable quote has no performance", () => {
    const security = makeSecurity({ quoteAvailability: "unavailable" });
    expect(rangePerformance(security, "1S")).toBeUndefined();
    expect(rangePerformance(security, "1A")).toBeUndefined();
  });

  it("available ranges follow the history span", () => {
    expect(availableRanges([])).toEqual(["1S"]);
    expect(availableRanges(daily(40))).toEqual(["1S", "1M", "Tudo"]);
    expect(availableRanges(daily(190))).toEqual(["1S", "1M", "3M", "6M", "Tudo"]);
    expect(availableRanges(daily(400))).toEqual(["1S", "1M", "3M", "6M", "1A", "Tudo"]);
  });

  it("movement for a range", () => {
    const security = makeSecurity({ history: daily(40) });
    const week = rangeMovement(security, "1S");
    expect(week.amount.toNumber()).toBeCloseTo(139 - 133, 4);
    expect(week.percentage.toNumber()).toBeCloseTo(((139 - 133) / 133) * 100, 4);
    const month = rangeMovement(security, "1M");
    expect(month.amount.toNumber()).toBeCloseTo(139 - 110, 4);
    expect(month.percentage.toNumber()).toBeCloseTo(((139 - 110) / 110) * 100, 4);
  });

  it("chart line width thins with longer ranges", () => {
    expect(TIME_RANGE_LINE_WIDTH["1S"]).toBe(2.5);
    expect(TIME_RANGE_LINE_WIDTH.Tudo).toBe(0.6);
    const ordered: TimeRange[] = ["1S", "1M", "3M", "6M", "1A", "Tudo"];
    for (let index = 0; index < ordered.length - 1; index += 1) {
      expect(TIME_RANGE_LINE_WIDTH[ordered[index]]).toBeGreaterThan(TIME_RANGE_LINE_WIDTH[ordered[index + 1]]);
    }
    for (const range of TIME_RANGES) expect(TIME_RANGE_LINE_WIDTH[range]).toBeGreaterThanOrEqual(0.6);
  });

  // SupabaseErrorBoundaryTests: the decoded legacy series; the fetch itself belongs to the data layer.
  it("legacy prices open the long ranges", () => {
    const points = ["2024-01-02", "2024-12-30", "2026-09-25", "2026-09-28"].map((day) => point(parseInstant(`${day}T12:00:00+01:00`) ?? Number.NaN, 30_000));
    expect(availableRanges(points)).toEqual(["1S", "1M", "3M", "6M", "1A", "Tudo"]);
    expect(rangePoints("Tudo", points)).toHaveLength(4);
  });
});
