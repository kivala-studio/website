import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { MarketCalendar } from "./calendar";
import { decodeDataQuality, encodeDataQuality } from "./decode";
import { type HistoryInput, type PriceObservation, validateHistoricalSeries } from "./history-validation";
import { makeMarketIndex } from "./mapping";
import type { PricePoint } from "./models";
import {
  type DataQualityReport,
  type QualityReason,
  type QualityStatus,
  VALID_QUALITY,
  permitsCurrentUse,
  permitsInsight,
  permitsUse,
  qualityFailure,
  reportedClose,
  validateChart,
  validateReportedPrice,
} from "./quality";
import { availableRanges } from "./time-range";
import { DAY_MS, addDays, parseInstant, startOfDay } from "./zone";

const instant = (value: string) => parseInstant(value) ?? Number.NaN;
const now = instant("2026-09-28T09:00:00Z");
const period = { start: instant("2026-09-20T23:00:00Z"), endExclusive: instant("2026-09-27T23:00:00Z") };
const HOURS = { openingMinute: 540, closingMinute: 930 };
const WEEKDAYS = new Set([2, 3, 4, 5, 6]);

const calendar = new MarketCalendar({
  version: "reviewed-fixture",
  coverage: { start: instant("2026-08-31T23:00:00Z"), endExclusive: instant("2026-10-01T23:00:00Z") },
  verifiedAt: now - 3_600_000,
  validUntil: now + 3_600_000,
  normalHours: HOURS,
  exceptions: new Map(),
  regularWeekdays: WEEKDAYS,
});

/** Reviewed fixture hours (09:00–15:30), Monday to Friday. */
const fixtureCalendar = (at: number) =>
  new MarketCalendar({
    version: "reviewed-fixture",
    coverage: { start: addDays(startOfDay(at), -60), endExclusive: addDays(startOfDay(at), 60) },
    verifiedAt: at - DAY_MS,
    validUntil: at + 7 * DAY_MS,
    normalHours: HOURS,
    exceptions: new Map(),
    regularWeekdays: WEEKDAYS,
  });

const SOURCE = { dataset: "price_history.quote_evolution", contentHash: "a".repeat(64), parserVersion: "fixture" };

function row(
  day: number,
  options: {
    price?: Decimal.Value;
    id?: string;
    asset?: string;
    currency?: string;
    collected?: number;
    final?: boolean;
    quality?: DataQualityReport | null;
    source?: PriceObservation["source"];
  } = {},
): PriceObservation {
  const observed = instant(`2026-09-${String(day).padStart(2, "0")}T14:30:00Z`);
  const asset = options.asset ?? "A";
  return {
    recordID: options.id ?? `${asset}-${day}`,
    assetID: asset,
    currencyCode: options.currency ?? "AOA",
    price: new Decimal(options.price ?? 100),
    observedAt: observed,
    collectedAt: options.collected ?? observed + 60_000,
    source: options.source ?? { ...SOURCE, ingestionRunID: `run-${day}` },
    isFinal: options.final ?? true,
    dataQuality: options.quality === null ? undefined : (options.quality ?? VALID_QUALITY),
  };
}

const rows = () => [21, 22, 23, 24, 25].map((day) => row(day, { price: 100 + day }));

const input = (overrides: Partial<HistoryInput> = {}): HistoryInput => ({
  period,
  generatedAt: now,
  fetchedAt: now - 60_000,
  calendar,
  observations: rows(),
  ...overrides,
});

const assess = (overrides: Partial<HistoryInput> = {}) => validateHistoricalSeries(input(overrides));

function expectSuppressed(observations: PriceObservation[], status: QualityStatus, reason: QualityReason) {
  const result = assess({ observations });
  expect(result.verified.size).toBe(0);
  expect(result.assets.get("A")?.status).toBe(status);
  expect(result.assets.get("A")?.reasons).toContain(reason);
}

const replaced = (index: number, replacement: PriceObservation) => rows().map((item, position) => (position === index ? replacement : item));

