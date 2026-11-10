import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import pt from "../../../messages/pt.json";
import { isVisibleOutsideSearch } from "./classification";
import { type VerifiedCloseRow, decodeCurrentMarketQuotes, decodeSecurityRows, decodeVerifiedCloseRows } from "./decode";
import { applyDiscoveryQuery } from "./discovery";
import { buildMarketSnapshot, verifiedClosingPrice } from "./mapping";
import { MARKET_MESSAGE_KEYS, type MarketSecurity, type VerifiedClosingPrice, marketSecurity } from "./models";
import { verifiedCloseLabel } from "./presentation";
import { VALID_QUALITY, qualityFailure } from "./quality";
import {
  chartReferencePrice,
  displayPercentageChange,
  displayPrice,
  displayPriceChange,
  displayPriceLabel,
  hasUsableQuote,
  keepingClosingReferenceOnly,
  movementIsAvailable,
  usesIntradayDisplayPrice,
} from "./quote-policy";
import { DAY_MS, civilDate } from "./zone";

const translate = (key: string) => {
  const value = key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], pt);
  return typeof value === "string" ? value : key;
};
const now = 1_790_726_400_000;
const text = (value: Decimal | undefined) => value?.toString();
const label = (security: MarketSecurity) => {
  const key = displayPriceLabel(security, now);
  return key && translate(key);
};

function closeRow(price: number, tradingDate = "2026-09-28", confirmedAt = "2026-09-28T15:00:00Z", change?: number): VerifiedCloseRow {
  return { securityID: "bai", price: new Decimal(price), tradingDate, confirmedAt, verifiedChangePercent: change === undefined ? undefined : new Decimal(change) };
}

const security = (close?: VerifiedClosingPrice): MarketSecurity =>
  marketSecurity({
    id: "bai",
    symbol: "BAIAAAAA",
    name: "BAI",
    issuer: "BAI",
    kind: "equity",
    isWatched: true,
    quoteAvailability: "unavailable",
    quoteQuality: qualityFailure("delayed", "notFinal"),
    closingPrice: close,
    marketStatus: "closed",
    marketContextValidUntil: now + 120_000,
  });

const sbao = (overrides: Partial<MarketSecurity> = {}): MarketSecurity =>
  marketSecurity({
    id: "sbao",
    symbol: "SBAOAAAA",
    name: "Standard Bank Angola",
    issuer: "Standard Bank Angola",
    kind: "equity",
    price: new Decimal(62_500),
    percentageChange: new Decimal(25),
    volume: new Decimal(7_043),
    quoteQuality: VALID_QUALITY,
    hasVerifiedMovement: false,
    reportedPercentageChange: new Decimal(25),
    ...overrides,
  });

/** The three direct reads (catalogue, current quotes, verified closes) for one host. */
function loadSnapshot(host: "live-price" | "closing-reference" | "missing-reference") {
  const receipt = now / 1000;
  const securities = decodeSecurityRows([{ id: "bai", symbol: "BAIAAAAA", security_type: "stock", currency: "AOA", is_active: true }]);
  const quotes = decodeCurrentMarketQuotes(
    host === "live-price"
      ? {
          prices: [{
            security_id: "bai", trading_date: civilDate(now), last_price: 62500, change_percent: 25, verified_change_percent: null,
            data_quality: { status: "valid", reasons: [], validUntilEpoch: receipt + 120, sourceObservedAtEpoch: receipt },
          }],
          sessions: [],
          overview: [{ status: "open" }],
        }
      : {
          prices: [{ security_id: "bai", trading_date: "2026-09-29", last_price: 97000, change_percent: 2.159, data_quality: { status: "delayed", reasons: ["notFinal"] } }],
          sessions: [],
          overview: [{ status: "open" }],
        },
  );
  const closes =
    host === "missing-reference"
      ? undefined
      : decodeVerifiedCloseRows([{ security_id: "bai", price: 94950, trading_date: "2026-09-28", confirmed_at: "2026-09-28T15:00:00Z", verified_change_percent: null }]);
  return buildMarketSnapshot({ securities, quotes, closes }, now);
}

