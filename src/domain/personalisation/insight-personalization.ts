import { Dec, SIGNIFICANCE, interpret } from "../intelligence/math";
import { type Insight, type InsightPeriod, WATCHLIST_SIGNIFICANCE, type WatchlistPublication, isValidPeriod } from "../intelligence/models";
import { allows, privacyClassification } from "../intelligence/privacy";
import type { MarketState } from "../market/calendar";
import { type EpochMs, civilDate } from "../market/zone";
import { personalizationAvailability } from "./availability";
import { DISTANT_PAST } from "./storage";
import { type ContentExposureSnapshot, type PersonalizationCandidate, exposureSnapshot } from "./candidate";
import type { PersonalizationSurface } from "./configuration";
import { evaluatePersonalization } from "./engine";
import { doubleBitPattern, foldedWords, normalizedSourceURL, sha256Hex, swiftSeconds } from "./keys";
import { type UserInterestProfile, interestProfile, utf8Length } from "./profile";

/*
 * iOS `InsightPersonalization` and `WatchlistInsightPolicy`: adapts verified facts into attention metadata; never
 * recalculates financial values.
 */

/** iOS `InsightFreshnessPolicy.maximumFetchAge`: 15 minutes. */
export const MAXIMUM_FETCH_AGE_MS = 15 * 60_000;

export interface InsightPersonalizationContext {
  readonly now: EpochMs;
  readonly heldIDs: ReadonlySet<string>;
  readonly watchedIDs: ReadonlySet<string>;
  readonly availableAssetIDs: ReadonlySet<string>;
  readonly hidesPersonalValues?: boolean;
  readonly maximumObservationAge?: number;
}

const intersects = (a: ReadonlySet<string>, b: ReadonlySet<string>) => [...a].some((value) => b.has(value));
const isSubset = (a: ReadonlySet<string>, b: ReadonlySet<string>) => [...a].every((value) => b.has(value));
const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size === b.size && isSubset(a, b);
const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const periodText = (period: InsightPeriod) => `${swiftSeconds(period.start)}:${swiftSeconds(period.endExclusive)}`;

export function isPublication(insight: Insight): boolean {
  return insight.fact.kind === "watchlistInformation";
}

export function focalAssets(insight: Insight): Set<string> {
  switch (insight.fact.kind) {
    case "watchlistMovement":
      return new Set([insight.fact.value.movement.assetID]);
    case "portfolioPerformance":
    case "portfolioAllocation":
      return new Set(insight.fact.value.positions.slice(0, 1).map((p) => p.assetID));
    case "breadth":
      return new Set();
    default:
      return new Set(insight.relatedAssetIDs);
  }
}

export function observedAt(insight: Insight): EpochMs {
  switch (insight.fact.kind) {
    case "watchlistInformation":
      return insight.fact.value.publishedAt;
    case "portfolioPerformance":
      return insight.fact.value.lastObservedAt;
    case "portfolioAllocation":
      return insight.fact.value.observedAt;
    default: {
      const dates = insight.provenance.observations.map((o) => o.observedAt);
      // `Date.distantPast`.
      return dates.length ? Math.max(...dates) : DISTANT_PAST;
    }
  }
}

export function topicKeys(insight: Insight): Set<string> {
  const topic = insight.fact.kind === "portfolioAllocation" ? "allocation" : insight.fact.kind === "watchlistInformation" ? "publication" : "price";
  const period = periodText(insight.period);
  return new Set([...focalAssets(insight)].map((id) => `topic:${topic}:${utf8Length(id)}:${id}:${period}`));
}

/** Price families share an asset and closing-observation receipt, including after source corrections. */
export function receiptKeys(insight: Insight): Set<string> {
  const { fact } = insight;
  let asset: string;
  let close: EpochMs;
  switch (fact.kind) {
    case "priceChange":
      asset = fact.value.assetID;
      close = fact.value.lastObservedAt;
      break;
    case "watchlistMovement":
      asset = fact.value.movement.assetID;
      close = fact.value.movement.lastObservedAt;
      break;
    case "watchlistSessionRun":
    case "watchlistClosingExtreme":
      asset = fact.value.assetID;
      close = fact.value.lastObservedAt;
      break;
    case "watchlistInformation": {
      const publication = fact.value;
      const source = sha256Hex(normalizedSourceURL(publication.primarySourceURL));
      const day = Number.isFinite(publication.publishedAt) ? civilDate(publication.publishedAt) : "";
      const event = `${day}:${[...insight.relatedAssetIDs].sort(byString).join(",")}:${foldedWords(publication.title)}`;
      return new Set([`article:${publication.articleID.toLowerCase()}`, `article-source:${source}`, `publication-event:${sha256Hex(event)}`]);
    }
    case "portfolioPerformance":
    case "portfolioAllocation":
      return new Set([`insight:${insight.id}`, `portfolio:${insight.type}:${periodText(insight.period)}`]);
    default:
      return new Set([`insight:${insight.id}`]);
  }
  return new Set([`insight:${insight.id}`, `price:${utf8Length(asset)}:${asset}:${doubleBitPattern(close / 1000)}`]);
}

