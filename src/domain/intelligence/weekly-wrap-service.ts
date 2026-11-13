import type { MarketCalendar } from "../market/calendar";
import { type EpochMs, dayStart, tradingDateNoon } from "../market/zone";
import { orderWrapStories } from "../personalisation/weekly-wrap";
import { watchlistInsightCandidates } from "../personalisation/insight-personalization";
import { interestProfile, type UserInterestProfile } from "../personalisation/profile";
import { ledgerPositions } from "../portfolio/calculator";
import type { PortfolioTransaction } from "../portfolio/models";
import { type InsightAvailability, type InsightInput, InsightEngine } from "./engine";
import { marketSummary } from "./math";
import type { Insight, InsightPeriod, PortfolioInsightInput } from "./models";
import type {
  WeeklyWrap,
  WeeklyWrapMove,
  WeeklyWrapOmission,
  WeeklyWrapPeriod,
  WeeklyWrapPortfolio,
  WeeklyWrapSnapshotMetadata,
  WeeklyWrapStory,
} from "./weekly-wrap";

/*
 * iOS `VerifiedWeeklyWrapService.make` and `VerifiedPortfolioInsightService`: the Wrap composes the shared engine's
 * facts; it never recalculates an asset change.
 */

export interface WeeklyWrapSecurity {
  readonly id: string;
  readonly symbol: string;
  readonly name: string;
  readonly issuer: string;
  /** `equity`, `fund`, `bond`… */
  readonly kind: string;
  readonly isWatched: boolean;
  readonly currencyCode: string | null;
  readonly issuerID?: string | null;
  readonly issuerSector?: string | null;
}

export interface WeeklyWrapEvidence {
  readonly comparisonPeriod: InsightPeriod;
  readonly calendar: MarketCalendar;
  readonly observations: InsightInput["observations"];
  readonly fetchedAt: EpochMs;
}

/** The reading-activity slice a Wrap uses (iOS `PersonalisationSnapshot`). */
export interface WeeklyWrapActivity {
  readonly uniqueAssetsViewed: number;
  readonly mostViewedAssetID: string | null;
  readonly mostViewedCount: number;
  readonly mostViewedDays: number;
  readonly relevantAssetIDs: readonly string[];
  readonly interestProfile: Pick<UserInterestProfile, "behavior">;
}

export interface WeeklyWrapRequest {
  readonly securities: readonly WeeklyWrapSecurity[];
  readonly evidence: WeeklyWrapEvidence;
  readonly transactions: readonly PortfolioTransaction[];
  readonly portfolioLoaded: boolean;
  readonly personalisation: WeeklyWrapActivity | null;
  readonly period: WeeklyWrapPeriod;
  readonly now: EpochMs;
  readonly confirmedWatchedIDs?: ReadonlySet<string>;
  readonly availability?: InsightAvailability;
  /** The archive's snapshot identity; a fresh one per Wrap by default. */
  readonly snapshotID?: string;
}

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const supportsPortfolioTracking = (kind: string) => kind === "equity" || kind === "fund";

export function portfolioWrapInput(
  transactions: readonly PortfolioTransaction[],
  securities: readonly WeeklyWrapSecurity[],
  period: WeeklyWrapPeriod,
  ledgerFetchedAt: EpochMs,
  metadataFetchedAt: EpochMs,
): PortfolioInsightInput {
  return {
    week: { start: period.start, endExclusive: period.endExclusive },
    transactions,
    securities: securities.map((security) => ({
      assetID: security.id,
      symbol: security.symbol,
      currencyCode: security.currencyCode ?? "",
      supportsUnitValuation: supportsPortfolioTracking(security.kind),
      issuerID: security.issuerID ?? null,
      issuerName: security.issuer,
      sector: security.issuerSector ?? null,
      allowsFractionalQuantity: security.kind !== "equity",
    })),
    ledgerFetchedAt,
    metadataFetchedAt,
  };
}

