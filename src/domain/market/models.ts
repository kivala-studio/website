import Decimal from "decimal.js";

import type { DataQualityReport } from "./quality";
import type { EpochMs } from "./zone";

export const SECURITY_KINDS = ["corporateBond", "equity", "fund", "other", "treasuryBond"] as const;
export type SecurityKind = (typeof SECURITY_KINDS)[number];

export const MARKET_STATUSES = ["unknown", "closed", "openingSoon", "open"] as const;
export type MarketStatus = (typeof MARKET_STATUSES)[number];

export type QuoteAvailability = "available" | "unavailable";

export interface PricePoint {
  readonly date: EpochMs;
  readonly value: Decimal;
  readonly openValue?: Decimal;
  readonly highValue?: Decimal;
  readonly lowValue?: Decimal;
  readonly volume?: Decimal;
  readonly tradeCount?: number;
}

/** A dated closing reference is display evidence, never a live valuation input. */
export interface VerifiedClosingPrice {
  readonly price: Decimal;
  /** Luanda midnight of the session. */
  readonly tradingDate: EpochMs;
  readonly confirmedAt: EpochMs;
  readonly percentageChange?: Decimal;
}

/** Source evidence for display only. It never grants current quote eligibility. */
export interface MarketReferencePrice {
  readonly price: Decimal;
  readonly priceDate: EpochMs;
  readonly tradedAt?: EpochMs;
  readonly collectedAt: EpochMs;
  readonly sourceURL: string;
  readonly sourceHash: string;
  readonly parserVersion: string;
}

export interface OrderBookLevel {
  readonly side: "bid" | "ask";
  readonly level: number;
  readonly price: Decimal;
  readonly quantity: Decimal;
  readonly orderCount?: number;
}

export interface SessionDetails {
  readonly openingPrice?: Decimal;
  readonly highPrice?: Decimal;
  readonly lowPrice?: Decimal;
  readonly tradeCount?: number;
}

export interface MarketSecurity {
  readonly id: string;
  readonly symbol: string;
  readonly name: string;
  readonly issuer: string;
  readonly issuerID?: string;
  readonly isin?: string;
  readonly currency?: string;
  readonly kind: SecurityKind;
  /** Last BODIVA price; zero with `quoteAvailability = unavailable` when there is none. */
  readonly price: Decimal;
  /** Verified change against the previous verified close; the only movement used for calculations. */
  readonly percentageChange: Decimal;
  readonly volume: Decimal;
  readonly isWatched: boolean;
  readonly history: readonly PricePoint[];
  readonly quoteAvailability: QuoteAvailability;
  readonly quoteQuality?: DataQualityReport;
  readonly hasVerifiedMovement?: boolean;
  readonly closingPrice?: VerifiedClosingPrice;
  readonly referencePrice?: MarketReferencePrice;
  readonly referenceUnavailableReason?: string;
  readonly referenceLastCheckedAt?: EpochMs;
  readonly referenceUpdateStatus?: string;
  readonly referenceUpdateReason?: string;
  /** BODIVA's reported change: display only. */
  readonly reportedPercentageChange?: Decimal;
  readonly marketStatus?: MarketStatus;
  readonly quoteTradingDate?: EpochMs;
  readonly isListed?: boolean;
  readonly officialMarketVisibility?: boolean;
  readonly marketContextValidUntil?: EpochMs;
  readonly details?: SessionDetails;
  readonly orderBook?: readonly OrderBookLevel[];
  readonly orderBookQuality?: DataQualityReport;
  readonly logoURL?: string;
  readonly issuerWebsiteURL?: string;
}

export type MarketSecurityInit = Pick<MarketSecurity, "id" | "symbol" | "kind"> &
  Partial<Omit<MarketSecurity, "id" | "symbol" | "kind">>;

const ZERO = new Decimal(0);

/** A security with neutral defaults: no price, no movement, not watched. */
export function marketSecurity(init: MarketSecurityInit): MarketSecurity {
  return {
    name: init.symbol,
    issuer: init.symbol,
    price: ZERO,
    percentageChange: ZERO,
    volume: ZERO,
    isWatched: false,
    history: [],
    quoteAvailability: "available",
    ...init,
  };
}

export interface MarketIndex {
  readonly value?: Decimal;
  readonly dailyChange?: Decimal;
  readonly percentageChange?: Decimal;
  readonly history: readonly PricePoint[];
  /** Session date of the verified closes used by this indicator. */
  readonly tradingDate?: EpochMs;
}

export const EMPTY_MARKET_INDEX: MarketIndex = { history: [] };

/** Mutually exclusive counts for the complete active catalogue. */
export interface MarketPriceCoverage {
  readonly sessionQuoteCount: number;
  readonly referencePriceCount: number;
  readonly missingPriceCount: number;
  readonly activeInstrumentCount: number;
}

export function validatedCoverage(counts: {
  session?: number;
  reference?: number;
  missing?: number;
  active?: number;
}): MarketPriceCoverage | undefined {
  const { session, reference, missing, active } = counts;
  if (session === undefined || reference === undefined || missing === undefined || active === undefined) return undefined;
  if (active < 0 || session < 0 || reference < 0 || missing < 0) return undefined;
  if (session > active || reference > active - session || missing !== active - session - reference) return undefined;
  return { sessionQuoteCount: session, referencePriceCount: reference, missingPriceCount: missing, activeInstrumentCount: active };
}

export const SOURCE_AVAILABILITY_STATUSES = ["available", "delayed", "sourceUnavailable", "partial", "unknown"] as const;
export type SourceAvailabilityStatus = (typeof SOURCE_AVAILABILITY_STATUSES)[number];

