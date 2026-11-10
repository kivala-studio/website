import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { type CalendarException, MarketCalendar } from "./calendar";
import { type MarketSecurity, type MarketSnapshot, marketSecurity, marketSnapshot } from "./models";
import { type DataQualityReport, qualityFailure } from "./quality";
import { currentQuotePrices, displayPrice, displayPriceLabel, hasUsableQuote } from "./quote-policy";
import { applyCurrentQuotePolicy, currentQuoteDeadline, quoteRevocation, revokeCurrentQuotes } from "./snapshot";
import { DAY_MS, parseInstant, startOfDay } from "./zone";

const instant = (value: string) => parseInstant(value) ?? Number.NaN;
const text = (value: Decimal | undefined) => value?.toString();
const now = instant("2026-10-05T10:00:00Z");

function calendar(options: { verifiedAt?: number; validUntil?: number; exceptions?: [number, CalendarException][] } = {}) {
  const day = startOfDay(now);
  return new MarketCalendar({
    version: "fixture",
    coverage: { start: day - DAY_MS, endExclusive: day + DAY_MS },
    verifiedAt: options.verifiedAt ?? now - 1000,
    validUntil: options.validUntil ?? now + 120_000,
    normalHours: { openingMinute: 9 * 60 + 25, closingMinute: 15 * 60 },
    exceptions: new Map(options.exceptions ?? []),
    regularWeekdays: new Set([2, 3, 4, 5, 6]),
  });
}

function bai(): MarketSecurity {
  return marketSecurity({
    id: "BAI",
    symbol: "BAI",
    name: "BAI",
    issuer: "BAI",
    kind: "equity",
    price: new Decimal(110),
    percentageChange: new Decimal(10),
    isWatched: true,
    history: [{ date: now - DAY_MS, value: new Decimal(100) }],
    quoteQuality: { status: "valid", reasons: [], validUntilEpoch: now / 1000 + 120, sourceObservedAtEpoch: now / 1000 },
    closingPrice: { price: new Decimal(100), tradingDate: now - DAY_MS, confirmedAt: now - 3_600_000 },
    quoteTradingDate: now,
  });
}

const snapshot = (securities: MarketSecurity[] = [bai()]): MarketSnapshot =>
  marketSnapshot({ status: "open", securities, updatedAt: now });