/** The Wrap's portfolio chapter, only when every position traces to a verified price fact. */
export function wrapPortfolio(insights: readonly Insight[]): WeeklyWrapPortfolio | null {
  const insight = insights.find((value) => value.type === "portfolioPricePerformance");
  if (!insight || insight.fact.kind !== "portfolioPerformance") return null;
  const fact = insight.fact.value;
  const strongest = fact.positions[0];
  const weakest = fact.positions.at(-1);
  const portfolio = insight.provenance.portfolio;
  if (!strongest || !weakest || !portfolio) return null;
  const evidence = fact.positions.flatMap((position) => {
    const price = insights.find(
      (value) => value.type === "assetPriceChange" && value.relatedAssetIDs.length === 1 && value.relatedAssetIDs[0] === position.assetID,
    );
    if (!price) return [];
    const transactionIDs = portfolio.transactions
      .filter((tx) => tx.securityId === position.assetID && (tradingDateNoon(tx.tradedOn) ?? Infinity) < portfolio.week.start)
      .map((tx) => tx.id)
      .sort(byText);
    return [{ securityID: position.assetID, quantity: position.quantity, priceInsightID: price.id, transactionIDs }];
  });
  if (evidence.length !== fact.positions.length) return null;
  return {
    startValue: fact.startValue,
    endValue: fact.endValue,
    change: fact.change,
    percentage: fact.percentage,
    firstDate: fact.firstObservedAt,
    lastDate: fact.lastObservedAt,
    leadingSymbol: strongest.symbol,
    leadingContribution: strongest.contribution,
    holdingCount: fact.positions.length,
    weakestSymbol: weakest.symbol,
    weakestContribution: weakest.contribution,
    positionEvidence: evidence,
  };
}

const PINNED_CONTRACTS = ["verified_wrap_composition", "wrap_personalization_order", "watchlist_story_eligibility", "financial_story_presentation"];

export function capturedSnapshotMetadata(
  securities: readonly WeeklyWrapSecurity[],
  insights: readonly Insight[],
  watchedAssetIDs: readonly string[] | null,
  snapshotID: string,
): WeeklyWrapSnapshotMetadata {
  const contracts: { id: string; version: number }[] = [];
  for (const insight of insights) {
    const contract = { id: insight.provenance.calculationID, version: insight.provenance.calculationVersion };
    if (!contracts.some((value) => value.id === contract.id && value.version === contract.version)) contracts.push(contract);
  }
  contracts.push(...PINNED_CONTRACTS.map((id) => ({ id, version: 1 })));
  const unique = new Map<string, WeeklyWrapSecurity>();
  for (const security of securities) if (!unique.has(security.id)) unique.set(security.id, security);
  const values = [...unique.values()].sort((a, b) => byText(a.id, b.id));
  return {
    snapshotID,
    edition: 1,
    contracts: contracts.sort((a, b) => byText(a.id, b.id)),
    assets: values.map((value) => ({ id: value.id, symbol: value.symbol, name: value.name, issuer: value.issuer, currencyCode: value.currencyCode })),
    watchedAssetIDs: watchedAssetIDs ? [...watchedAssetIDs] : values.filter((value) => value.isWatched).map((value) => value.id),
    marketUniverseIDs: values.filter((value) => value.kind === "equity").map((value) => value.id),
    correction: null,
    migratedFromLegacyCache: false,
  };
}

