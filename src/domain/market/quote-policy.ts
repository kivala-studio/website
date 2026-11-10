import Decimal from "decimal.js";

import type { CivilDate } from "../format/date";
import {
  MARKET_MESSAGE_KEYS,
  type MarketReferencePrice,
  type MarketSecurity,
  type OrderBookLevel,
  type QuoteAvailability,
} from "./models";
import { type QualityReason, permitsCurrentUse, permitsUse, qualityFailure } from "./quality";
import { type EpochMs, SECOND_MS, addDays, civilDate, isSameDay, startOfDay } from "./zone";

const ZERO = new Decimal(0);
const HUNDRED = new Decimal(100);

const positive = (value: Decimal | undefined): value is Decimal => value !== undefined && value.isFinite() && value.gt(0);
const plausibleChange = (value: Decimal | undefined): value is Decimal =>
  value !== undefined && value.isFinite() && value.gte(-100);
const before = (deadline: EpochMs | undefined, now: EpochMs) =>
  deadline !== undefined && Number.isFinite(deadline) && now < deadline;

/** Reference evidence must be BODIVA's, dated and collected in order, with complete provenance. */
export function isValidReference(reference: MarketReferencePrice, now: EpochMs): boolean {
  const { price, priceDate, tradedAt, collectedAt } = reference;
  if (!positive(price) || ![priceDate, collectedAt, now].every(Number.isFinite) || collectedAt > now) return false;
  if (startOfDay(priceDate) > startOfDay(collectedAt)) return false;
  if (tradedAt !== undefined && !(Number.isFinite(tradedAt) && tradedAt <= collectedAt && isSameDay(tradedAt, priceDate))) {
    return false;
  }
  let url: URL;
  try {
    url = new URL(reference.sourceURL);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.username === "" &&
    url.password === "" &&
    ["bodiva.ao", "www.bodiva.ao"].includes(url.hostname.toLowerCase()) &&
    /^[a-fA-F0-9]{64}$/.test(reference.sourceHash) &&
    reference.parserVersion.trim() !== ""
  );
}

/**
 * Usable as a current quote: listed, priced, `valid` without reasons, inside `validUntilEpoch`,
 * inside the calendar context and, while open, observed within two minutes and dated today.
 */
export function hasUsableQuote(security: MarketSecurity, now: EpochMs): boolean {
  const { quoteQuality: quality, marketStatus: status } = security;
  return (
    security.isListed !== false &&
    security.quoteAvailability === "available" &&
    (quality === undefined || permitsUse(quality, now)) &&
    (status === undefined ||
      (status !== "unknown" &&
        quality !== undefined &&
        permitsCurrentUse(quality, now, status === "open") &&
        before(security.marketContextValidUntil, now))) &&
    (status !== "open" || (security.quoteTradingDate !== undefined && isSameDay(security.quoteTradingDate, now)))
  );
}

export const hasSessionQuote = (security: MarketSecurity, now: EpochMs) =>
  hasUsableQuote(security, now) && security.quoteTradingDate !== undefined && isSameDay(security.quoteTradingDate, now);

export const movementIsAvailable = (security: MarketSecurity, now: EpochMs) =>
  hasUsableQuote(security, now) && security.hasVerifiedMovement !== false;

export function usesReferenceDisplayPrice(security: MarketSecurity, now: EpochMs): boolean {
  const { referencePrice: reference, quoteTradingDate } = security;
  if (!reference || !isValidReference(reference, now) || hasSessionQuote(security, now)) return false;
  // A closed-session quote stays eligible after midnight; a reference from that session or older must not hide it.
  return !(
    hasUsableQuote(security, now) &&
    quoteTradingDate !== undefined &&
    startOfDay(quoteTradingDate) >= startOfDay(reference.priceDate)
  );
}

export function usesClosingDisplayPrice(security: MarketSecurity, now: EpochMs): boolean {
  const { marketStatus: status, closingPrice: close } = security;
  if (!(status === "closed" || status === "openingSoon")) return false;
  if (!(security.marketContextValidUntil !== undefined && now < security.marketContextValidUntil) || !close) return false;
  if (!hasUsableQuote(security, now) || !positive(security.price)) return true;
  // An older close must not replace a newer BODIVA quote while today's close is pending.
  const quoteDate = security.quoteTradingDate ?? security.quoteQuality?.observedAt;
  return quoteDate !== undefined && startOfDay(close.tradingDate) >= startOfDay(quoteDate);
}

const STALENESS_REASONS: readonly QualityReason[] = ["staleFetch", "staleObservation", "delayedIngestion"];

