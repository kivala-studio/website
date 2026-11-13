import { describe, expect, it } from "vitest";

import type { MarketState } from "../market/calendar";
import { INTELLIGENCE_FEATURES, type IntelligenceFeature, resolveAvailability } from "./feature-controls";
import { type HomeContextInput, type HomeContextOffer, periodToLoad, resolveHomeContext } from "./home-context";
import { Dec } from "./math";
import type { Insight } from "./models";
import { type WeeklyWrap, type WeeklyWrapMove, type WeeklyWrapPortfolio, type WeeklyWrapStory, wrapPeriod, wrapPeriodKey } from "./weekly-wrap";

/* Port of Tests/MarketDiscoveryTests/HomeContextResolverTests.swift (and the Home fallback case of
 * IntelligenceFeatureControlTests). Copy assertions become assertions on the structured content. */

/** Luanda wall time (UTC+1). */
const day = (year: number, month: number, date: number, hour = 0, minute = 0) => Date.UTC(year, month - 1, date, hour - 1, minute);

function availability(now: number, killed: IntelligenceFeature[] = []) {
  const rule = (feature: IntelligenceFeature) => ({
    enabled: true,
    killSwitch: killed.includes(feature),
    rolloutPercentage: 100,
    rolloutSalt: "fixture",
    audiences: ["production" as const],
  });
  const configuration = {
    schemaVersion: 1,
    version: 1,
    minimumAppBuild: 0,
    effectiveAt: now - 1000,
    expiresAt: now + 3_600_000,
    features: Object.fromEntries(INTELLIGENCE_FEATURES.map((feature) => [feature, rule(feature)])),
  };
  return resolveAvailability({ configuration, identity: "fixture", audience: "production", appBuild: 10, now });
}

const resolve = (input: HomeContextInput, killed: IntelligenceFeature[] = []) => resolveHomeContext(input, { availability: availability(input.now, killed) });

const period = wrapPeriod(day(2026, 9, 21), day(2026, 9, 26), day(2026, 9, 25, 15, 45), day(2026, 9, 28));

function input(
  now: number,
  marketState: MarketState,
  wrap: WeeklyWrap | null,
  options: Partial<
    Pick<HomeContextInput, "wrapPeriods" | "completedWrapKeys" | "hidesPersonalValues" | "isOffline" | "calendarValidUntil" | "discovery" | "weekAhead">
  > = {},
): HomeContextInput {
  return {
    now,
    marketState,
    calendarValidUntil: options.calendarValidUntil ?? now + 120_000,
    wrapPeriods: options.wrapPeriods ?? [period],
    wrap,
    completedWrapKeys: options.completedWrapKeys ?? new Set(),
    hidesPersonalValues: options.hidesPersonalValues ?? false,
    isOffline: options.isOffline ?? false,
    discovery: options.discovery ?? null,
    weekAhead: options.weekAhead ?? null,
  };
}

function weeklyWrap(portfolio: boolean, watched: boolean, market: boolean): WeeklyWrap {
  const position: WeeklyWrapPortfolio = {
    startValue: new Dec(100),
    endValue: new Dec("102.4"),
    change: new Dec("2.4"),
    percentage: new Dec("2.4"),
    firstDate: day(2026, 9, 18),
    lastDate: day(2026, 9, 25, 15, 30),
    leadingSymbol: "SOTA",
    leadingContribution: new Dec("2.4"),
    holdingCount: 1,
    positionEvidence: [{ securityID: "asset-1", quantity: new Dec(1), priceInsightID: "price-1", transactionIDs: ["transaction-1"] }],
  };
  const move: WeeklyWrapMove = {
    securityID: "asset-1",
    symbol: "SOTA",
    currencyCode: "AOA",
    start: new Dec(100),
    end: new Dec("102.4"),
    percentage: new Dec("2.4"),
    firstDate: day(2026, 9, 18),
    lastDate: day(2026, 9, 25, 15, 30),
    points: [],
  };
  const stories: WeeklyWrapStory[] = [{ kind: "opening" }];
  if (portfolio) stories.push({ kind: "portfolio", portfolio: position });
  if (watched) stories.push({ kind: "watchlistHighlight", move });
  if (market) stories.push({ kind: "marketBreadth", breadth: { rises: 2, falls: 1, unchanged: 0 } });
  stories.push({ kind: "summary" });
  return {
    period,
    stories,
    watchedCount: watched ? 1 : 0,
    indexChange: null,
    watchedHighlight: watched ? move : null,
    portfolio: portfolio ? position : null,
    generatedAt: day(2026, 9, 25, 15, 50),
    verifiedInsights: [],
    omissions: [],
  };
}

