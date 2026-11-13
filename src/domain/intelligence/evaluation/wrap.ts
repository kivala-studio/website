import { allows, permitsInsightType } from "../feature-controls";
import type { WeeklyWrap, WeeklyWrapMove, WeeklyWrapPortfolio, WeeklyWrapStory } from "../weekly-wrap";
import { verifiedWeeklyWrap } from "../weekly-wrap-service";
import type { WrapMaker } from "./harness";
import { day } from "./scenarios";
import { type Json, date, encodeInsight, encodeValue, enumCase, number } from "./swift-json";

/** iOS harness `makeWrap`: the scenario's evidence through the verified Wrap service, as the archive encodes it. */
export const makeEvaluationWrap: WrapMaker = (scenario, availability) => {
  const { input } = scenario;
  if (!input.calendar) return null;
  const ids = [...new Set(input.observations.map((row) => row.assetID))].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const wrap = verifiedWeeklyWrap({
    securities: ids.map((id) => ({
      id,
      symbol: id,
      name: `Título ${id}`,
      issuer: `Emitente ${id}`,
      kind: "equity",
      isWatched: scenario.profile.watchedIDs.has(id),
      currencyCode: "AOA",
    })),
    evidence: { comparisonPeriod: input.period, calendar: input.calendar, observations: input.observations, fetchedAt: input.fetchedAt },
    transactions: input.portfolio?.transactions ?? [],
    portfolioLoaded: input.portfolio != null,
    personalisation: scenario.activitySnapshot,
    period: { kind: "weekly", start: day(21), endExclusive: day(26), availableAt: null, expiresAt: null },
    now: input.generatedAt,
    availability: { allows: (feature) => allows(availability, feature), permits: (type) => permitsInsightType(availability, type) },
    snapshotID: `evaluation:${scenario.id}`,
  });
  return wrap ? { wrap, json: encodeWrap(wrap) } : null;
};

const encodeMove = (move: WeeklyWrapMove): Json => ({
  currencyCode: move.currencyCode,
  end: number(move.end),
  firstDate: date(move.firstDate),
  lastDate: date(move.lastDate),
  percentage: number(move.percentage),
  points: move.points.map((point) => ({ date: date(point.date), value: number(point.price) })),
  securityID: move.securityID,
  start: number(move.start),
  symbol: move.symbol,
});

const encodePortfolio = (portfolio: WeeklyWrapPortfolio): Json => encodeValue(portfolio)!;

function encodeStory(story: WeeklyWrapStory): Json {
  switch (story.kind) {
    case "opening":
    case "summary":
      return enumCase(story.kind);
    case "portfolio":
    case "portfolioContributor":
      return enumCase(story.kind, encodePortfolio(story.portfolio));
    case "marketBreadth":
      return enumCase(story.kind, encodeValue(story.breadth)!);
    case "watchlist":
      return { watchlist: { _0: encodeValue(story.breadth)!, total: story.total } };
    case "marketIndex":
    case "marketRise":
    case "marketFall":
    case "watchlistHighlight":
      return enumCase(story.kind, encodeMove(story.move));
    case "personalStat":
      return enumCase(
        story.kind,
        story.stat.kind === "mostViewed" ? { mostViewed: { symbol: story.stat.symbol, views: story.stat.views } } : { explorer: { assets: story.stat.assets } },
      );
  }
}

function encodeWrap(wrap: WeeklyWrap): Json {
  const { period } = wrap;
  return {
    ...(wrap.generatedAt == null ? {} : { generatedAt: date(wrap.generatedAt) }),
    ...(wrap.indexChange == null ? {} : { indexChange: number(wrap.indexChange) }),
    ...(wrap.omissions == null ? {} : { omissions: [...wrap.omissions] }),
    period: encodeValue({
      kind: period.kind,
      start: period.start,
      endExclusive: period.endExclusive,
      availableAt: period.availableAt,
      expiresAt: period.expiresAt,
    })!,
    ...(wrap.portfolio ? { portfolio: encodePortfolio(wrap.portfolio) } : {}),
    ...(wrap.snapshotMetadata ? { snapshotMetadata: encodeValue(wrap.snapshotMetadata)! } : {}),
    stories: wrap.stories.map(encodeStory),
    ...(wrap.verifiedInsights == null ? {} : { verifiedInsights: wrap.verifiedInsights.map(encodeInsight) }),
    watchedCount: wrap.watchedCount,
    ...(wrap.watchedHighlight ? { watchedHighlight: encodeMove(wrap.watchedHighlight) } : {}),
  };
}
