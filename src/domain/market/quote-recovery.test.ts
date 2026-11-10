// Port of the domain cases of Tests/MarketDiscoveryTests/QuoteRecoveryTests.swift (7 of 15); the
// store cases are in src/data/market/store.test.ts.
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { MarketCalendar } from "./calendar";
import { currentRowPrice, decodeCurrentMarketQuotes, decodeDataQuality, readSourceAvailability } from "./decode";
import { type MarketSecurity, type MarketSnapshot, marketSecurity, marketSnapshot } from "./models";
import { type DataQualityReport, permitsInsight, permitsUse, qualityFailure } from "./quality";
import { availableOrderBook, hasUsableQuote } from "./quote-policy";
import { applyCurrentQuotePolicy, currentQuoteDeadline, currentQuoteDeadlines, dataAvailability, hasUsableStatistics } from "./snapshot";
import { DAY_MS, SECOND_MS, parseInstant, startOfDay } from "./zone";

const now = parseInstant("2026-10-06T10:00:00Z")!;
const epoch = now / SECOND_MS;
const calendar = new MarketCalendar({
  version: "fixture",
  coverage: { start: startOfDay(now), endExclusive: startOfDay(now) + DAY_MS },
  verifiedAt: now - SECOND_MS,
  validUntil: now + 600 * SECOND_MS,
  normalHours: { openingMinute: 9 * 60, closingMinute: 15 * 60 },
  regularWeekdays: new Set([2, 3, 4, 5, 6]),
});

function quality(observedAt = now, deadline = 120): DataQualityReport {
  return {
    status: "valid",
    reasons: [],
    observedAt: startOfDay(observedAt),
    validUntilEpoch: (observedAt + deadline * SECOND_MS) / SECOND_MS,
    sourceObservedAtEpoch: observedAt / SECOND_MS,
  };
}

function snapshot(securities?: MarketSecurity[]): MarketSnapshot {
  return marketSnapshot({
    status: "open",
    securities: securities ?? [
      marketSecurity({
        id: "SEC",
        symbol: "SEC",
        kind: "equity",
        price: new Decimal(100),
        isWatched: true,
        history: [{ date: now - DAY_MS, value: new Decimal(99) }],
        quoteQuality: quality(),
        quoteTradingDate: now,
        isListed: true,
      }),
    ],
    sessionVolume: new Decimal(1000),
    trades: 2,
    updatedAt: now,
    statisticsQuality: quality(),
    sourceMetadata: { tradingDate: now, collectedAt: now, publishedAt: now, dataStatus: "live", sourceObservedAt: now },
  });
}

