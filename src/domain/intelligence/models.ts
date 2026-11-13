import type Decimal from "decimal.js";

import type { PriceObservation } from "../market/history-validation";
import type { EpochMs } from "../market/zone";
import type { PortfolioTransaction } from "../portfolio/models";
import type { VoiceComposition } from "../product-voice/voice";

/*
 * Shared intelligence models (iOS `Core/Intelligence/Insight.swift`, `FinancialFact.swift`, `WatchlistInsightFacts.swift`,
 * `PortfolioInsightFacts.swift`, `ActivityItem.swift`). Dates are epoch milliseconds; amounts are exact decimals.
 */

/** Half-open interval. Boundary close observations are carried separately in the payload. */
export interface InsightPeriod {
  readonly start: EpochMs;
  readonly endExclusive: EpochMs;
}

export const isValidPeriod = (period: InsightPeriod) =>
  Number.isFinite(period.start) && Number.isFinite(period.endExclusive) && period.start < period.endExclusive;
export const periodContains = (period: InsightPeriod, date: EpochMs) => date >= period.start && date < period.endExclusive;

export const INSIGHT_TYPES = [
  "assetPriceChange",
  "watchlistBreadth",
  "portfolioPricePerformance",
  "portfolioAllocation",
  "watchlistMovement",
  "watchlistSessionRun",
  "watchlistClosingExtreme",
  "watchlistInformation",
  "marketInformation",
] as const;
export type InsightType = (typeof INSIGHT_TYPES)[number];

export type InsightCategory = "market" | "watchlist" | "portfolio";

export type InsightDestination =
  | { readonly kind: "asset"; readonly assetID: string }
  | { readonly kind: "watchlist" }
  | { readonly kind: "portfolio" }
  | { readonly kind: "information"; readonly articleID: string };

export interface InsightRelevance {
  readonly isHeld: boolean;
  readonly isWatched: boolean;
  /** An ordinal from the existing personalisation ranking, never a financial confidence score. */
  readonly activityRank: number | null;
}

/** Input evidence comes from source rows, not chart points or snapshot-wide timestamps (shared with the market validator). */
export type InsightPriceObservation = PriceObservation;
export type InsightPriceObservationSource = PriceObservation["source"];

export type InsightCompleteness = "completeExpectedSessions" | "verifiedPublicationLinks";

export interface PortfolioSecurityMetadata {
  readonly assetID: string;
  readonly symbol: string;
  readonly currencyCode: string;
  readonly supportsUnitValuation: boolean;
  readonly issuerID: string | null;
  readonly issuerName: string | null;
  readonly sector: string | null;
  readonly allowsFractionalQuantity?: boolean;
}

export interface PortfolioInsightInput {
  readonly week: InsightPeriod;
  readonly transactions: readonly PortfolioTransaction[];
  readonly securities: readonly PortfolioSecurityMetadata[];
  readonly ledgerFetchedAt: EpochMs;
  readonly metadataFetchedAt: EpochMs;
}

export type PortfolioInsightEvidence = PortfolioInsightInput;

export interface WatchlistPublication {
  readonly articleID: string;
  readonly title: string;
  readonly publishedAt: EpochMs;
  readonly assetIDs: readonly string[];
  readonly primarySourceURL: string;
  readonly sourceName: string;
}

export interface WatchlistPublicationInput {
  readonly period: InsightPeriod;
  readonly fetchedAt: EpochMs;
  readonly articles: readonly WatchlistPublication[];
}

export interface WatchlistPublicationEvidence {
  readonly publication: WatchlistPublication;
  readonly fetchedAt: EpochMs;
}

export interface InsightProvenance {
  readonly calculationID: string;
  readonly calculationVersion: number;
  readonly calendarVersion: string;
  readonly observations: readonly InsightPriceObservation[];
  readonly fetchedAt: EpochMs;
  readonly completeness: InsightCompleteness;
  readonly portfolio?: PortfolioInsightEvidence | null;
  readonly publication?: WatchlistPublicationEvidence | null;
}

export interface AssetPriceChangeFact {
  readonly assetID: string;
  readonly currencyCode: string;
  readonly startPrice: Decimal;
  readonly endPrice: Decimal;
  readonly percentageChange: Decimal;
  readonly firstObservedAt: EpochMs;
  readonly lastObservedAt: EpochMs;
}

export interface WatchlistBreadthFact {
  readonly rising: number;
  readonly falling: number;
  readonly unchanged: number;
  readonly assetCount: number;
  readonly significantAssetIDs?: readonly string[] | null;
}

/** Product salience gates, not statistical rarity or investment-risk thresholds. */
export const WATCHLIST_SIGNIFICANCE = {
  minimumMovement: 1,
  minimumRun: 3,
  minimumExtremeObservations: 5,
  publicationAgeMs: 7 * 86_400_000,
} as const;

