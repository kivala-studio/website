import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import pt from "../../../messages/pt.json";
import { createFormat } from "../format";
import { isVisibleOutsideSearch } from "./classification";
import { decodeCurrentMarketQuotes, decodeHomeSummary, decodeReferencePriceRow } from "./decode";
import { referencePrice } from "./mapping";
import {
  type MarketReferencePrice,
  type MarketSecurity,
  type MarketSourceAvailability,
  MARKET_MESSAGE_KEYS,
  availabilityCoverage,
  marketSecurity,
  marketSnapshot,
  summaryCoverage,
  validatedCoverage,
} from "./models";
import { referenceUnavailableKey, referenceUpdateIssue } from "./presentation";
import { invalidated } from "./quality";
import {
  currentQuotePrices,
  displayPercentageChange,
  displayPrice,
  displayPriceDateLabel,
  displayPriceLabel,
  hasUsableQuote,
  keepingClosingReferenceOnly,
  movementIsAvailable,
  priceDateLabel,
} from "./quote-policy";
import { dataAvailability } from "./snapshot";
import { DAY_MS, civilDate, dayStart, parseInstant, startOfDay } from "./zone";

const translate = (key: string) => {
  const value = key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], pt);
  return typeof value === "string" ? value : key;
};
const format = createFormat("pt", translate);
const instant = (value: string) => parseInstant(value) ?? Number.NaN;
const now = instant("2026-10-08T10:00:00Z");
const text = (value: Decimal | undefined) => value?.toString();

const referenceJSON = () => ({
  security_id: "reference",
  reference_price: {
    price: 51000,
    price_date: "2026-10-07",
    traded_at: "2026-10-07T09:00:00Z",
    collected_at: "2026-10-08T09:59:59Z",
    source_url: "https://www.bodiva.ao/history?symbol=ALFA",
    source_hash: "a".repeat(64),
    parser_version: "history-v1",
  } as Record<string, unknown>,
});

function decodeReference(edit?: [string, unknown]) {
  const json = referenceJSON();
  if (edit) json.reference_price[edit[0]] = edit[1];
  return referencePrice(decodeReferencePriceRow(json).referencePrice, now);
}

const asset = (reference: MarketReferencePrice): MarketSecurity =>
  marketSecurity({
    id: "reference",
    symbol: "ALFA",
    name: "Alfa",
    issuer: "Alfa",
    kind: "equity",
    quoteAvailability: "unavailable",
    referencePrice: reference,
    marketStatus: "open",
    isListed: true,
  });

const snapshot = (securities: MarketSecurity[], availability?: MarketSourceAvailability) =>
  marketSnapshot({
    status: "open",
    securities,
    updatedAt: now,
    sourceMetadata: { tradingDate: now, availability },
    marketContextValidUntil: now + 120_000,
  });