/** Source health is diagnostics only. Only each instrument's quality grants quote eligibility. */
export interface MarketSourceAvailability {
  readonly status: SourceAvailabilityStatus;
  readonly lastSuccessfulObservationAtEpoch?: number;
  readonly lastAttemptAtEpoch?: number;
  readonly retryAfterEpoch?: number;
  readonly availableInstrumentCount?: number;
  readonly totalInstrumentCount?: number;
  readonly sourceTradingDate?: string;
  readonly sessionQuoteCount?: number;
  readonly referencePriceCount?: number;
  readonly missingPriceCount?: number;
  readonly activeInstrumentCount?: number;
  readonly coverageDate?: string;
}

export const availabilityCoverage = (availability: MarketSourceAvailability) =>
  validatedCoverage({
    session: availability.sessionQuoteCount,
    reference: availability.referencePriceCount,
    missing: availability.missingPriceCount,
    active: availability.activeInstrumentCount,
  });

export interface MarketSourceMetadata {
  readonly tradingDate?: EpochMs;
  readonly collectedAt?: EpochMs;
  readonly publishedAt?: EpochMs;
  readonly dataStatus?: string;
  readonly sourceObservedAt?: EpochMs;
  readonly availability?: MarketSourceAvailability;
  /** Build time of the shared snapshot this data came from; absent for direct reads. */
  readonly snapshotGeneratedAt?: EpochMs;
}

export interface MarketSnapshot {
  readonly index: MarketIndex;
  readonly status: MarketStatus;
  readonly securities: readonly MarketSecurity[];
  readonly sessionVolume: Decimal;
  readonly trades: number;
  readonly updatedAt?: EpochMs;
  readonly statisticsQuality?: DataQualityReport;
  readonly sourceMetadata?: MarketSourceMetadata;
  /** Message keys of sections that could not be loaded. */
  readonly unavailableSections?: readonly MarketMessageKey[];
  readonly marketContextValidUntil?: EpochMs;
}

export type MarketSnapshotInit = Partial<MarketSnapshot> & Pick<MarketSnapshot, "securities">;

export function marketSnapshot(init: MarketSnapshotInit): MarketSnapshot {
  return { index: EMPTY_MARKET_INDEX, status: "unknown", sessionVolume: ZERO, trades: 0, ...init };
}

export type DataAvailabilityState =
  | "available"
  | "delayed"
  | "sourceUnavailable"
  | "partial"
  | "offline"
  | "unknownCalendar"
  | "historical"
  | "unavailable";

export interface MarketDataAvailability {
  readonly state: DataAvailabilityState;
  readonly availableInstrumentCount: number;
  readonly totalInstrumentCount: number;
  readonly lastSuccessfulObservationAt?: EpochMs;
  readonly coverage?: MarketPriceCoverage;
  readonly coverageDate?: EpochMs;
}

/** Server switches carried by the shared snapshot. */
export interface MarketClientControl {
  readonly maintenance: boolean;
  readonly minPollSeconds: number;
}

/** Counts describe the complete visible universe, never the bounded card array. */
export interface HomeMarketSummary {
  readonly instrumentCount: number;
  readonly availableQuoteCount: number;
  readonly validUntilEpoch: number;
  readonly lastObservationEpoch?: number;
  readonly sessionQuoteCount?: number;
  readonly referencePriceCount?: number;
  readonly missingPriceCount?: number;
  readonly activeInstrumentCount?: number;
  readonly coverageDate?: string;
}

export const summaryCoverage = (summary: HomeMarketSummary) =>
  validatedCoverage({
    session: summary.sessionQuoteCount,
    reference: summary.referencePriceCount,
    missing: summary.missingPriceCount,
    active: summary.activeInstrumentCount,
  });

/** Message keys (see `messages/*.json`) this module hands to the UI. */
export const MARKET_MESSAGE_KEYS = {
  status: {
    unknown: "common.unavailable",
    closed: "market.status.closed",
    openingSoon: "common.comingSoon",
    open: "market.status.open",
  },
  kind: {
    corporateBond: "market.kind.corporateBond",
    equity: "common.stock",
    fund: "market.kind.fundUnit",
    other: "market.kind.otherInstrument",
    treasuryBond: "market.kind.treasuryBond",
  },
  price: {
    quote: "market.price.bodivaQuote",
    lastQuote: "market.price.lastBodivaQuote",
    reference: "market.price.bodivaReference",
    close: "common.lastBodivaClose",
    lastVerifiedClose: "market.price.lastVerifiedClose",
    noQuote: "common.noQuote",
  },
  priceDate: { today: "common.today", yesterday: "formatting.price.sinceYesterday" },
  indexName: "common.appIndicator",
  verifiedClosesSection: "market.snapshot.verifiedCloses",
} as const;

type Leaves<T> = T extends string ? T : { [K in keyof T]: Leaves<T[K]> }[keyof T];
export type MarketMessageKey = Leaves<typeof MARKET_MESSAGE_KEYS> | ReferenceMessageKey;

export type ReferenceMessageKey =
  | "formatting.price.noTrades"
  | "formatting.price.provenanceUnconfirmed"
  | "formatting.price.sourceNoResponse"
  | "formatting.price.invalidResponse"
  | "formatting.price.rateLimited"
  | "formatting.price.historyNotCollected"
  | "formatting.price.unconfirmed"
  | "formatting.price.noNewPrices"
  | "formatting.price.referenceUpdate";