describe("data quality", () => {
  // InsightEngine cases assert the verified series the insight would be built on.
  it("a complete finalised series produces verified evidence", () => {
    const result = assess();
    expect(result.verified.size).toBe(1);
    expect(permitsInsight(result.assets.get("A")!)).toBe(true);
    expect(result.verified.get("A")).toEqual(rows());
  });

  it("missing start, middle and end sessions suppress", () => {
    for (const index of [0, 2, 4]) expectSuppressed(rows().filter((_, position) => position !== index), "incomplete", "missingSession");
  });

  it("empty requested history has an explicit reason", () => {
    const result = assess({ observations: [], watchlistIDs: ["A"] });
    expect(result.verified.size).toBe(0);
    expect(result.assets.get("A")).toEqual(qualityFailure("incomplete", "missingObservation"));
  });

  it("exact and conflicting duplicate sessions suppress", () => {
    for (const price of [123, 999]) expectSuppressed([...rows(), row(23, { price, id: "copy" })], "invalid", "duplicateObservation");
  });

  it("a duplicate record across assets cannot authorise either", () => {
    const result = assess({ observations: [...rows(), row(23, { id: "A-23", asset: "B" })] });
    expect(result.verified.size).toBe(0);
    expect(result.assets.get("B")?.status).toBe("invalid");
  });

  it("out-of-order transport is normalised without dropping rows", () => {
    const result = assess({ observations: rows().reverse() });
    expect(result.verified.size).toBe(1);
    expect(result.verified.get("A")).toEqual(rows());
  });

  it("zero, negative and malformed prices suppress", () => {
    for (const price of [0, -1, Number.NaN]) expectSuppressed(replaced(2, row(23, { price })), "invalid", "invalidValue");
  });

  it("arithmetic overflow cannot produce verified evidence", () => {
    const data = rows();
    data[0] = row(21, { price: "1e-120" });
    data[4] = row(25, { price: "1e120" });
    expectSuppressed(data, "invalid", "invalidValue");
  });

  it("mixed currencies suppress", () => {
    expectSuppressed(replaced(2, row(23, { currency: "USD" })), "invalid", "inconsistentCurrency");
  });

  it("missing and malformed provenance suppress", () => {
    for (const source of [
      { dataset: "", ingestionRunID: "run" },
      { dataset: "history", ingestionRunID: "" },
      { dataset: "history", ingestionRunID: "run", contentHash: "bad" },
    ]) {
      expectSuppressed(replaced(2, row(23, { source })), "unknown", "missingProvenance");
    }
  });

  it("collection before the close or after the fetch suppresses", () => {
    for (const collected of [instant("2026-09-23T14:29:00Z"), now]) {
      expectSuppressed(replaced(2, row(23, { collected })), "invalid", "invalidTimestamp");
    }
  });

  it("unfinalised and delayed ingestion cannot produce evidence", () => {
    expectSuppressed(replaced(2, row(23, { final: false })), "delayed", "notFinal");
    expectSuppressed(replaced(2, row(23, { quality: qualityFailure("incomplete", "delayedIngestion") })), "incomplete", "delayedIngestion");
  });

  it("stale fetch and stale period are distinct", () => {
    expect(assess({ fetchedAt: now - 900_000 }).period).toEqual(qualityFailure("stale", "staleFetch"));
    const later = now + 7 * DAY_MS;
    expect(assess({ fetchedAt: later, generatedAt: later }).period).toEqual(qualityFailure("stale", "stalePeriod"));
  });

  it("a future fetch is not a valid freshness signal", () => {
    const result = assess({ fetchedAt: now + 1000 });
    expect(result.verified.size).toBe(0);
    expect(result.period.status).toBe("invalid");
  });

  it("an unknown or expired calendar suppresses", () => {
    const unknown = calendar.with({ version: "unknown", coverage: period, validUntil: now - 1000 });
    const result = assess({ calendar: unknown });
    expect(result.verified.size).toBe(0);
    expect(result.period).toEqual(qualityFailure("unknown", "unavailableCalendar"));
  });

  it("a partial trading period suppresses before its last close", () => {
    const beforeClose = instant("2026-09-25T14:29:00Z");
    const result = assess({ fetchedAt: beforeClose, generatedAt: beforeClose, calendar: fixtureCalendar(beforeClose) });
    expect(result.verified.size).toBe(0);
    expect(result.period.status).toBe("incomplete");
  });

  it("a missing watchlist member never becomes unchanged", () => {
    const result = assess({ watchlistIDs: ["A", "B"] });
    expect(result.verified.has("B")).toBe(false);
    expect(result.assets.get("B")?.status).toBe("incomplete");
  });

  it("a reported quote requires its own provenance", () => {
    const tradingDate = period.start;
    expect(validateReportedPrice({ price: new Decimal(100), tradingDate, now }).status).toBe("unknown");
    for (const price of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(validateReportedPrice({ price: new Decimal(price), tradingDate, now, sourceQuality: VALID_QUALITY }).status).toBe("invalid");
    }
    expect(permitsInsight(validateReportedPrice({ price: new Decimal(100), tradingDate, now, sourceQuality: VALID_QUALITY }))).toBe(true);
  });

  it("stale and delayed quotes cannot authorise valuation", () => {
    for (const status of ["stale", "delayed", "unknown", "incomplete"] as const) {
      const report = validateReportedPrice({
        price: new Decimal(100),
        tradingDate: period.start,
        now,
        sourceQuality: { status, reasons: ["staleObservation"] },
      });
      expect(permitsInsight(report)).toBe(false);
    }
  });

  it("charts reject malformed or duplicate candles but allow zero volume", () => {
    const point: PricePoint = { date: period.start, value: new Decimal(100), highValue: new Decimal(110), lowValue: new Decimal(90), volume: new Decimal(0) };
    expect(validateChart([point]).points).toEqual([point]);
    expect(validateChart([point, point]).points).toEqual([]);
    expect(validateChart([{ date: period.start, value: new Decimal(100), highValue: new Decimal(99) }]).points).toEqual([]);
    expect(validateChart([{ date: period.start, value: new Decimal(Number.NaN) }]).points).toEqual([]);
  });

  it("a reported close survives incoherent candle metadata", () => {
    const point: PricePoint = {
      date: period.start,
      value: new Decimal(96_000),
      openValue: new Decimal(98_000),
      highValue: new Decimal(98_700),
      lowValue: new Decimal(98_000),
      volume: new Decimal(49),
    };
    const close = reportedClose(point);
    expect(close?.value.toNumber()).toBe(96_000);
    expect(close?.lowValue).toBeUndefined();
    expect(close?.highValue).toBeUndefined();
    const older: PricePoint = { date: period.start - 400 * DAY_MS, value: new Decimal(80_000) };
    const history = validateChart([older, close!]).points;
    expect(history).toHaveLength(2);
    expect(availableRanges(history)).toContain("Tudo");
    expect(reportedClose({ date: period.start, value: new Decimal(Number.NaN) })).toBeUndefined();
    expect(reportedClose({ date: period.start, value: new Decimal(0) })).toBeUndefined();
  });

  it("the market index cannot turn unknown rows into a flat return", () => {
    const raw = { tradingDate: "2026-09-21", value: new Decimal(100), dailyChangePercent: new Decimal(0) };
    expect(makeMarketIndex([raw]).value).toBeUndefined();
    const valid = { ...raw, dataQuality: VALID_QUALITY };
    expect(makeMarketIndex([valid]).dailyChange).toBeUndefined();
    expect(makeMarketIndex([valid, valid]).value).toBeUndefined();
  });

  it("the quality report round-trips as machine-readable data", () => {
    const report = qualityFailure("incomplete", "missingSession", "delayedIngestion");
    expect(decodeDataQuality(JSON.parse(JSON.stringify(encodeDataQuality(report))))).toEqual(report);
  });

  // The iOS case asserts the monthly and yearly wraps; here the verified series they are built on.
  it("complete monthly and yearly evidence uses the same quality boundary", () => {
    for (const [start, end] of [
      ["2026-08-31T23:00:00Z", "2026-09-30T23:00:00Z"],
      ["2025-12-31T23:00:00Z", "2026-12-24T23:00:00Z"],
    ]) {
      const endExclusive = instant(end);
      const generated = endExclusive + 3_600_000;
      const yearCalendar = new MarketCalendar({
        version: "year-coverage",
        coverage: { start: instant("2025-12-01T23:00:00Z"), endExclusive: instant("2027-01-01T23:00:00Z") },
        verifiedAt: generated - 60_000,
        validUntil: generated + 120_000,
        normalHours: HOURS,
        exceptions: new Map(),
        regularWeekdays: WEEKDAYS,
      });
      const baseline = yearCalendar.previousTradingDay(instant(start), generated);
      expect(baseline).toBeDefined();
      const comparison = { start: baseline!, endExclusive };
      const sessions = yearCalendar.sessions(comparison, generated) ?? [];
      const observations = sessions.map((session, index): PriceObservation => ({
        recordID: `period-${index}`,
        assetID: "A",
        currencyCode: "AOA",
        price: new Decimal(100 + index),
        observedAt: session.closesAt,
        collectedAt: session.closesAt + 1000,
        source: { ...SOURCE, ingestionRunID: `source-${index}` },
        isFinal: true,
        dataQuality: VALID_QUALITY,
      }));
      const evaluate = (items: PriceObservation[]) =>
        validateHistoricalSeries({ period: comparison, generatedAt: generated, fetchedAt: generated, calendar: yearCalendar, observations: items });
      expect(evaluate(observations).verified.get("A")).toHaveLength(sessions.length);
      expect(evaluate(observations.slice(1)).verified.size).toBe(0);
    }
  });

  it("an expired quote assessment cannot become a valid cached quote", () => {
    const quality: DataQualityReport = { ...VALID_QUALITY, validUntilEpoch: now / 1000 };
    expect(permitsUse(quality, now)).toBe(false);
    expect(validateReportedPrice({ price: new Decimal(100), tradingDate: period.start, now, sourceQuality: quality }).status).toBe("stale");
  });

  it("a valid-looking raw observation still requires an assessment", () => {
    expectSuppressed(replaced(2, row(23, { quality: null })), "unknown", "missingProvenance");
  });
});

describe("market quote date", () => {
  it("a morning quote uses the trading day rather than the noon anchor", () => {
    const morning = instant("2026-10-02T09:00:00Z");
    const noon = instant("2026-10-02T11:00:00Z");
    const sourceQuality: DataQualityReport = {
      status: "valid",
      reasons: [],
      validUntilEpoch: morning / 1000 + 120,
      sourceObservedAtEpoch: morning / 1000,
    };
    const report = validateReportedPrice({ price: new Decimal(95_000), tradingDate: noon, now: morning, sourceQuality });
    expect(permitsCurrentUse(report, morning)).toBe(true);
    expect(report.observedAt).toBe(startOfDay(morning));
    expect(report.sourceObservedAtEpoch).toBe(morning / 1000);
    expect(permitsCurrentUse(report, morning + 121_000)).toBe(false);
    expect(validateReportedPrice({ price: new Decimal(95_000), tradingDate: noon + DAY_MS, now: morning, sourceQuality }).status).toBe("unknown");
  });
});
