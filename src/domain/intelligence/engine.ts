import { MarketCalendar } from "../market/calendar";
import { type HistoryAssessment, type PriceObservation, validateHistoricalSeries } from "../market/history-validation";
import { type DataQualityReport, permitsInsight } from "../market/quality";
import { type EpochMs, DAY_MS, MINUTE_MS, startOfDay } from "../market/zone";
import { type IntelligenceDebugRun, IntelligenceDebugCapture } from "./debug";
import { closingExtreme, priceChanges, sessionRun } from "./facts";
import { SIGNIFICANCE, breadth } from "./math";
import {
  type AssetPriceChangeFact,
  type FinancialFact,
  type Insight,
  type InsightPeriod,
  type InsightType,
  type PortfolioInsightInput,
  type WatchlistBreadthFact,
  type WatchlistPublication,
  type WatchlistPublicationEvidence,
  type WatchlistPublicationInput,
  WATCHLIST_SIGNIFICANCE,
  isValidPeriod,
  periodContains,
} from "./models";
import { recordIntelligenceMetric } from "./observability";
import { type PortfolioMeasurement, calculatePortfolioFacts } from "./portfolio-facts";
import { validatePortfolioInput } from "./portfolio-validation";
import { sha256Hex } from "./sha256";

/*
 * iOS `InsightEngine`, `InsightGenerationContext.insight(...)`, the generators (`AssetPriceChangeGenerator`,
 * `WatchlistBreadthGenerator`, `PortfolioInsightGenerator`, `WatchlistInsightGenerator`,
 * `WatchlistPublicationGenerator`, `MarketPublicationGenerator`) and `InsightStore`.
 */

export type InsightRequirement = "finalizedPriceHistory" | "verifiedMarketCalendar" | "watchlistMembership" | "portfolioLedger" | "publishedInformation";

export interface InsightFreshnessPolicy {
  readonly maximumFetchAgeMs: number;
  readonly maximumPeriodAgeMs: number;
}

export const DEFAULT_FRESHNESS: InsightFreshnessPolicy = { maximumFetchAgeMs: 15 * MINUTE_MS, maximumPeriodAgeMs: 7 * DAY_MS };

export interface InsightInput {
  readonly period: InsightPeriod;
  readonly generatedAt: EpochMs;
  readonly fetchedAt: EpochMs;
  readonly calendar: MarketCalendar | null;
  readonly observations: readonly PriceObservation[];
  readonly watchlistIDs: ReadonlySet<string>;
  readonly portfolioIDs: ReadonlySet<string>;
  readonly activityAssetIDs: readonly string[];
  readonly freshness?: InsightFreshnessPolicy;
  readonly portfolio?: PortfolioInsightInput | null;
  readonly publications?: WatchlistPublicationInput | null;
}

const freshnessOf = (input: InsightInput) => input.freshness ?? DEFAULT_FRESHNESS;
const finitePositive = (value: number) => Number.isFinite(value) && value > 0;

export function freshnessAccepts(policy: InsightFreshnessPolicy, input: InsightInput): boolean {
  const now = input.generatedAt;
  return (
    finitePositive(policy.maximumFetchAgeMs) &&
    finitePositive(policy.maximumPeriodAgeMs) &&
    Number.isFinite(now) &&
    Number.isFinite(input.fetchedAt) &&
    isValidPeriod(input.period) &&
    input.period.start <= now &&
    input.fetchedAt <= now &&
    now - input.fetchedAt < policy.maximumFetchAgeMs &&
    now - input.period.endExclusive < policy.maximumPeriodAgeMs
  );
}

/** The feature gates the engine consults (structurally the feature-control availability). */
export interface InsightAvailability {
  allows(
    feature:
      "insight_engine" | "price_changes" | "watchlist_breadth" | "portfolio_allocation" | "portfolio_performance" | "watchlist_patterns" | "publications",
  ): boolean;
  permits(type: InsightType): boolean;
}

export const ALL_INSIGHTS_AVAILABLE: InsightAvailability = { allows: () => true, permits: () => true };

