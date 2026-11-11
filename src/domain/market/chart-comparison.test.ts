import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { commonObservationInterval, effectiveStartDate, fiveMinuteObservations, performancePercent } from "./chart-comparison";
import type { PricePoint } from "./models";
import { startOfDay } from "./zone";

const date = (seconds: number) => seconds * 1000;
const point = (seconds: number, value: Decimal.Value = 100): PricePoint => ({ date: date(seconds), value: new Decimal(value) });
const values = (points: readonly PricePoint[]) => points.map((item) => item.value.toNumber());

// ChartComparisonMathTests
describe("chart comparison maths", () => {
  it("five-minute comparison preserves the prior close and the opening observation", () => {
    const anchor = point(600, 100);
    const result = fiveMinuteObservations([anchor, point(601, 105), point(620, 110)], true);
    expect(result[0]).toBe(anchor);
    expect(values(result)).toEqual([100, 110]);
  });

  it("observation comparison keeps the last value without filling missing buckets", () => {
    const result = fiveMinuteObservations([point(601, 30), point(4, 10), point(20, 12)]);
    expect(result.map((item) => item.date / 1000)).toEqual([0, 600]);
    expect(values(result)).toEqual([12, 30]);
    expect(result.every((item) => item.tradeCount === undefined && item.volume === undefined)).toBe(true);
  });

  it("the common interval uses shared observations at both ends", () => {
    const first = [10, 20, 30, 40].map((seconds) => point(seconds));
    const second = [20, 30, 50].map((seconds) => point(seconds));
    expect(commonObservationInterval([first, second], { start: date(0), end: date(60) })).toEqual({ start: date(20), end: date(30) });
  });

  it("the common interval rejects missing history and a single overlap", () => {
    const range = { start: date(0), end: date(60) };
    expect(commonObservationInterval([[point(10), point(20)], []], range)).toBeUndefined();
    expect(commonObservationInterval([[point(10), point(20)], [point(20), point(30)]], range)).toBeUndefined();
  });

  it("the common interval excludes invalid quotes and points outside the range", () => {
    const history = [point(10), point(20), point(30, 0), point(40, Number.NaN), point(50)];
    expect(commonObservationInterval([history], { start: date(20), end: date(40) })).toBeUndefined();
  });

  it("daily comparison matches sessions while intraday requires exact times", () => {
    const first = [point(10), point(86_410)];
    const second = [point(20), point(86_420)];
    const range = { start: date(0), end: date(90_000) };
    expect(commonObservationInterval([first, second], range)).toBeUndefined();
    expect(commonObservationInterval([first, second], range, true)).toEqual({
      start: startOfDay(date(10)),
      end: startOfDay(date(86_410)),
    });
  });

  it("the effective start uses the newest listing inside the requested range", () => {
    expect(effectiveStartDate(date(100), [date(50), date(200)])).toBe(date(200));
  });

  it("the effective start keeps the requested start when every instrument is older", () => {
    expect(effectiveStartDate(date(200), [date(50), date(100)])).toBe(date(200));
  });

  it("the effective start requires history for every visible instrument", () => {
    expect(effectiveStartDate(date(100), [date(50), undefined])).toBeUndefined();
  });

  it("performance is rebased to the instrument's own starting price", () => {
    expect(performancePercent(new Decimal(115), new Decimal(100))?.toNumber()).toBeCloseTo(15, 6);
    expect(performancePercent(new Decimal(29_800), new Decimal(29_800))?.toNumber()).toBeCloseTo(0, 6);
  });

  it("performance rejects invalid financial values", () => {
    expect(performancePercent(new Decimal(100), new Decimal(0))).toBeUndefined();
    expect(performancePercent(new Decimal(-Infinity), new Decimal(100))).toBeUndefined();
    expect(performancePercent(new Decimal(-1), new Decimal(100))).toBeUndefined();
  });
});