describe("market reference price", () => {
  it("recent verification keeps the original price date and cannot value a portfolio", () => {
    const reference = decodeReference();
    expect(reference).toBeDefined();
    expect(civilDate(reference!.priceDate)).toBe("2026-10-07");
    expect(reference!.collectedAt).toBe(now - 1000);
    const security = asset(reference!);
    expect(text(displayPrice(security, now))).toBe("51000");
    expect(format.securityPrice(displayPrice(security, now)!)).toBe(format.securityPrice(51000));
    expect(displayPriceLabel(security, now)).toBe(MARKET_MESSAGE_KEYS.price.reference);
    expect(translate(MARKET_MESSAGE_KEYS.price.reference)).toBe("Referência BODIVA");
    expect(displayPriceDateLabel(security, now)).toEqual({ kind: "yesterday" });
    expect(hasUsableQuote(security, now)).toBe(false);
    expect(movementIsAvailable(security, now)).toBe(false);
    expect(displayPercentageChange(security, now)).toBeUndefined();
    expect(currentQuotePrices([security], now).size).toBe(0);
    expect(security.history).toEqual([]);
    expect(keepingClosingReferenceOnly(security).referencePrice).toEqual(reference);
    const unproven = { ...security, referencePrice: undefined };
    const local = dataAvailability(snapshot([security, unproven]), now);
    expect(local.coverage?.referencePriceCount).toBe(1);
    expect(local.coverage?.missingPriceCount).toBe(1);
  });

  it("a session quote has priority but a failed refresh restores the reference", () => {
    let security: MarketSecurity = {
      ...asset(decodeReference()!),
      price: new Decimal(52000),
      percentageChange: new Decimal(1),
      volume: new Decimal(5),
      quoteAvailability: "available",
      quoteQuality: { status: "valid", reasons: [], validUntilEpoch: now / 1000 + 119, sourceObservedAtEpoch: now / 1000 - 1 },
      quoteTradingDate: now,
      marketContextValidUntil: now + 3_600_000,
    };
    expect(text(displayPrice(security, now))).toBe("52000");
    expect(displayPriceDateLabel(security, now)).toEqual({ kind: "today" });
    expect(hasUsableQuote(security, now)).toBe(true);
    security = { ...security, quoteQuality: invalidated(security.quoteQuality!, "stale", "staleFetch") };
    expect(text(displayPrice(security, now))).toBe("51000");
    expect(hasUsableQuote(security, now)).toBe(false);
  });

  it("Luanda midnight changes the date label without changing verification", () => {
    const before = instant("2026-10-08T22:59:59Z");
    const after = before + 1000;
    const day = dayStart("2026-10-08")!;
    expect(priceDateLabel(day, before)).toEqual({ kind: "today" });
    expect(priceDateLabel(day, after)).toEqual({ kind: "yesterday" });
    expect(priceDateLabel(dayStart("2026-09-28")!, after)).toEqual({ kind: "date", date: "2026-09-28" });
  });

  it("missing provenance, invalid dates and future evidence are rejected", () => {
    const edits: [string, unknown][] = [
      ["source_hash", ""],
      ["parser_version", ""],
      ["source_url", "https://example.com/history"],
      ["price_date", "2026-02-30"],
      ["price_date", "2026-10-09"],
      ["collected_at", "2026-10-08T10:00:01Z"],
      ["traded_at", "2026-10-06T09:00:00Z"],
      ["price", 0],
    ];
    for (const edit of edits) expect(decodeReference(edit), edit[0]).toBeUndefined();
  });

  it("additive contracts and global exclusive counts", () => {
    expect(decodeCurrentMarketQuotes({ prices: [], sessions: [], overview: [] }).referencePrices).toBeUndefined();
    const quotes = decodeCurrentMarketQuotes({
      prices: [],
      sessions: [],
      overview: [],
      reference_prices: [referenceJSON()],
      active_security_ids: ["reference"],
      availability: {
        status: "partial",
        session_quote_count: 10,
        reference_price_count: 135,
        missing_price_count: 1,
        active_instrument_count: 146,
      },
    });
    expect(quotes.referencePrices).toHaveLength(1);
    expect(quotes.activeSecurityIDs).toEqual(["reference"]);
    const coverage = availabilityCoverage(quotes.availability!);
    expect(coverage).toBeDefined();
    expect(coverage!.sessionQuoteCount + coverage!.referencePriceCount + coverage!.missingPriceCount).toBe(146);
    const reference = referencePrice(quotes.referencePrices?.[0].referencePrice, now)!;
    const cards = snapshot([asset(reference)], quotes.availability);
    expect(dataAvailability(cards, now).coverage).toEqual(coverage);
    expect(dataAvailability(cards, now, { usesGlobalCoverage: false }).coverage?.activeInstrumentCount).toBe(1);
    const summary = decodeHomeSummary(
      JSON.parse(`{"instrument_count":146,"available_quote_count":10,"valid_until_epoch":1791457200,"session_quote_count":10,"reference_price_count":135,"missing_price_count":1,"active_instrument_count":146}`),
    );
    expect(summaryCoverage(summary)).toEqual(coverage);
    expect(validatedCoverage({ session: 10, reference: 136, missing: 1, active: 146 })).toBeUndefined();
    expect(validatedCoverage({ session: -1, reference: 1, missing: 0, active: 0 })).toBeUndefined();
  });

  it("monetary prices keep cents and bonds keep their unit", () => {
    expect(format.securityPrice(51000)).toContain(",00");
    expect(format.securityPrice(98.25, { bond: true })).toContain("%");
    expect(format.securityPrice(98.25, { bond: true })).not.toContain("Kz");
  });

  it("official catalogue visibility overrides the encoded maturity and keeps the watchlist", () => {
    let security = marketSecurity({
      id: "bond",
      symbol: "BE15A26A",
      name: "Bond",
      issuer: "Issuer",
      kind: "corporateBond",
      isWatched: true,
      quoteAvailability: "unavailable",
      referencePrice: decodeReference(),
      isListed: true,
    });
    expect(isVisibleOutsideSearch(security, now)).toBe(false);
    security = { ...security, officialMarketVisibility: true };
    expect(isVisibleOutsideSearch(security, now)).toBe(true);
    security = { ...security, officialMarketVisibility: false };
    expect(isVisibleOutsideSearch(security, now)).toBe(false);
    expect(security.isListed).toBe(true);
    expect(security.isWatched).toBe(true);
  });

  it("coverage keeps its dated counts across midnight and diagnostics stay separate", () => {
    const afterMidnight = instant("2026-10-08T23:00:00Z");
    const availability: MarketSourceAvailability = {
      status: "partial",
      sessionQuoteCount: 1,
      referencePriceCount: 2,
      missingPriceCount: 1,
      activeInstrumentCount: 4,
      coverageDate: "2026-10-08",
    };
    const report = dataAvailability(snapshot([], availability), afterMidnight);
    expect(report.coverage?.sessionQuoteCount).toBe(1);
    expect(report.coverage?.referencePriceCount).toBe(2);
    expect(report.coverageDate).toBe(startOfDay(afterMidnight) - DAY_MS);
    expect(referenceUpdateIssue("verified", undefined)).toBeUndefined();
    expect(referenceUpdateIssue("failed", "sourceUnavailable")).toBeDefined();
    expect(translate(referenceUnavailableKey("notYetCollected"))).toContain("não foi recolhido");
  });
});