const offer = (kind: HomeContextOffer["kind"], now: number, overrides: Partial<HomeContextOffer> = {}): HomeContextOffer => ({
  kind,
  headline: "Uma mudança relevante",
  detail: "Com evidência verificável.",
  destinationID: kind === "discovery" ? "future-discovery" : "future-week-ahead",
  evidenceIDs: ["insight-1"],
  availableAt: now - 60_000,
  expiresAt: now + 600_000,
  isConsumed: false,
  ...overrides,
});

describe("Home context resolver", () => {
  it("keeps the market first while it is open and in other closed states", () => {
    const friday = day(2026, 9, 25, 16);
    const wrap = weeklyWrap(true, true, true);
    expect(resolve(input(friday, "open", wrap))).toBeNull();
    expect(resolve(input(friday, "preMarket", wrap))).toBeNull();
    expect(resolve(input(friday, "holiday", wrap))).not.toBeNull();
    expect(resolve(input(friday, "closed", wrap))).not.toBeNull();
    expect(resolve(input(day(2026, 9, 28, 16), "postClose", wrap))).toBeNull();
  });

  it("keeps a released wrap after Friday's close, also once completed", () => {
    const friday = day(2026, 9, 25, 16);
    const wrap = weeklyWrap(true, true, true);
    expect(periodToLoad("postClose", friday, [period]) && wrapPeriodKey(periodToLoad("postClose", friday, [period])!)).toBe(wrapPeriodKey(period));
    const feature = resolve(input(friday, "postClose", wrap));
    expect(feature?.destination).toEqual({ kind: "weeklyWrap", period });
    expect(feature?.content.kind === "portfolioWrap" && feature.content.percentage.toString()).toBe("2.4");
    expect(resolve(input(friday, "postClose", null))).toBeNull();
    expect(resolve(input(friday, "postClose", wrap, { wrapPeriods: [] }))).toBeNull();
    expect(resolve(input(friday, "postClose", wrap, { completedWrapKeys: new Set([wrapPeriodKey(period)]) }))).not.toBeNull();
    const oldRelease = wrapPeriod(day(2026, 9, 14), day(2026, 9, 19), day(2026, 9, 25, 15, 45), day(2026, 9, 28));
    expect(periodToLoad("postClose", friday, [oldRelease])).toBeNull();
    expect(resolve(input(friday, "postClose", weeklyWrap(false, false, true)))?.content.kind).toBe("weeklyClose");
  });

  it("keeps the wrap ahead of Discover on Saturday", () => {
    const saturday = day(2026, 9, 26, 11);
    const discovery = offer("discovery", saturday);
    expect(resolve(input(saturday, "weekend", weeklyWrap(true, true, true), { discovery }))?.destination).toEqual({ kind: "weeklyWrap", period });
    const watched = resolve(input(saturday, "weekend", weeklyWrap(false, true, true)));
    expect(watched?.content.kind === "watchlistMoverWrap" && watched.content.symbol).toBe("SOTA");
    expect(resolve(input(saturday, "weekend", weeklyWrap(false, false, true), { discovery }))?.destination).toEqual({ kind: "weeklyWrap", period });
    expect(resolve(input(saturday, "weekend", weeklyWrap(false, false, true)))).not.toBeNull();
  });

  it("keeps the wrap on Sunday with the week ahead as fallback", () => {
    const sunday = day(2026, 9, 27, 11);
    expect(resolve(input(sunday, "weekend", weeklyWrap(true, true, true)))).not.toBeNull();
    const weekAhead = offer("weekAhead", sunday, { headline: "Agenda confirmada", detail: "Evento com fonte.", evidenceIDs: ["event-1"] });
    expect(resolve(input(sunday, "weekend", null, { weekAhead }))?.destination).toEqual({ kind: "weekAhead", id: "future-week-ahead" });
  });

  it("fails closed for stale and offline inputs", () => {
    const saturday = day(2026, 9, 26, 11);
    const wrap = weeklyWrap(true, true, true);
    expect(resolve(input(saturday, "weekend", wrap, { isOffline: true }))).toBeNull();
    expect(resolve(input(saturday, "weekend", wrap, { calendarValidUntil: saturday }))).toBeNull();
    expect(resolve(input(saturday, "unknown", wrap))).toBeNull();
    const staleOffer = offer("discovery", saturday, {
      headline: "Expired",
      detail: "Old insight",
      destinationID: "old",
      availableAt: saturday - 600_000,
      expiresAt: saturday,
    });
    expect(resolve(input(saturday, "weekend", weeklyWrap(false, false, true), { discovery: staleOffer }))).not.toBeNull();
  });

  it("hides the personal headline in privacy mode", () => {
    const saturday = day(2026, 9, 26, 11);
    expect(resolve(input(saturday, "weekend", weeklyWrap(true, true, true), { hidesPersonalValues: true }))).not.toBeNull();
    const friday = day(2026, 9, 25, 16);
    expect(resolve(input(friday, "postClose", weeklyWrap(true, true, true), { hidesPersonalValues: true }))?.content.kind).toBe("weeklyClose");
  });

  it("shows the wrap through Sunday and ends at Luanda midnight", () => {
    const wrap = weeklyWrap(false, false, true);
    expect(resolve(input(day(2026, 9, 27, 23, 59), "weekend", wrap, { completedWrapKeys: new Set([wrapPeriodKey(period)]) }))?.destination).toEqual({
      kind: "weeklyWrap",
      period,
    });
    expect(resolve(input(day(2026, 9, 28), "closed", wrap))).toBeNull();
  });

  it("falls back to a watchlist reading on Saturday, never in privacy mode", () => {
    const saturday = day(2026, 9, 26, 11);
    const insight = { id: "watch-1", type: "watchlistMovement", expiresAt: saturday + 60_000 } as unknown as Insight;
    const dependencies = {
      availability: availability(saturday),
      watchlistCandidate: (insights: readonly Insight[]) => insights[0] ?? null,
      receiptKeys: () => ["fact:watch-1"],
    };
    const base = { ...input(saturday, "weekend", null), watchlistInsights: [insight] };
    const feature = resolveHomeContext(base, dependencies);
    expect(feature?.destination).toEqual({ kind: "watchlist" });
    expect(feature?.expiresAt).toBe(saturday + 60_000);
    expect(feature?.exposureKeys).toEqual(["fact:watch-1"]);
    expect(resolveHomeContext({ ...base, hidesPersonalValues: true }, dependencies)).toBeNull();
    expect(resolveHomeContext(base, { ...dependencies, availability: availability(saturday, ["personalization_engine"]) })).toBeNull();
  });

  it("removes a disabled week-ahead offer", () => {
    const sunday = Date.parse("2026-09-27T12:00:00Z");
    const weekAhead = offer("weekAhead", sunday, {
      headline: "Fixture",
      detail: "Fixture",
      destinationID: "fixture",
      evidenceIDs: ["evidence"],
      availableAt: sunday - 10_000,
      expiresAt: sunday + 3_600_000,
    });
    const value = { ...input(sunday, "weekend", null, { weekAhead }), calendarValidUntil: sunday + 3_600_000 };
    expect(resolve(value)).not.toBeNull();
    expect(resolve(value, ["week_ahead"])).toBeNull();
  });
});