export interface WatchlistMovementFact {
  readonly movement: AssetPriceChangeFact;
  readonly comparedAssetIDs: readonly string[];
}

export interface WatchlistSessionRunFact {
  readonly assetID: string;
  /** +1 rising, -1 falling. */
  readonly direction: number;
  readonly sessions: number;
  readonly startPrice: Decimal;
  readonly endPrice: Decimal;
  readonly percentage: Decimal;
  readonly firstObservedAt: EpochMs;
  readonly lastObservedAt: EpochMs;
}

export interface WatchlistClosingExtremeFact {
  readonly assetID: string;
  readonly isHigh: boolean;
  readonly previousExtreme: Decimal;
  readonly closingPrice: Decimal;
  readonly percentageBeyondPrevious: Decimal;
  readonly observationCount: number;
  readonly firstObservedAt: EpochMs;
  readonly lastObservedAt: EpochMs;
}

export interface PortfolioPerformancePosition {
  readonly assetID: string;
  readonly symbol: string;
  readonly quantity: Decimal;
  readonly startValue: Decimal;
  readonly endValue: Decimal;
  readonly contribution: Decimal;
  readonly percentagePoints: Decimal;
}

export interface PortfolioPricePerformanceFact {
  readonly startValue: Decimal;
  readonly endValue: Decimal;
  readonly change: Decimal;
  readonly percentage: Decimal;
  readonly firstObservedAt: EpochMs;
  readonly lastObservedAt: EpochMs;
  /** Ranked by monetary contribution, descending; ties use the asset id. */
  readonly positions: readonly PortfolioPerformancePosition[];
  readonly advancing: number;
  readonly declining: number;
  readonly unchanged: number;
}

export interface PortfolioAllocationPosition {
  readonly assetID: string;
  readonly symbol: string;
  readonly quantity: Decimal;
  readonly price: Decimal;
  readonly value: Decimal;
  readonly percentage: Decimal;
}

export interface PortfolioAllocationGroup {
  readonly id: string;
  readonly name: string;
  readonly assetIDs: readonly string[];
  readonly value: Decimal;
  readonly percentage: Decimal;
}

export interface PortfolioAllocationFact {
  readonly totalValue: Decimal;
  readonly observedAt: EpochMs;
  readonly holdingsCutoff: EpochMs;
  /** All open recorded positions are included; never a partial priced subset. */
  readonly positions: readonly PortfolioAllocationPosition[];
  readonly issuers: readonly PortfolioAllocationGroup[] | null;
  readonly sectors: readonly PortfolioAllocationGroup[] | null;
}

/** Verified measurements contain no surface copy, formatting or attention scores. */
export type FinancialFact =
  | { readonly kind: "priceChange"; readonly value: AssetPriceChangeFact }
  | { readonly kind: "breadth"; readonly value: WatchlistBreadthFact }
  | { readonly kind: "portfolioPerformance"; readonly value: PortfolioPricePerformanceFact }
  | { readonly kind: "portfolioAllocation"; readonly value: PortfolioAllocationFact }
  | { readonly kind: "watchlistMovement"; readonly value: WatchlistMovementFact }
  | { readonly kind: "watchlistSessionRun"; readonly value: WatchlistSessionRunFact }
  | { readonly kind: "watchlistClosingExtreme"; readonly value: WatchlistClosingExtremeFact }
  | { readonly kind: "watchlistInformation"; readonly value: WatchlistPublication };

/** A composed sentence (iOS `VoiceComposition`). Product voice owns the shape; the engine only carries it. */
export type InsightVoiceComposition = VoiceComposition;

export interface Insight {
  /** Stable semantic identity; corrected observations replace the fact under the same id. */
  readonly id: string;
  readonly type: InsightType;
  readonly category: InsightCategory;
  readonly fact: FinancialFact;
  readonly generatedAt: EpochMs;
  readonly period: InsightPeriod;
  readonly expiresAt: EpochMs;
  readonly relatedAssetIDs: readonly string[];
  readonly relevance: InsightRelevance;
  readonly destination: InsightDestination;
  readonly provenance: InsightProvenance;
  readonly serverNotificationID?: string | null;
  readonly voiceComposition?: InsightVoiceComposition | null;
}

/** Ordered: comparisons use `INFORMATION_SIGNIFICANCE.indexOf`. */
export const INFORMATION_SIGNIFICANCE = ["routine", "noteworthy", "significant", "material", "critical"] as const;
export type InformationSignificance = (typeof INFORMATION_SIGNIFICANCE)[number];
export const significanceRank = (value: InformationSignificance) => INFORMATION_SIGNIFICANCE.indexOf(value);