/** A dated source quote remains a display reference after its evidence expires; never a valuation input. */
function latestReportedPrice(security: MarketSecurity, now: EpochMs): Decimal | undefined {
  const quality = security.quoteQuality;
  if (security.isListed === false || security.quoteAvailability !== "available" || !positive(security.price)) return undefined;
  if (!Number.isFinite(now) || !quality || !["valid", "stale", "delayed"].includes(quality.status)) return undefined;
  if (!quality.reasons.every((reason) => STALENESS_REASONS.includes(reason))) return undefined;
  const day = security.quoteTradingDate ?? quality.observedAt;
  if (day === undefined || !Number.isFinite(day) || startOfDay(day) > startOfDay(now)) return undefined;
  if (quality.observedAt !== undefined && !(Number.isFinite(quality.observedAt) && quality.observedAt <= now)) return undefined;
  const source = quality.sourceObservedAtEpoch;
  if (source !== undefined && !(Number.isFinite(source) && source <= now / SECOND_MS)) return undefined;
  return security.price;
}

function intradayDisplayPrice(security: MarketSecurity, now: EpochMs): Decimal | undefined {
  // BODIVA's reported quote is display evidence even before a verified close exists.
  if (hasUsableQuote(security, now) && positive(security.price)) return security.price;
  return latestReportedPrice(security, now);
}

export const usesIntradayDisplayPrice = (security: MarketSecurity, now: EpochMs) =>
  !usesReferenceDisplayPrice(security, now) &&
  !usesClosingDisplayPrice(security, now) &&
  intradayDisplayPrice(security, now) !== undefined;

/** The price to show, by precedence: session quote, reference, verified close, usable quote, last reported. */
export function displayPrice(security: MarketSecurity, now: EpochMs): Decimal | undefined {
  if (hasSessionQuote(security, now) && !usesClosingDisplayPrice(security, now) && positive(security.price)) {
    return security.price;
  }
  if (usesReferenceDisplayPrice(security, now)) return security.referencePrice?.price;
  if (usesClosingDisplayPrice(security, now)) return security.closingPrice?.price;
  if (hasUsableQuote(security, now) && positive(security.price)) return security.price;
  return latestReportedPrice(security, now);
}

export type PriceLabelKey = (typeof MARKET_MESSAGE_KEYS.price)[Exclude<keyof typeof MARKET_MESSAGE_KEYS.price, "noQuote" | "lastVerifiedClose">];

export function displayPriceLabel(security: MarketSecurity, now: EpochMs): PriceLabelKey | undefined {
  const keys = MARKET_MESSAGE_KEYS.price;
  if (usesReferenceDisplayPrice(security, now)) return keys.reference;
  if (usesClosingDisplayPrice(security, now)) return keys.close;
  if (displayPrice(security, now) === undefined) return undefined;
  return hasUsableQuote(security, now) ? keys.quote : keys.lastQuote;
}

/** Displayed variation. BODIVA's reported figure may be shown, never used for maths; a reference has none. */
export function displayPercentageChange(security: MarketSecurity, now: EpochMs): Decimal | undefined {
  if (usesReferenceDisplayPrice(security, now)) return undefined;
  const reported = security.reportedPercentageChange;
  if (!usesIntradayDisplayPrice(security, now)) {
    const close = security.closingPrice;
    if (!usesClosingDisplayPrice(security, now) || !close) return undefined;
    if (close.percentageChange !== undefined) return close.percentageChange;
    // A confirmed same-session quote still carries BODIVA's figure when the previous verified close is missing.
    const { quoteTradingDate } = security;
    if (
      hasUsableQuote(security, now) &&
      close.price.eq(security.price) &&
      quoteTradingDate !== undefined &&
      isSameDay(close.tradingDate, quoteTradingDate) &&
      plausibleChange(reported)
    ) {
      return reported;
    }
    return undefined;
  }
  if (plausibleChange(reported)) return reported;
  return hasUsableQuote(security, now) && security.hasVerifiedMovement !== false && security.percentageChange.isFinite()
    ? security.percentageChange
    : undefined;
}

/** Amount implied by the verified change: `price − price / (1 + change / 100)`. */
export function dailyPriceChange(security: MarketSecurity, now: EpochMs): Decimal {
  const change = security.percentageChange;
  if (!movementIsAvailable(security, now) || change.eq(-100)) return ZERO;
  return security.price.minus(security.price.div(change.div(HUNDRED).plus(1)));
}

export function displayPriceChange(security: MarketSecurity, now: EpochMs): Decimal | undefined {
  if (usesReferenceDisplayPrice(security, now)) return undefined;
  const change = security.percentageChange;
  if (usesIntradayDisplayPrice(security, now)) {
    const reported = security.reportedPercentageChange;
    if (!movementIsAvailable(security, now) || !change.isFinite() || change.lte(-100)) return undefined;
    if (reported !== undefined && !reported.eq(change)) return undefined;
    return dailyPriceChange(security, now);
  }
  const close = security.closingPrice;
  const percentage = close?.percentageChange;
  if (!usesClosingDisplayPrice(security, now) || !close || percentage === undefined || percentage.lte(-100)) return undefined;
  return close.price.minus(close.price.div(percentage.div(HUNDRED).plus(1)));
}