function movement(insight: Insight) {
  const value = interpret(insight.fact).movementPercentage;
  return value === null || value.isNaN() ? new Dec(0) : value.abs();
}

function financialEvidence(insight: Insight): boolean {
  const evidence = insight.provenance;
  return (
    evidence.completeness === "completeExpectedSessions" &&
    evidence.observations.length > 0 &&
    evidence.observations.every((o) => o.isFinal && o.recordID !== "" && o.source.dataset !== "")
  );
}

export function eligible(insight: Insight, context: InsightPersonalizationContext, surface: PersonalizationSurface = "saturdayDiscover"): boolean {
  const { now } = context;
  const evidence = insight.provenance;
  const observed = observedAt(insight);
  const maximumAge = context.maximumObservationAge ?? WATCHLIST_SIGNIFICANCE.publicationAgeMs;
  if (
    insight.id === "" ||
    !isValidPeriod(insight.period) ||
    ![insight.generatedAt, insight.expiresAt, evidence.fetchedAt, observed].every(Number.isFinite) ||
    !(insight.generatedAt <= now) ||
    !(evidence.fetchedAt <= now) ||
    !(now < insight.expiresAt) ||
    !(now - evidence.fetchedAt < MAXIMUM_FETCH_AGE_MS) ||
    !Number.isFinite(maximumAge) ||
    !(maximumAge > 0) ||
    !(observed <= now) ||
    !(now - observed < maximumAge) ||
    evidence.calculationID === "" ||
    !(evidence.calculationVersion > 0) ||
    evidence.calendarVersion === ""
  )
    return false;
  const assets = new Set(insight.relatedAssetIDs);
  if (!isSubset(assets, context.availableAssetIDs)) return false;
  if (insight.category === "portfolio" && !intersects(assets, context.heldIDs)) return false;
  if (insight.category === "watchlist" && !isSubset(assets, context.watchedIDs)) return false;
  const policy = { surface: "inApp", privacyEnabled: context.hidesPersonalValues ?? false } as const;
  if (!allows(policy, privacyClassification(insight))) return false;
  if (!allows(policy, "personalContext") && intersects(assets, new Set([...context.heldIDs, ...context.watchedIDs]))) return false;
  if (!isPublication(insight) && !financialEvidence(insight)) return false;
  const fullView = surface === "portfolio" || surface === "weeklyWrap";
  const noteworthy = SIGNIFICANCE.noteworthyMovement;
  const { fact } = insight;
  switch (fact.kind) {
    case "watchlistInformation": {
      const publication = evidence.publication?.publication;
      return evidence.completeness === "verifiedPublicationLinks" && publication !== undefined && samePublication(publication, fact.value);
    }
    case "portfolioPerformance":
      return Boolean(evidence.portfolio) && !fact.value.percentage.isNaN() && (fullView || fact.value.percentage.abs().greaterThanOrEqualTo(noteworthy));
    case "portfolioAllocation": {
      const first = fact.value.positions[0];
      return (
        Boolean(evidence.portfolio) &&
        first !== undefined &&
        !first.percentage.isNaN() &&
        (fullView || first.percentage.greaterThanOrEqualTo(SIGNIFICANCE.concentrationDisclosure))
      );
    }
    case "breadth":
      return sameSet(assets, context.watchedIDs) && fact.value.assetCount >= 2 && (fact.value.significantAssetIDs?.length ?? 0) > 0;
    case "watchlistMovement":
      return sameSet(new Set(fact.value.comparedAssetIDs), context.watchedIDs) && movement(insight).greaterThanOrEqualTo(noteworthy);
    case "watchlistSessionRun":
      return fact.value.sessions >= WATCHLIST_SIGNIFICANCE.minimumRun && movement(insight).greaterThanOrEqualTo(noteworthy);
    case "watchlistClosingExtreme":
      return fact.value.observationCount >= WATCHLIST_SIGNIFICANCE.minimumExtremeObservations && movement(insight).greaterThanOrEqualTo(noteworthy);
    case "priceChange":
      return movement(insight).greaterThanOrEqualTo(noteworthy);
  }
}