describe("current-quote policy", () => {
  it("dated quotes stay visible but expired or previous-session quotes cannot value a portfolio", () => {
    const security = applyCurrentQuotePolicy(snapshot(), calendar(), now).securities[0];
    expect(text(displayPrice(security, now))).toBe("110");
    expect(hasUsableQuote(security, now)).toBe(true);
    const later = now + 121_000;
    expect(text(displayPrice(security, later))).toBe("110");
    expect(hasUsableQuote(security, later)).toBe(false);
    expect(displayPriceLabel(security, later)).toBe("market.price.lastBodivaQuote");
    const previous = { ...security, quoteTradingDate: now - DAY_MS };
    expect(text(displayPrice(previous, now))).toBe("110");
    expect(hasUsableQuote(previous, now)).toBe(false);
    expect(currentQuotePrices([previous], now).size).toBe(0);
  });

  it("an unknown or expired calendar and a failed refresh cannot release the closing fallback", () => {
    for (const value of [undefined, calendar({ validUntil: now })]) {
      const assessed = applyCurrentQuotePolicy(snapshot(), value, now);
      expect(assessed.status).toBe("unknown");
      expect(text(displayPrice(assessed.securities[0], now))).toBe("110");
      expect(hasUsableQuote(assessed.securities[0], now)).toBe(false);
      expect(assessed.securities[0].history).toEqual(snapshot().securities[0].history);
    }
    const failed = applyCurrentQuotePolicy(snapshot(), calendar(), now, false).securities[0];
    expect(text(displayPrice(failed, now))).toBe("110");
    expect(hasUsableQuote(failed, now)).toBe(false);
    expect(text(failed.closingPrice?.price)).toBe("100");
  });

  it("closed, holiday and opening transitions use only the explicit dated close", () => {
    const holiday = calendar({ exceptions: [[startOfDay(now), { kind: "holiday" }]] });
    const closed = applyCurrentQuotePolicy(snapshot(), holiday, now, false);
    expect(closed.status).toBe("closed");
    expect(text(displayPrice(closed.securities[0], now))).toBe("100");
    expect(hasUsableQuote(closed.securities[0], now)).toBe(false);

    const beforeOpen = instant("2026-10-05T08:24:59Z");
    const opening = calendar({ verifiedAt: beforeOpen - 1000, validUntil: beforeOpen + 120_000 });
    const waiting = applyCurrentQuotePolicy(snapshot(), opening, beforeOpen, false).securities[0];
    expect(text(displayPrice(waiting, beforeOpen))).toBe("100");
    expect(displayPrice(waiting, beforeOpen + 1000)).toBeUndefined();

    const atClose = instant("2026-10-05T14:00:00Z");
    const ending = calendar({ verifiedAt: atClose - 2000, validUntil: atClose + 120_000 });
    const closing: MarketSecurity = {
      ...bai(),
      quoteQuality: { status: "valid", reasons: [], validUntilEpoch: atClose / 1000 + 119, sourceObservedAtEpoch: atClose / 1000 - 1 },
    };
    const open = applyCurrentQuotePolicy(snapshot([closing]), ending, atClose - 1000).securities[0];
    expect(hasUsableQuote(open, atClose - 1000)).toBe(true);
    expect(hasUsableQuote(open, atClose)).toBe(false);
  });

  // iOS drops the store state on suspend; the website keeps dated evidence and revokes what is current.
  it("a hidden tab or lost connection revokes every current quote", () => {
    const assessed = applyCurrentQuotePolicy(snapshot(), calendar(), now);
    expect(quoteRevocation({ hidden: true, online: true, lastRefreshFailed: false })).toBe("hidden");
    expect(quoteRevocation({ hidden: false, online: false, lastRefreshFailed: false })).toBe("offline");
    expect(quoteRevocation({ hidden: false, online: true, lastRefreshFailed: true })).toBe("refreshFailed");
    expect(quoteRevocation({ hidden: false, online: true, lastRefreshFailed: false })).toBeUndefined();
    const revoked = revokeCurrentQuotes(assessed, calendar(), now);
    expect(revoked.securities.some((security) => hasUsableQuote(security, now))).toBe(false);
    expect(displayPriceLabel(revoked.securities[0], now)).toBe("market.price.lastBodivaQuote");
    expect(revoked.statisticsQuality).toEqual(qualityFailure("stale", "staleFetch"));
  });

  // iOS races a late calendar and history load in the store; here the same reassessment then merge.
  it("a fresh calendar and on-demand history do not restore an expired quote", () => {
    const loaded = applyCurrentQuotePolicy(snapshot(), calendar(), now);
    const clock = now + 121_000;
    const reassessed = applyCurrentQuotePolicy(loaded, calendar(), clock);
    const security = reassessed.securities[0];
    const merged = { ...security, history: [...security.history, { date: -62_135_596_800_000, value: new Decimal(90) }] };
    expect(merged.history).toHaveLength(2);
    expect(text(displayPrice(merged, clock))).toBe("110");
    expect(hasUsableQuote(merged, clock)).toBe(false);
  });

  it("the snapshot deadline bounds independent presentation", () => {
    const assessed = applyCurrentQuotePolicy(snapshot(), calendar(), now);
    expect(currentQuoteDeadline(assessed)).toBe(now + 120_000);
    const later = now + 121_000;
    const expired = applyCurrentQuotePolicy(assessed, calendar(), later);
    expect(expired.securities.some((security) => hasUsableQuote(security, later))).toBe(false);
  });

  it("a delayed server quote has a dated display reference without current eligibility", () => {
    const security: MarketSecurity = {
      ...bai(),
      quoteQuality: { status: "delayed", reasons: ["delayedIngestion"], observedAt: now },
      marketStatus: "open",
    };
    expect(text(displayPrice(security, now))).toBe("110");
    expect(hasUsableQuote(security, now)).toBe(false);
    expect(displayPriceLabel(security, now)).toBe("market.price.lastBodivaQuote");
  });

  it("invalid or unverified quotes cannot become display references after expiry", () => {
    const reports: DataQualityReport[] = [
      qualityFailure("invalid", "invalidValue"),
      qualityFailure("unknown", "missingProvenance"),
      qualityFailure("incomplete", "delayedIngestion"),
      qualityFailure("stale", "invalidTimestamp"),
    ];
    for (const report of reports) {
      const security: MarketSecurity = { ...bai(), marketStatus: "open", quoteQuality: report };
      const rejected = applyCurrentQuotePolicy(snapshot([security]), calendar(), now, false).securities[0];
      expect(displayPrice(rejected, now)).toBeUndefined();
      expect(displayPriceLabel(rejected, now)).toBeUndefined();
      expect(rejected.quoteQuality?.status).toBe(report.status);
    }
    const base = bai();
    const future: MarketSecurity = {
      ...base,
      marketStatus: "open",
      quoteQuality: { ...base.quoteQuality!, sourceObservedAtEpoch: now / 1000 + 1 },
    };
    expect(displayPrice(future, now)).toBeUndefined();
    const missingDate: MarketSecurity = { ...future, quoteTradingDate: undefined, quoteQuality: qualityFailure("delayed", "delayedIngestion") };
    expect(displayPrice(missingDate, now)).toBeUndefined();
  });
});
