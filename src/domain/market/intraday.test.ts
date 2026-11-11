import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { MarketDecodingError } from "./decoding-error";
import { decodeIntradayChart, intradayStatusLine } from "./intraday";
import { type MarketSecurity, type PricePoint, marketSecurity } from "./models";
import { intradayChartPoints, rangeMovement } from "./time-range";
import { DAY_MS, MINUTE_MS, dayStart, startOfDay } from "./zone";

const HOUR_MS = 60 * MINUTE_MS;

const point = (date: number, value: number, extra: Partial<PricePoint> = {}): PricePoint => ({ date, value: new Decimal(value), ...extra });
const values = (points: readonly PricePoint[]) => points.map((item) => item.value.toNumber());

function makeSecurity(input: { price?: number; percentageChange?: number; history: PricePoint[] }): MarketSecurity {
  return marketSecurity({
    id: "UNTLAAAA",
    symbol: "UNTLAAAA",
    name: "Unitel",
    issuer: "Unitel",
    kind: "equity",
    price: new Decimal(input.price ?? 100),
    percentageChange: new Decimal(input.percentageChange ?? 0),
    volume: new Decimal(100),
    history: input.history,
  });
}

// IntradayMovementTests
describe("intraday movement", () => {
  it("starts at the prior close across a weekend and ignores the current day close", () => {
    const monday = dayStart("2026-10-19")!;
    const friday = monday - 3 * DAY_MS;
    const opensAt = monday + 9 * HOUR_MS;
    const trade = point(opensAt, 105, { volume: new Decimal(10), tradeCount: 1 });
    const security = makeSecurity({ history: [point(monday, 110), point(friday, 100), point(friday - DAY_MS, 90)] });

    const points = intradayChartPoints(security, [trade], opensAt);

    expect(values(points)).toEqual([100, 105]);
    expect(points[0].date).toBeLessThan(trade.date);
    expect(points.at(-1)).toEqual(trade);
    expect(points[0].tradeCount).toBeUndefined();
    expect(points[0].volume).toBeUndefined();
    expect(rangeMovement(security, "1D", points).percentage.toNumber()).toBe(5);
  });

  it("uses the verified prior close without inventing missing prices or trades", () => {
    const opensAt = startOfDay(1_800_000_000_000) + 9 * HOUR_MS;
    const trade = point(opensAt + 300_000, 105);
    let security = makeSecurity({ history: [] });
    expect(intradayChartPoints(security, [trade], opensAt)).toEqual([trade]);

    security = { ...security, closingPrice: { price: new Decimal(100), tradingDate: opensAt - DAY_MS, confirmedAt: opensAt } };
    expect(values(intradayChartPoints(security, [trade], opensAt))).toEqual([100, 105]);
    expect(intradayChartPoints(security, [], opensAt)).toEqual([]);

    security = { ...security, closingPrice: { price: new Decimal(110), tradingDate: opensAt, confirmedAt: opensAt } };
    expect(intradayChartPoints(security, [trade], opensAt)).toEqual([trade]);
  });

  it("one day movement uses the displayed intraday trades instead of a flat quote", () => {
    const date = 1_800_000_000_000;
    const security = makeSecurity({ price: 27_700, percentageChange: 0, history: [point(date, 27_700)] });
    const movement = rangeMovement(security, "1D", [point(date - 300_000, 26_900), point(date, 27_700)]);
    expect(movement.amount.toNumber()).toBeCloseTo(800, 4);
    expect(movement.percentage.toNumber()).toBeCloseTo(2.9739777, 4);
  });

  it("one day movement does not fabricate an unavailable intraday comparison", () => {
    const date = 1_800_000_000_000;
    const security = makeSecurity({ price: 102, percentageChange: 2, history: [point(date - 300_000, 50), point(date, 102)] });
    for (const points of [[], [point(date, 102)], [point(date - 300_000, 0), point(date, 102)]]) {
      const movement = rangeMovement(security, "1D", points);
      expect(movement.amount.toNumber()).toBe(0);
      expect(movement.percentage.toNumber()).toBe(0);
    }
  });

  it("longer range movement ignores intraday trades", () => {
    const date = 1_800_000_000_000;
    const security = makeSecurity({ history: [point(date - DAY_MS, 100), point(date, 110)] });
    const movement = rangeMovement(security, "1S", [point(date - 300_000, 110), point(date, 105)]);
    expect(movement.amount.toNumber()).toBeCloseTo(10, 4);
    expect(movement.percentage.toNumber()).toBeCloseTo(10, 4);
  });
});

// Contract §3.6; no iOS test covers the RPC decoding.
describe("intraday chart decoding", () => {
  const now = Date.parse("2026-11-11T10:00:00Z");
  const body = (points: unknown[]) => ({
    source: "observations",
    session_date: "2026-11-11",
    requested_session_date: "2026-11-11",
    last_checked_at: "2026-11-11T09:59:30.123+00:00",
    last_trade_at: null,
    status: "observed",
    points,
  });
  const observation = (bucket: string) => ({ security_id: "s", bucket_at: bucket, close_price: "27700.12345678" });

  it("keeps a single observation and drops the whole series on a future bucket", () => {
    const chart = decodeIntradayChart(body([observation("2026-11-11T09:30:00+00:00")]), now);
    expect(chart.points.map((item) => item.value.toString())).toEqual(["27700.12345678"]);
    expect(chart.lastCheckedAt).toBe(Date.parse("2026-11-11T09:59:30.123Z"));
    expect(intradayStatusLine(chart, false)).toBeUndefined();
    expect(intradayStatusLine(chart, true)?.key).toBe("assetDetails.chart.outdatedData");

    const future = decodeIntradayChart(body([observation("2026-11-11T09:30:00+00:00"), observation("2026-11-11T10:05:00+00:00")]), now);
    expect(future.points).toEqual([]);
    expect(() => decodeIntradayChart({ ...body([]), source: undefined }, now)).toThrow(MarketDecodingError);
  });
});