/** One validated calculation pass is shared by all generators in this evaluation. */
export interface InsightGenerationContext {
  readonly input: InsightInput;
  readonly priceChanges: ReadonlyMap<string, AssetPriceChangeFact>;
  readonly evidence: ReadonlyMap<string, readonly PriceObservation[]>;
  readonly verifiedSeries: ReadonlyMap<string, readonly PriceObservation[]>;
  readonly hasWeeklyReference: boolean;
  readonly debugRun: IntelligenceDebugRun | null;
}

export type GeneratorName =
  | "AssetPriceChangeGenerator"
  | "WatchlistBreadthGenerator"
  | "PortfolioInsightGenerator"
  | "WatchlistInsightGenerator"
  | "WatchlistPublicationGenerator"
  | "MarketPublicationGenerator";

export interface InsightGenerator {
  readonly name: GeneratorName;
  readonly requirements: ReadonlySet<InsightRequirement>;
  generate(context: InsightGenerationContext): Insight[];
}

// MARK: - Identity and envelope

/** `Double.bitPattern` of the seconds since 1970, as Swift prints it. */
function bitPattern(instant: EpochMs): string {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, instant / 1000);
  return view.getBigUint64(0).toString();
}

const utf8Length = (text: string) => new TextEncoder().encode(text).length;
const sortIDs = (ids: Iterable<string>) => [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
/** Swift's `Date.distantPast`. */
const DISTANT_PAST = -62_135_769_600_000;

/** The stable semantic identity: SHA-256 over length-prefixed parts, so opaque ids cannot collide by delimiter. */
export function insightIdentity(type: InsightType, period: InsightPeriod, assetIDs: readonly string[], semanticKey?: string): string {
  const calculationVersion = 1;
  const identity = [
    type,
    String(calculationVersion),
    ...(semanticKey === undefined ? [bitPattern(period.start), bitPattern(period.endExclusive), ...sortIDs(assetIDs)] : [semanticKey]),
  ];
  return sha256Hex(identity.map((part) => `${utf8Length(part)}:${part}`).join(""));
}

interface InsightOptions {
  readonly publication?: WatchlistPublicationEvidence;
  readonly period?: InsightPeriod;
  readonly semanticKey?: string;
}

export function makeInsight(
  context: InsightGenerationContext,
  type: InsightType,
  fact: FinancialFact,
  assetIDs: readonly string[],
  options: InsightOptions = {},
): Insight {
  const { input, evidence } = context;
  const freshness = freshnessOf(input);
  const sortedIDs = sortIDs(assetIDs);
  const calculationVersion = 1;
  const period = options.period ?? input.period;
  const publication = options.publication;
  const isWatchlist = type.startsWith("watchlist");
  const isPortfolio = type === "portfolioPricePerformance" || type === "portfolioAllocation";
  const calendarUntil = input.calendar?.validUntil ?? DISTANT_PAST;
  const portfolioExpiry =
    isPortfolio && input.portfolio ? Math.min(input.portfolio.ledgerFetchedAt, input.portfolio.metadataFetchedAt) + freshness.maximumFetchAgeMs : null;
  const expiresAt = publication
    ? Math.min(publication.fetchedAt + freshness.maximumFetchAgeMs, publication.publication.publishedAt + WATCHLIST_SIGNIFICANCE.publicationAgeMs)
    : Math.min(
        input.fetchedAt + freshness.maximumFetchAgeMs,
        input.period.endExclusive + freshness.maximumPeriodAgeMs,
        Math.min(calendarUntil, portfolioExpiry ?? calendarUntil),
      );
  const rank = input.activityAssetIDs.findIndex((id) => sortedIDs.includes(id));
  const portfolio = input.portfolio;
  return {
    id: insightIdentity(type, period, sortedIDs, options.semanticKey),
    type,
    category: isPortfolio ? "portfolio" : isWatchlist ? "watchlist" : "market",
    fact,
    generatedAt: input.generatedAt,
    period,
    expiresAt,
    relatedAssetIDs: sortedIDs,
    relevance: {
      isHeld: sortedIDs.some((id) => input.portfolioIDs.has(id)),
      isWatched: sortedIDs.some((id) => input.watchlistIDs.has(id)),
      activityRank: rank < 0 ? null : rank,
    },
    destination: publication
      ? { kind: "information", articleID: publication.publication.articleID }
      : isPortfolio
        ? { kind: "portfolio" }
        : isWatchlist
          ? { kind: "watchlist" }
          : { kind: "asset", assetID: sortedIDs[0] },
    provenance: {
      calculationID: type,
      calculationVersion,
      calendarVersion: publication ? "not-applicable" : (input.calendar?.version ?? "unavailable"),
      observations: publication ? [] : sortedIDs.flatMap((id) => evidence.get(id) ?? []),
      fetchedAt: publication?.fetchedAt ?? input.fetchedAt,
      completeness: publication ? "verifiedPublicationLinks" : "completeExpectedSessions",
      portfolio:
        isPortfolio && portfolio
          ? {
              week: portfolio.week,
              transactions: [...portfolio.transactions].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
              securities: [...portfolio.securities].sort((a, b) => (a.assetID < b.assetID ? -1 : a.assetID > b.assetID ? 1 : 0)),
              ledgerFetchedAt: portfolio.ledgerFetchedAt,
              metadataFetchedAt: portfolio.metadataFetchedAt,
            }
          : null,
      publication: publication ?? null,
    },
  };
}

function weeklyReferenceIsValid(input: InsightInput, sessions: HistoryAssessment["sessions"]): boolean {
  const calendar = input.calendar;
  if (!calendar) return false;
  const week = MarketCalendar.week(input.period.endExclusive - DAY_MS);
  if (!week || !calendar.isTradingWeek({ start: week.start, endExclusive: input.period.endExclusive }, input.generatedAt)) return false;
  if (!(input.period.start < week.start)) return false;
  const baseline = calendar.previousTradingDay(week.start, input.generatedAt);
  if (baseline === undefined || input.period.start !== baseline) return false;
  const first = sessions[0];
  return first !== undefined && startOfDay(first.closesAt) === baseline;
}

function makeContext(input: InsightInput, quality: HistoryAssessment, debugRun: IntelligenceDebugRun | null): InsightGenerationContext {
  return {
    input,
    priceChanges: priceChanges(quality),
    evidence: quality.verified,
    verifiedSeries: quality.verified,
    hasWeeklyReference: permitsInsight(quality.period) && weeklyReferenceIsValid(input, quality.sessions),
    debugRun,
  };
}

// MARK: - Generators

const requirements = (...values: InsightRequirement[]): ReadonlySet<InsightRequirement> => new Set(values);

export const assetPriceChangeGenerator: InsightGenerator = {
  name: "AssetPriceChangeGenerator",
  requirements: requirements("finalizedPriceHistory", "verifiedMarketCalendar"),
  generate: (context) =>
    [...context.priceChanges.values()].map((fact) => makeInsight(context, "assetPriceChange", { kind: "priceChange", value: fact }, [fact.assetID])),
};

export const watchlistBreadthGenerator: InsightGenerator = {
  name: "WatchlistBreadthGenerator",
  requirements: requirements("finalizedPriceHistory", "verifiedMarketCalendar", "watchlistMembership"),
  generate(context) {
    const ids = [...context.input.watchlistIDs];
    if (ids.length === 0 || !ids.every((id) => context.priceChanges.has(id))) {
      context.debugRun?.note("watchlistBreadth", "REJECTED", ids.length === 0 ? "empty-watchlist" : "incomplete-watchlist-series");
      return [];
    }
    const counts = breadth(ids.map((id) => context.priceChanges.get(id)!));
    const fact: WatchlistBreadthFact = {
      ...counts,
      significantAssetIDs: context.hasWeeklyReference
        ? sortIDs(ids.filter((id) => context.priceChanges.get(id)!.percentageChange.abs().greaterThanOrEqualTo(SIGNIFICANCE.noteworthyMovement)))
        : [],
    };
    return [makeInsight(context, "watchlistBreadth", { kind: "breadth", value: fact }, ids)];
  },
};

export function portfolioInsightGenerator(
  enabledTypes: ReadonlySet<InsightType> = new Set(["portfolioAllocation", "portfolioPricePerformance"]),
): InsightGenerator {
  return {
    name: "PortfolioInsightGenerator",
    requirements: requirements("finalizedPriceHistory", "verifiedMarketCalendar", "portfolioLedger"),
    generate(context) {
      const input = context.input.portfolio;
      if (!input) return [];
      const enabled = new Set<PortfolioMeasurement>([
        ...(enabledTypes.has("portfolioAllocation") ? (["allocation"] as const) : []),
        ...(enabledTypes.has("portfolioPricePerformance") ? (["performance"] as const) : []),
      ]);
      const facts = calculatePortfolioFacts(input, context.priceChanges, {
        comparisonPeriod: context.input.period,
        calendar: context.input.calendar,
        asOf: context.input.generatedAt,
        maximumAgeMs: freshnessOf(context.input).maximumFetchAgeMs,
        enabled,
        debugRun: context.debugRun,
      });
      if (!facts) {
        context.debugRun?.note("portfolio-facts", "REJECTED", "portfolio-calculation-unavailable");
        return [];
      }
      const insights: Insight[] = [];
      if (enabledTypes.has("portfolioAllocation") && facts.allocation) {
        insights.push(
          makeInsight(
            context,
            "portfolioAllocation",
            { kind: "portfolioAllocation", value: facts.allocation },
            facts.allocation.positions.map((position) => position.assetID),
          ),
        );
      } else context.debugRun?.note("portfolioAllocation", "REJECTED", "allocation-unavailable");
      if (enabledTypes.has("portfolioPricePerformance") && facts.performance) {
        insights.push(
          makeInsight(
            context,
            "portfolioPricePerformance",
            { kind: "portfolioPerformance", value: facts.performance },
            facts.performance.positions.map((position) => position.assetID),
          ),
        );
      } else context.debugRun?.note("portfolioPricePerformance", "REJECTED", "performance-unavailable");
      return insights;
    },
  };
}

export const watchlistInsightGenerator: InsightGenerator = {
  name: "WatchlistInsightGenerator",
  requirements: requirements("finalizedPriceHistory", "verifiedMarketCalendar", "watchlistMembership"),
  generate(context) {
    const ids = sortIDs(context.input.watchlistIDs);
    const run = context.debugRun;
    if (ids.length === 0) {
      run?.note("WatchlistInsightGenerator", "REJECTED", "empty-watchlist");
      return [];
    }
    const result: Insight[] = [];
    const minimum = SIGNIFICANCE.noteworthyMovement;
    const complete = ids.every((id) => context.priceChanges.has(id));
    const strongest =
      context.hasWeeklyReference && complete
        ? ids
            .map((id) => context.priceChanges.get(id)!)
            .sort((a, b) => b.percentageChange.abs().comparedTo(a.percentageChange.abs()) || (a.assetID < b.assetID ? -1 : a.assetID > b.assetID ? 1 : 0))[0]
        : undefined;
    if (strongest) {
      if (strongest.percentageChange.abs().greaterThanOrEqualTo(minimum)) {
        result.push(makeInsight(context, "watchlistMovement", { kind: "watchlistMovement", value: { movement: strongest, comparedAssetIDs: ids } }, ids));
      } else {
        run?.note("watchlistMovement", "REJECTED", "below-movement-threshold", {
          id: strongest.assetID,
          metric: strongest.percentageChange.abs(),
          threshold: minimum,
        });
      }
    } else {
      run?.note("watchlistMovement", "REJECTED", context.hasWeeklyReference ? "incomplete-watchlist-series" : "no-completed-weekly-reference");
    }
    for (const id of ids) {
      const series = context.verifiedSeries.get(id);
      if (!series) {
        run?.note("watchlist-series", "REJECTED", "unverified-price-series", { id });
        continue;
      }
      const runFact = sessionRun(series);
      if (runFact) {
        if (runFact.sessions >= WATCHLIST_SIGNIFICANCE.minimumRun && runFact.percentage.abs().greaterThanOrEqualTo(minimum)) {
          result.push(makeInsight(context, "watchlistSessionRun", { kind: "watchlistSessionRun", value: runFact }, [id]));
        } else {
          run?.note(
            "watchlistSessionRun",
            "REJECTED",
            runFact.sessions < WATCHLIST_SIGNIFICANCE.minimumRun ? "insufficient-run-sessions" : "below-movement-threshold",
            {
              id,
              metric: runFact.percentage.abs(),
              threshold: minimum,
            },
          );
        }
      } else run?.note("watchlistSessionRun", "REJECTED", "no-directional-run", { id });
      const extreme = closingExtreme(series);
      if (extreme) {
        if (
          extreme.observationCount >= WATCHLIST_SIGNIFICANCE.minimumExtremeObservations &&
          extreme.percentageBeyondPrevious.abs().greaterThanOrEqualTo(minimum)
        ) {
          result.push(makeInsight(context, "watchlistClosingExtreme", { kind: "watchlistClosingExtreme", value: extreme }, [id]));
        } else {
          run?.note(
            "watchlistClosingExtreme",
            "REJECTED",
            extreme.observationCount < WATCHLIST_SIGNIFICANCE.minimumExtremeObservations ? "insufficient-extreme-observations" : "below-movement-threshold",
            { id, metric: extreme.percentageBeyondPrevious.abs(), threshold: minimum },
          );
        }
      } else run?.note("watchlistClosingExtreme", "REJECTED", "no-closing-extreme", { id });
    }
    return result;
  },
};

const UUID_TEXT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An https link with a host and no credentials, as Foundation's `URL` reports it. */
function isSafeSourceURL(value: string): boolean {
  if (!value.startsWith("https:")) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname !== "" && url.username === "" && url.password === "" && !/^https:\/\/[^/?#]*@/.test(value);
  } catch {
    return false;
  }
}

function validPublication(article: WatchlistPublication, input: WatchlistPublicationInput, generatedAt: EpochMs): boolean {
  return (
    UUID_TEXT.test(article.articleID) &&
    article.title.trim() !== "" &&
    article.sourceName.trim() !== "" &&
    isSafeSourceURL(article.primarySourceURL) &&
    Number.isFinite(article.publishedAt) &&
    article.publishedAt >= generatedAt - WATCHLIST_SIGNIFICANCE.publicationAgeMs &&
    article.publishedAt <= generatedAt &&
    periodContains(input.period, article.publishedAt) &&
    article.publishedAt <= input.fetchedAt
  );
}

/** Both surfaces share the same publication validation and payload. */
export function publicationInsights(context: InsightGenerationContext, watchlistOnly: boolean): Insight[] {
  const input = context.input.publications;
  const generatedAt = context.input.generatedAt;
  if (
    !input ||
    !isValidPeriod(input.period) ||
    !Number.isFinite(input.fetchedAt) ||
    !(input.fetchedAt <= generatedAt) ||
    !(generatedAt - input.fetchedAt < freshnessOf(context.input).maximumFetchAgeMs)
  ) {
    context.debugRun?.note("publication-input", "REJECTED", "invalid-or-stale-publication-input");
    return [];
  }
  const groups = new Map<string, WatchlistPublication[]>();
  for (const article of input.articles) {
    const key = article.articleID.toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), article]);
  }
  const result: Insight[] = [];
  for (const copies of groups.values()) {
    const article = copies[0];
    if (copies.length !== 1 || !validPublication(article, input, generatedAt)) {
      context.debugRun?.note("publication", "REJECTED", "invalid-publication-evidence");
      continue;
    }
    const linked = new Set(article.assetIDs);
    const related = sortIDs(watchlistOnly ? [...linked].filter((id) => context.input.watchlistIDs.has(id)) : linked);
    if (watchlistOnly && related.length === 0) {
      context.debugRun?.note("publication", "REJECTED", "no-watchlist-publication-link", { id: article.articleID });
      continue;
    }
    result.push(
      makeInsight(context, watchlistOnly ? "watchlistInformation" : "marketInformation", { kind: "watchlistInformation", value: article }, related, {
        publication: { publication: article, fetchedAt: input.fetchedAt },
        period: input.period,
        semanticKey: article.articleID.toLowerCase(),
      }),
    );
  }
  return result;
}