/** Discovery ranks the displayed BODIVA variation; verified movement stays a separate requirement. */
export const hasDisplayMovement = (security: MarketSecurity, now: EpochMs) =>
  hasUsableQuote(security, now) && plausibleChange(displayPercentageChange(security, now));

export function displayPriceDate(security: MarketSecurity, now: EpochMs): EpochMs | undefined {
  if (usesReferenceDisplayPrice(security, now)) return security.referencePrice?.priceDate;
  if (hasSessionQuote(security, now)) return security.quoteTradingDate;
  if (usesClosingDisplayPrice(security, now)) return security.closingPrice?.tradingDate;
  return displayPrice(security, now) === undefined ? undefined : (security.quoteTradingDate ?? security.quoteQuality?.observedAt);
}

export type PriceDateLabel = { kind: "today" } | { kind: "yesterday" } | { kind: "date"; date: CivilDate };

/** Relative to the Luanda day of `now`. Keys: `MARKET_MESSAGE_KEYS.priceDate`. */
export function priceDateLabel(date: EpochMs, now: EpochMs): PriceDateLabel {
  if (isSameDay(date, now)) return { kind: "today" };
  if (isSameDay(date, addDays(now, -1))) return { kind: "yesterday" };
  return { kind: "date", date: civilDate(date) };
}

export function displayPriceDateLabel(security: MarketSecurity, now: EpochMs): PriceDateLabel | undefined {
  const date = displayPriceDate(security, now);
  return date === undefined ? undefined : priceDateLabel(date, now);
}

/** When the displayed figure was last confirmed at its source. */
export function displayPriceVerification(security: MarketSecurity, now: EpochMs): EpochMs | undefined {
  if (usesReferenceDisplayPrice(security, now)) return security.referencePrice?.collectedAt;
  if (usesClosingDisplayPrice(security, now)) return security.closingPrice?.confirmedAt;
  const quality = security.quoteQuality;
  const observedAt = quality?.observedAt;
  const epoch = quality?.sourceObservedAtEpoch ?? (observedAt === undefined ? undefined : observedAt / SECOND_MS);
  return epoch !== undefined && Number.isFinite(epoch) && epoch <= now / SECOND_MS ? epoch * SECOND_MS : undefined;
}

/** A chart's last known level: displayed price, then the latest valid history point, then a usable quote. */
export function chartReferencePrice(security: MarketSecurity, now: EpochMs): Decimal | undefined {
  return (
    displayPrice(security, now) ??
    security.history.findLast((point) => positive(point.value))?.value ??
    (hasUsableQuote(security, now) && positive(security.price) ? security.price : undefined)
  );
}

/** Depth is current only while open, inside the calendar context and within the two-minute ceiling. */
export function availableOrderBook(security: MarketSecurity, now: EpochMs): readonly OrderBookLevel[] | undefined {
  if (security.marketStatus !== "open" || !before(security.marketContextValidUntil, now)) return undefined;
  if (!security.orderBookQuality || !permitsCurrentUse(security.orderBookQuality, now)) return undefined;
  return security.orderBook;
}

/** What a restored cache may show: dated closes and references, nothing current. */
export function keepingClosingReferenceOnly(security: MarketSecurity): MarketSecurity {
  const unavailable: QuoteAvailability = "unavailable";
  return {
    id: security.id,
    symbol: security.symbol,
    name: security.name,
    issuer: security.issuer,
    issuerID: security.issuerID,
    isin: security.isin,
    currency: security.currency,
    kind: security.kind,
    price: ZERO,
    percentageChange: ZERO,
    volume: ZERO,
    isWatched: false,
    history: [],
    quoteAvailability: unavailable,
    quoteQuality: qualityFailure("stale", "staleFetch"),
    hasVerifiedMovement: false,
    closingPrice: security.closingPrice,
    referencePrice: security.referencePrice,
    referenceUnavailableReason: security.referenceUnavailableReason,
    referenceLastCheckedAt: security.referenceLastCheckedAt,
    referenceUpdateStatus: security.referenceUpdateStatus,
    referenceUpdateReason: security.referenceUpdateReason,
    marketStatus: "unknown",
    isListed: security.isListed,
    officialMarketVisibility: security.officialMarketVisibility,
    marketContextValidUntil: security.marketContextValidUntil,
    logoURL: security.logoURL,
    issuerWebsiteURL: security.issuerWebsiteURL,
  };
}

/** Prices that may value a portfolio now. Everything else is display evidence only. */
export function currentQuotePrices(securities: readonly MarketSecurity[], now: EpochMs): Map<string, Decimal> {
  return new Map(securities.filter((security) => hasUsableQuote(security, now)).map((security) => [security.id, security.price]));
}