function samePublication(a: WatchlistPublication, b: WatchlistPublication): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function insightCandidate(
  insight: Insight,
  context: InsightPersonalizationContext,
  surface: PersonalizationSurface,
  issuerByAsset: ReadonlyMap<string, string> = new Map(),
): PersonalizationCandidate {
  const assets = focalAssets(insight);
  const held = insight.category === "portfolio" || intersects(assets, context.heldIDs);
  const watched = intersects(assets, context.watchedIDs);
  const category = isPublication(insight) ? "news" : held ? "portfolio" : watched ? "watchlist" : "market";
  const permitted = personalizationAvailability(context.now).permits(insight.type);
  return {
    id: insight.id,
    factKeys: receiptKeys(insight),
    topicKeys: topicKeys(insight),
    assets,
    issuers: new Set([...assets].map((id) => issuerByAsset.get(id)).filter((id): id is string => id !== undefined)),
    family: insight.type,
    category,
    observedAt: observedAt(insight),
    expiresAt: insight.expiresAt,
    significance: interpret(insight.fact).significance,
    isMarketWide: insight.category === "market" && insight.relatedAssetIDs.length === 0,
    isMandatory: insight.type === "portfolioPricePerformance" && ["portfolio", "weeklyWrap", "saturdayDiscover"].includes(surface),
    rejection: !permitted ? "feature-disabled" : eligible(insight, context, surface) ? null : "unverified-stale-or-unrelated",
    relationshipAssets: assets.size === 0 ? new Set(insight.relatedAssetIDs) : assets,
  };
}

const insightKey = (insight: Insight) =>
  JSON.stringify(insight, (_, value: unknown) =>
    value instanceof Set ? [...value] : typeof value === "object" && value !== null && "toFixed" in value ? String(value) : value,
  );

export function insightCandidates(
  insights: readonly Insight[],
  context: InsightPersonalizationContext,
  surface: PersonalizationSurface,
  issuerByAsset: ReadonlyMap<string, string> = new Map(),
): PersonalizationCandidate[] {
  const groups = new Map<string, Insight[]>();
  for (const insight of insights) groups.set(insight.id, [...(groups.get(insight.id) ?? []), insight]);
  return [...groups.keys()].sort(byString).map((id) => {
    const copies = groups.get(id)!;
    const result = insightCandidate(copies[0], context, surface, issuerByAsset);
    const first = insightKey(copies[0]);
    return copies.every((copy) => insightKey(copy) === first) ? result : { ...result, rejection: "conflicting-revisions" };
  });
}

export interface RankInsightsOptions {
  readonly surface: PersonalizationSurface;
  readonly profile: UserInterestProfile;
  readonly exposure?: ContentExposureSnapshot;
  readonly availableAssetIDs?: ReadonlySet<string>;
  readonly issuerByAsset?: ReadonlyMap<string, string>;
  readonly hidesPersonalValues?: boolean;
  readonly marketState?: MarketState;
  readonly maximumObservationAge?: number;
  readonly now: EpochMs;
  readonly limit: number;
}

/** Ranks insights for one surface (iOS `InsightPersonalization.ranked`). */
export function rankInsights(insights: readonly Insight[], options: RankInsightsOptions): Insight[] {
  const context: InsightPersonalizationContext = {
    now: options.now,
    heldIDs: options.profile.holdingIDs,
    watchedIDs: options.profile.watchedIDs,
    availableAssetIDs: options.availableAssetIDs ?? new Set(insights.flatMap((i) => i.relatedAssetIDs)),
    hidesPersonalValues: options.hidesPersonalValues ?? false,
    maximumObservationAge: options.maximumObservationAge ?? WATCHLIST_SIGNIFICANCE.publicationAgeMs,
  };
  const result = evaluatePersonalization(
    insightCandidates(insights, context, options.surface, options.issuerByAsset),
    {
      surface: options.surface,
      now: options.now,
      profile: options.profile,
      exposure: options.exposure ?? exposureSnapshot(),
      marketState: options.marketState ?? "unknown",
      hidesPersonalValues: options.hidesPersonalValues ?? false,
    },
    options.limit,
  );
  return selectedInsights(
    insights,
    result.selected.map((d) => d.candidate.id),
  );
}

function selectedInsights(insights: readonly Insight[], ids: readonly string[]): Insight[] {
  const byID = new Map<string, Insight>();
  for (const insight of insights) if (!byID.has(insight.id)) byID.set(insight.id, insight);
  return ids.map((id) => byID.get(id)).filter((i): i is Insight => i !== undefined);
}

export interface WatchlistCandidateOptions {
  readonly watchedIDs: ReadonlySet<string>;
  readonly consumedKeys: ReadonlySet<string>;
  readonly now: EpochMs;
  readonly limit?: number;
  readonly surface?: PersonalizationSurface;
  readonly profile?: UserInterestProfile;
  readonly exposure?: ContentExposureSnapshot;
  readonly maximumObservationAge?: number;
}

/** The watchlist weekly reading (iOS `WatchlistInsightPolicy.candidates`): at most two watchlist insights by default. */
export function watchlistInsightCandidates(insights: readonly Insight[], options: WatchlistCandidateOptions): Insight[] {
  const profile = { ...(options.profile ?? interestProfile()), watchedIDs: options.watchedIDs };
  const exposure = options.exposure ?? exposureSnapshot();
  return rankInsights(
    insights.filter((i) => i.category === "watchlist"),
    {
      surface: options.surface ?? "watchlist",
      profile,
      exposure: { ...exposure, opened: new Set([...exposure.opened, ...options.consumedKeys]) },
      maximumObservationAge: options.maximumObservationAge,
      now: options.now,
      limit: options.limit ?? 2,
    },
  );
}