export const watchlistPublicationGenerator: InsightGenerator = {
  name: "WatchlistPublicationGenerator",
  requirements: requirements("watchlistMembership", "publishedInformation"),
  generate: (context) => publicationInsights(context, true),
};

/** Explicit editorial links personalise news; unlinked public news remains market information. */
export const marketPublicationGenerator: InsightGenerator = {
  name: "MarketPublicationGenerator",
  requirements: requirements("publishedInformation"),
  generate: (context) => publicationInsights(context, false),
};

// MARK: - Engine

export interface InsightEvaluation {
  readonly insights: readonly Insight[];
  readonly facts: ReadonlyMap<string, AssetPriceChangeFact>;
  readonly historyQuality: HistoryAssessment;
  readonly portfolioQuality: DataQualityReport | null;
}

export interface InsightEngineOptions {
  readonly generators?: readonly InsightGenerator[];
  readonly includesMarketPublications?: boolean;
  /** The feature-control availability at `generatedAt`; all features when omitted. */
  readonly availability?: InsightAvailability;
}

const DEFAULT_GENERATORS: readonly InsightGenerator[] = [
  assetPriceChangeGenerator,
  watchlistBreadthGenerator,
  portfolioInsightGenerator(),
  watchlistInsightGenerator,
  watchlistPublicationGenerator,
];