/** A verified weekly recap, or null when nothing beyond the opening could be shown. */
export function verifiedWeeklyWrap(request: WeeklyWrapRequest): WeeklyWrap | null {
  const { securities, evidence, transactions, portfolioLoaded, personalisation, period, now } = request;
  if (!(period.start < period.endExclusive)) return null;
  const watched = request.confirmedWatchedIDs ?? new Set(securities.filter((security) => security.isWatched).map((security) => security.id));
  const held = new Set(ledgerPositions(transactions, { asOf: now }).map((position) => position.securityId));
  const evaluation = new InsightEngine({ availability: request.availability }).assess({
    period: evidence.comparisonPeriod,
    generatedAt: now,
    fetchedAt: evidence.fetchedAt,
    calendar: evidence.calendar,
    observations: evidence.observations,
    watchlistIDs: watched,
    portfolioIDs: held,
    activityAssetIDs: personalisation?.relevantAssetIDs ?? [],
    portfolio: portfolioLoaded ? portfolioWrapInput(transactions, securities, period, now, now) : null,
  });
  const insights = evaluation.insights;
  const bySecurity = new Map<string, WeeklyWrapSecurity>();
  for (const security of securities) if (!bySecurity.has(security.id)) bySecurity.set(security.id, security);
  const moves = new Map<string, WeeklyWrapMove>();
  for (const insight of insights) {
    if (insight.fact.kind !== "priceChange") continue;
    const fact = insight.fact.value;
    const security = bySecurity.get(fact.assetID);
    if (!security) continue;
    moves.set(fact.assetID, {
      securityID: fact.assetID,
      symbol: security.symbol,
      currencyCode: fact.currencyCode,
      start: fact.startPrice,
      end: fact.endPrice,
      percentage: fact.percentageChange,
      firstDate: fact.firstObservedAt,
      lastDate: fact.lastObservedAt,
      points: insight.provenance.observations.map((row) => ({ date: row.observedAt, price: row.price })),
    });
  }
  const omissions: WeeklyWrapOmission[] = [];
  const hasFlows = transactions.some((tx) => {
    const start = dayStart(tx.tradedOn);
    return start !== undefined && start >= period.start && start < period.endExclusive;
  });
  const portfolio = wrapPortfolio(insights);
  if (hasFlows) omissions.push("portfolioTransactions");
  else if (transactions.length > 0 && portfolio === null) omissions.push("portfolioDataMissing");
  let stories: WeeklyWrapStory[] = [{ kind: "opening" }];
  if (portfolio) {
    stories.push({ kind: "portfolio", portfolio });
    if (!portfolio.leadingContribution.isZero() || !(portfolio.weakestContribution?.isZero() ?? false))
      stories.push({ kind: "portfolioContributor", portfolio });
  }
  const watchedIDs = [...watched].sort(byText);
  const watchedMoves = watchedIDs.flatMap((id) => moves.get(id) ?? []);
  const qualified = watchlistInsightCandidates(insights, { watchedIDs: watched, consumedKeys: new Set(), now, limit: insights.length });
  const breadth = qualified.find((insight) => insight.type === "watchlistBreadth");
  if (breadth && breadth.fact.kind === "breadth") {
    const fact = breadth.fact.value;
    stories.push({ kind: "watchlist", breadth: { rises: fact.rising, falls: fact.falling, unchanged: fact.unchanged }, total: fact.assetCount });
  }
  if (watched.size > 0 && watchedMoves.length !== watched.size) omissions.push("watchlistDataMissing");
  const highlightedAsset = qualified.flatMap((insight) => (insight.fact.kind === "watchlistMovement" ? [insight.fact.value.movement.assetID] : []))[0];
  const highlight = highlightedAsset === undefined ? null : (moves.get(highlightedAsset) ?? null);
  if (highlight) stories.push({ kind: "watchlistHighlight", move: highlight });
  if (personalisation) {
    const viewed = personalisation.mostViewedAssetID === null ? undefined : bySecurity.get(personalisation.mostViewedAssetID);
    if (personalisation.mostViewedCount >= 4 && personalisation.mostViewedDays >= 2 && viewed) {
      stories.push({ kind: "personalStat", stat: { kind: "mostViewed", symbol: viewed.symbol, views: personalisation.mostViewedCount } });
    } else if (personalisation.uniqueAssetsViewed >= 4)
      stories.push({ kind: "personalStat", stat: { kind: "explorer", assets: personalisation.uniqueAssetsViewed } });
  }
  const marketIDs = securities.filter((security) => security.kind === "equity").map((security) => security.id);
  const marketMoves = marketIDs.flatMap((id) => moves.get(id) ?? []);
  const summary = marketSummary(new Set(marketIDs), evaluation.facts);
  if (summary) {
    stories.push({ kind: "marketBreadth", breadth: { rises: summary.breadth.rising, falls: summary.breadth.falling, unchanged: summary.breadth.unchanged } });
    const rise = summary.strongestRisingAssetID === null ? undefined : moves.get(summary.strongestRisingAssetID);
    if (rise) stories.push({ kind: "marketRise", move: rise });
    const fall = summary.strongestFallingAssetID === null ? undefined : moves.get(summary.strongestFallingAssetID);
    if (fall) stories.push({ kind: "marketFall", move: fall });
  }
  if (marketMoves.length !== marketIDs.length) omissions.push("marketCoveragePartial");
  if (stories.length <= 1) return null;
  stories.push({ kind: "summary" });
  stories = orderWrapStories(
    stories,
    insights,
    interestProfile({ holdingIDs: held, watchedIDs: watched, behavior: personalisation?.interestProfile.behavior ?? new Map() }),
    now,
  );
  return {
    period,
    stories,
    watchedCount: watched.size,
    indexChange: null,
    watchedHighlight: highlight,
    portfolio,
    generatedAt: now,
    verifiedInsights: insights,
    omissions,
    snapshotMetadata:
      period.kind === "weekly" ? capturedSnapshotMetadata(securities, insights, watchedIDs, request.snapshotID ?? globalThis.crypto.randomUUID()) : null,
  };
}