describe("verified closing prices", () => {
  it("a first listing shows the BODIVA quote and reported movement without inventing a close", () => {
    let asset = sbao();
    expect(text(displayPrice(asset, now))).toBe("62500");
    expect(usesIntradayDisplayPrice(asset, now)).toBe(true);
    expect(asset.closingPrice).toBeUndefined();
    expect(text(displayPercentageChange(asset, now))).toBe("25");
    expect(displayPriceChange(asset, now)).toBeUndefined();
    expect(label(asset)).toBe("Cotação BODIVA");
    expect(displayPrice(keepingClosingReferenceOnly(asset), now)).toBeUndefined();

    asset = { ...asset, quoteQuality: { status: "valid", reasons: [], validUntilEpoch: now / 1000 - 1 } };
    expect(displayPrice(asset, now)).toBeUndefined();
    expect(displayPercentageChange(asset, now)).toBeUndefined();
    expect(hasUsableQuote(asset, now)).toBe(false);
    expect(displayPriceLabel(asset, now)).toBeUndefined();

    for (const quality of [qualityFailure("stale", "staleFetch"), qualityFailure("delayed", "notFinal")]) {
      asset = { ...asset, quoteQuality: quality };
      expect(displayPrice(asset, now)).toBeUndefined();
      expect(displayPercentageChange(asset, now)).toBeUndefined();
      expect(usesIntradayDisplayPrice(asset, now)).toBe(false);
      expect(hasUsableQuote(asset, now)).toBe(false);
    }
    asset = { ...asset, quoteQuality: undefined };
    expect(text(displayPrice(asset, now))).toBe("62500");
  });

  it("a live BODIVA quote takes precedence over an older verified close", () => {
    const receipt = now / 1000;
    let asset = sbao({
      quoteQuality: { status: "valid", reasons: [], validUntilEpoch: receipt + 120, sourceObservedAtEpoch: receipt },
      closingPrice: { price: new Decimal(60_000), tradingDate: now, confirmedAt: now },
      marketStatus: "open",
      quoteTradingDate: now,
      marketContextValidUntil: now + 120_000,
    });
    expect(text(displayPrice(asset, now))).toBe("62500");
    expect(text(displayPercentageChange(asset, now))).toBe("25");
    expect(usesIntradayDisplayPrice(asset, now)).toBe(true);
    asset = { ...asset, marketStatus: "closed" };
    expect(text(displayPrice(asset, now))).toBe("60000");
    expect(usesIntradayDisplayPrice(asset, now)).toBe(false);
    expect(label(asset)).toBe("Último fecho BODIVA");
    asset = { ...asset, quoteQuality: qualityFailure("delayed", "notFinal"), quoteTradingDate: now + DAY_MS };
    expect(text(displayPrice(asset, now))).toBe("60000");
    asset = { ...asset, quoteTradingDate: undefined };
    expect(text(displayPrice(asset, now))).toBe("60000");
    const cached = keepingClosingReferenceOnly({ ...asset, marketStatus: "open" });
    expect(displayPrice(cached, now)).toBeUndefined();
    expect(displayPriceLabel(cached, now)).toBeUndefined();
    expect(hasUsableQuote(cached, now)).toBe(false);
  });

  it("decodes the BODIVA reported percentage when verified movement is missing", () => {
    const asset = loadSnapshot("live-price").securities[0];
    expect(text(displayPrice(asset, now))).toBe("62500");
    expect(text(displayPercentageChange(asset, now))).toBe("25");
    expect(text(asset.percentageChange)).toBe("0");
    expect(movementIsAvailable(asset, now)).toBe(false);
    expect(displayPriceChange(asset, now)).toBeUndefined();
    expect(text(asset.reportedPercentageChange)).toBe("25");
    expect(label(asset)).toBe("Cotação BODIVA");
  });

  it("keeps a BODIVA quote before the close despite a quality rejection", () => {
    const snapshot = loadSnapshot("closing-reference");
    const asset = snapshot.securities[0];
    expect(displayPrice(asset, now)).toBeUndefined();
    expect(displayPercentageChange(asset, now)).toBeUndefined();
    expect(text(asset.price)).toBe("97000");
    expect(asset.marketStatus).toBe("open");
    expect(hasUsableQuote(asset, now)).toBe(false);
    expect(movementIsAvailable(asset, now)).toBe(false);
    expect(applyDiscoveryQuery(snapshot.securities, {}, now)).toHaveLength(1);
    expect(translate(MARKET_MESSAGE_KEYS.price.noQuote)).toBe("Sem cotação");
  });

  it("an unavailable closing endpoint does not hide the catalogue", () => {
    const snapshot = loadSnapshot("missing-reference");
    expect(snapshot.securities).toHaveLength(1);
    expect(text(snapshot.securities[0].price)).toBe("97000");
    expect(applyDiscoveryQuery(snapshot.securities, {}, now)).toHaveLength(1);
    expect(snapshot.unavailableSections?.map(translate)).toContain("Fechos verificados");
  });

  it("the verified closing fallback never authorises live valuation", () => {
    const close = verifiedClosingPrice(closeRow(94_950), now);
    expect(close).toBeDefined();
    const asset = security(close);
    expect(text(displayPrice(asset, now))).toBe("94950");
    expect(displayPercentageChange(asset, now)).toBeUndefined();
    expect(hasUsableQuote(asset, now)).toBe(false);
    expect(movementIsAvailable(asset, now)).toBe(false);
    expect(isVisibleOutsideSearch(asset, now)).toBe(true);
    const { key, date } = verifiedCloseLabel(close!);
    expect(translate(key)).toContain("Último fecho verificado");
    expect(date).toBe("2026-09-28");
  });

  it("a newer verified close replaces the reference and missing prices remain visible", () => {
    let asset = security(verifiedClosingPrice(closeRow(94_950), now));
    asset = { ...asset, closingPrice: verifiedClosingPrice(closeRow(97_000, "2026-09-29", "2026-09-29T15:00:00Z", 2.159031), now) };
    expect(text(displayPrice(asset, now))).toBe("97000");
    expect(displayPercentageChange(asset, now)).toBeDefined();
    expect(applyDiscoveryQuery([security()], {}, now)).toHaveLength(1);
    expect(displayPrice(security(), now)).toBeUndefined();
  });

  it("malformed and future closing references are rejected", () => {
    for (const price of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) expect(verifiedClosingPrice(closeRow(price), now)).toBeUndefined();
    expect(verifiedClosingPrice(closeRow(100, "2026-02-30"), now)).toBeUndefined();
    expect(verifiedClosingPrice(closeRow(100, "2026-10-01", "2026-10-01T15:00:00Z"), now)).toBeUndefined();
  });

  // iOS round-trips the disk cache through JSON first; persistence belongs to the data layer.
  it("a cached closing reference survives expired live evidence", () => {
    const close = verifiedClosingPrice(closeRow(94_950), now);
    const restored = keepingClosingReferenceOnly({ ...security(close), history: [{ date: now, value: new Decimal(94_950) }] });
    expect(displayPrice(restored, now)).toBeUndefined();
    expect(text(restored.closingPrice?.price)).toBe("94950");
    expect(restored.history).toEqual([]);
    expect(text(restored.price)).toBe("0");
    expect(restored.quoteAvailability).toBe("unavailable");
    expect(hasUsableQuote(restored, now)).toBe(false);
  });

  it("a historical chart reference never authorises live valuation", () => {
    const asset = {
      ...security(),
      history: [
        { date: now - DAY_MS, value: new Decimal(94_950) },
        { date: now, value: new Decimal(Number.NaN) },
      ],
    };
    expect(text(chartReferencePrice(asset, now))).toBe("94950");
    expect(displayPrice(asset, now)).toBeUndefined();
    expect(hasUsableQuote(asset, now)).toBe(false);
    expect(movementIsAvailable(asset, now)).toBe(false);
    expect(chartReferencePrice(security(), now)).toBeUndefined();
  });
});