function isEnabled(generator: InsightGenerator, availability: InsightAvailability): boolean {
  switch (generator.name) {
    case "AssetPriceChangeGenerator":
      return availability.allows("price_changes");
    case "WatchlistBreadthGenerator":
      return availability.allows("watchlist_breadth");
    case "PortfolioInsightGenerator":
      return availability.allows("portfolio_allocation") || availability.allows("portfolio_performance");
    case "WatchlistInsightGenerator":
      return availability.allows("watchlist_patterns");
    case "WatchlistPublicationGenerator":
    case "MarketPublicationGenerator":
      return availability.allows("publications");
  }
}

const historyInput = (input: InsightInput) => {
  const freshness = freshnessOf(input);
  return {
    period: input.period,
    generatedAt: input.generatedAt,
    fetchedAt: input.fetchedAt,
    calendar: input.calendar ?? undefined,
    observations: input.observations,
    watchlistIDs: [...input.watchlistIDs],
    portfolioIDs: [...input.portfolioIDs],
    freshness: { maximumFetchAgeMs: freshness.maximumFetchAgeMs, maximumPeriodAgeMs: freshness.maximumPeriodAgeMs },
  };
};

export class InsightEngine {
  readonly generators: readonly InsightGenerator[];
  private readonly availability: InsightAvailability | undefined;