describe("quote recovery (domain)", () => {
  it("partial health does not revoke a valid instrument and cannot grant expired quotes", () => {
    const missing = marketSecurity({
      id: "MISSING",
      symbol: "MISSING",
      kind: "equity",
      quoteAvailability: "unavailable",
      quoteQuality: qualityFailure("incomplete", "missingObservation"),
    });
    const base = snapshot();
    const withMissing = (status: "sourceUnavailable" | "available") =>
      ({
        ...base,
        securities: [...base.securities, missing],
        sourceMetadata: { ...base.sourceMetadata, availability: { status } },
      }) satisfies MarketSnapshot;
    const assessed = applyCurrentQuotePolicy(withMissing("sourceUnavailable"), calendar, now);
    expect(dataAvailability(assessed, now).state).toBe("partial");
    expect(hasUsableQuote(assessed.securities[0], now)).toBe(true);
    expect(hasUsableQuote(assessed.securities[1], now)).toBe(false);
    const later = now + 121 * SECOND_MS;
    const expired = applyCurrentQuotePolicy(withMissing("available"), calendar, later);
    expect(dataAvailability(expired, later).state).toBe("delayed");
    expect(expired.securities.some((security) => hasUsableQuote(security, later))).toBe(false);
  });

  it("future health enums fail closed and absent optional metadata decodes", () => {
    expect(permitsInsight(decodeDataQuality({ status: "futureStatus", reasons: [], validUntilEpoch: 9_999_999_999 }))).toBe(false);
    expect(permitsInsight(decodeDataQuality({ status: "valid", reasons: ["futureReason"] }))).toBe(false);
    const health = readSourceAvailability({ status: "futureStatus" }, "$");
    expect(health.status).toBe("unknown");
    expect(health.lastSuccessfulObservationAtEpoch).toBeUndefined();
    const future: DataQualityReport = { status: "valid", reasons: [], validUntilEpoch: epoch + 120, sourceObservedAtEpoch: epoch + 1 };
    expect(permitsUse(future, now)).toBe(false);
  });

  it("optional availability cannot break the quote contract and malformed prices stay rejected", () => {
    expect(decodeCurrentMarketQuotes({ prices: [], sessions: [], overview: [] }).availability).toBeUndefined();
    expect(decodeCurrentMarketQuotes({ prices: [], sessions: [], overview: [], availability: { status: 3 } }).availability).toBeUndefined();
    const nulls = decodeCurrentMarketQuotes({
      prices: [{ security_id: "SEC", trading_date: null, last_price: null, data_quality: null }],
      sessions: [],
      overview: [],
      availability: null,
    });
    expect(currentRowPrice(nulls.prices[0])).toBeUndefined();
    expect(nulls.prices[0].dataQuality).toBeUndefined();
    expect(() =>
      decodeCurrentMarketQuotes({ prices: [{ security_id: "SEC", last_price: "not-a-number" }], sessions: [], overview: [] }),
    ).toThrow("expected decimal");
  });

  it("a live quote requires an explicit deadline and cannot extend its observed lifetime", () => {
    const assessed = applyCurrentQuotePolicy(snapshot(), calendar, now).securities[0];
    expect(hasUsableQuote(assessed, now)).toBe(true);
    const withQuality = (changes: Partial<DataQualityReport>) => ({ ...assessed, quoteQuality: { ...assessed.quoteQuality!, ...changes } });
    expect(hasUsableQuote(withQuality({ validUntilEpoch: undefined }), now)).toBe(false);
    expect(hasUsableQuote(withQuality({ validUntilEpoch: epoch + 121 }), now)).toBe(false);
    expect(hasUsableQuote(withQuality({ validUntilEpoch: epoch + 120, sourceObservedAtEpoch: epoch + 1 }), now)).toBe(false);
    // Open-session quotes require a verified observation receipt.
    expect(hasUsableQuote(withQuality({ validUntilEpoch: epoch + 120, sourceObservedAtEpoch: undefined }), now)).toBe(false);
  });

  it("current statistics need a deadline and same-session provenance", () => {
    const assessed = applyCurrentQuotePolicy(snapshot(), calendar, now);
    expect(hasUsableStatistics(assessed, now)).toBe(true);
    const statistics = assessed.statisticsQuality!;
    expect(hasUsableStatistics({ ...assessed, statisticsQuality: { ...statistics, sourceObservedAtEpoch: undefined } }, now)).toBe(false);
    expect(hasUsableStatistics({ ...assessed, statisticsQuality: { ...statistics, validUntilEpoch: undefined } }, now)).toBe(false);
    const previousSession = {
      ...assessed,
      statisticsQuality: { ...statistics, sourceObservedAtEpoch: epoch, validUntilEpoch: epoch + 120 },
      sourceMetadata: { tradingDate: now - DAY_MS, collectedAt: now, publishedAt: now, dataStatus: "live" },
    };
    expect(hasUsableStatistics(previousSession, now)).toBe(false);
  });

  it("a current order book requires the same observation evidence as quotes", () => {
    const evidence = quality();
    const security = marketSecurity({
      id: "BOOK",
      symbol: "BOOK",
      kind: "equity",
      price: new Decimal(100),
      orderBook: [{ side: "bid", level: 1, price: new Decimal(99), quantity: new Decimal(10), orderCount: 1 }],
      quoteQuality: evidence,
      marketStatus: "open",
      quoteTradingDate: now,
      marketContextValidUntil: now + 120 * SECOND_MS,
      orderBookQuality: evidence,
    });
    const withBook = (changes: Partial<DataQualityReport>) => ({ ...security, orderBookQuality: { ...evidence, ...changes } });
    expect(availableOrderBook(security, now)?.length).toBe(1);
    expect(availableOrderBook(withBook({ sourceObservedAtEpoch: undefined }), now)).toBeUndefined();
    expect(availableOrderBook(withBook({ validUntilEpoch: undefined }), now)).toBeUndefined();
    expect(availableOrderBook(withBook({ validUntilEpoch: epoch + 121 }), now)).toBeUndefined();
    expect(availableOrderBook(security, now + 120 * SECOND_MS)).toBeUndefined();
    // Book availability never revokes a separate valid quote.
    expect(hasUsableQuote(security, now)).toBe(true);
  });

  it("explicit timeline deadlines are finite, unique and chronological across instruments", () => {
    const deadlines: [string, number, number][] = [
      ["A", epoch + 100, epoch + 120],
      ["B", epoch + 10, epoch + 120],
      ["C", epoch + 10, epoch + 60],
      ["D", Number.NaN, Number.POSITIVE_INFINITY],
    ];
    const securities = deadlines.map(([id, quote, context]) =>
      marketSecurity({
        id,
        symbol: id,
        kind: "equity",
        price: new Decimal(100),
        quoteQuality: { status: "valid", reasons: [], validUntilEpoch: quote },
        marketContextValidUntil: context * SECOND_MS,
      }),
    );
    const expected = [10, 60, 100, 120].map((seconds) => now + seconds * SECOND_MS);
    expect(currentQuoteDeadlines(snapshot(securities))).toEqual(expected);
    expect(currentQuoteDeadline(snapshot(securities))).toBe(expected[0]);
  });
});