  constructor(options: InsightEngineOptions = {}) {
    this.generators = [...(options.generators ?? DEFAULT_GENERATORS), ...(options.includesMarketPublications ? [marketPublicationGenerator] : [])];
    this.availability = options.availability;
  }

  evaluate(input: InsightInput): readonly Insight[] {
    return this.assess(input).insights;
  }

  assess(input: InsightInput): InsightEvaluation {
    const availability = this.availability ?? ALL_INSIGHTS_AVAILABLE;
    const freshness = freshnessOf(input);
    const quality = validateHistoricalSeries(historyInput(input));
    const assetReports = [...quality.assets.values()];
    recordIntelligenceMetric("validationAssets", "rejected", {
      count: assetReports.filter((report) => !permitsInsight(report)).length,
      total: assetReports.length,
    });
    recordIntelligenceMetric("validationAssets", "stale", {
      count: assetReports.filter((report) => report.status === "stale").length,
      total: assetReports.length,
    });
    const portfolioQuality = input.portfolio ? validatePortfolioInput(input.portfolio, input.generatedAt, freshness.maximumFetchAgeMs) : null;
    const trace = IntelligenceDebugCapture.shared.begin("generation", "verified-generation", input.generatedAt);
    try {
      const periodPasses = permitsInsight(quality.period);
      trace?.append({
        stage: periodPasses ? "OBSERVED" : "REJECTED",
        subject: "period-validation",
        reason: periodPasses ? "validation-passed" : "validation-failed",
        validation: quality.period,
        period: input.period,
      });
      for (const id of sortIDs(quality.assets.keys())) {
        const report = quality.assets.get(id)!;
        if (!permitsInsight(report)) {
          trace?.append({
            stage: "REJECTED",
            subject: "asset-validation",
            reason: "validation-failed",
            token: trace.token(id),
            validation: report,
            period: input.period,
          });
        }
      }
      if (portfolioQuality) {
        const passes = permitsInsight(portfolioQuality);
        trace?.append({
          stage: passes ? "OBSERVED" : "REJECTED",
          subject: "portfolio-validation",
          reason: passes ? "validation-passed" : "validation-failed",
          validation: portfolioQuality,
          period: input.period,
        });
      }
      if (!Number.isFinite(input.generatedAt) || !finitePositive(freshness.maximumFetchAgeMs) || !finitePositive(freshness.maximumPeriodAgeMs)) {
        recordIntelligenceMetric("generatorAdmission", "rejected", { count: this.generators.length, total: this.generators.length });
        recordIntelligenceMetric("insights", "insufficientData", { count: 0, total: 0 });
        return { insights: [], facts: new Map(), historyQuality: quality, portfolioQuality };
      }
      const context = makeContext(input, quality, trace);
      const available = new Set<InsightRequirement>(["watchlistMembership"]);
      if (periodPasses) available.add("verifiedMarketCalendar");
      if (context.priceChanges.size > 0) available.add("finalizedPriceHistory");
      if (periodPasses && portfolioQuality !== null && permitsInsight(portfolioQuality)) available.add("portfolioLedger");
      if (input.publications) available.add("publishedInformation");
      const byID = new Map<string, Insight>();
      let rejectedGenerators = 0;
      for (const registered of this.generators) {
        if (!availability.allows("insight_engine") || !isEnabled(registered, availability)) {
          rejectedGenerators += 1;
          trace?.note("generator", "REJECTED", "feature-disabled");
          continue;
        }
        const generator =
          registered.name === "PortfolioInsightGenerator"
            ? portfolioInsightGenerator(new Set((["portfolioAllocation", "portfolioPricePerformance"] as const).filter((type) => availability.permits(type))))
            : registered;
        const required = [...generator.requirements].sort();
        const missing = required.filter((requirement) => !available.has(requirement));
        if (missing.length > 0) {
          rejectedGenerators += 1;
          trace?.append({
            stage: "REJECTED",
            subject: "generator",
            reason: "missing-required-data",
            generator: generator.name,
            requiredData: required,
            missingData: missing,
            period: input.period,
          });
          continue;
        }
        const generated = generator.generate(context).filter((insight) => availability.permits(insight.type));
        if (generated.length === 0) {
          trace?.append({
            stage: "REJECTED",
            subject: "generator",
            reason: "generator-produced-no-candidates",
            generator: generator.name,
            requiredData: required,
            period: input.period,
          });
        }
        for (const insight of generated) {
          trace?.generated(insight, generator.name, generator.requirements);
          if (!(insight.expiresAt > input.generatedAt)) {
            trace?.note(insight.type, "SUPPRESSED", "expired-at-generation", { id: insight.id });
            continue;
          }
          // Repeated registrations must not duplicate a semantic fact across surfaces.
          if (!byID.has(insight.id)) byID.set(insight.id, insight);
          else trace?.note(insight.type, "SUPPRESSED", "duplicate-insight", { id: insight.id });
        }
      }
      recordIntelligenceMetric("generatorAdmission", "rejected", { count: rejectedGenerators, total: this.generators.length });
      if (byID.size === 0) recordIntelligenceMetric("insights", "insufficientData", { count: 0, total: 0 });
      const all = [...byID.values()];
      for (const type of new Set(all.map((insight) => insight.type))) {
        recordIntelligenceMetric("insights", "succeeded", {
          count: all.filter((insight) => insight.type === type).length,
          total: byID.size,
          insightType: type,
        });
      }
      return {
        insights: all.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
        facts: context.priceChanges,
        historyQuality: quality,
        portfolioQuality,
      };
    } finally {
      trace?.finish();
    }
  }
}

/** One instance per account session: a coordinator refreshes, surfaces read the same result set. */
export class InsightStore {
  private insights: readonly Insight[] = [];

  constructor(
    private readonly engine: InsightEngine = new InsightEngine(),
    private readonly availability: InsightAvailability = ALL_INSIGHTS_AVAILABLE,
  ) {}

  /** Replacement also removes facts that ceased to pass validation after a source correction. */
  refresh(input: InsightInput): void {
    this.insights = this.engine.evaluate(input);
  }

  current(asOf: EpochMs): readonly Insight[] {
    if (!Number.isFinite(asOf)) return [];
    return this.insights.filter((insight) => this.availability.permits(insight.type) && insight.generatedAt <= asOf && asOf < insight.expiresAt);
  }

  /** The owner must clear the store on sign-out or account deletion. */
  clear(): void {
    this.insights = [];
  }
}
