import type Decimal from "decimal.js";

import { MarketCalendar, type MarketState } from "../market/calendar";
import { DAY_MS, type EpochMs, weekday } from "../market/zone";
import { type IntelligenceAvailability, allows as featureAllows, permitsInsightType } from "./feature-controls";
import type { Insight } from "./models";
import { allows } from "./privacy";
import { type WeeklyWrap, type WeeklyWrapPeriod, breadthCount, isVisibleOnHome, wrapPeriodKey } from "./weekly-wrap";

/*
 * The Home context slot (iOS `HomeContextResolver.swift`): pure priority rules over verified candidates. It never
 * calculates returns. Copy is chosen by the caller from `content`; offers arrive with their text already composed.
 */

export type HomeContextOfferKind = "discovery" | "weekAhead";

/** A provider submits an offer only after its destination and evidence exist. */
export interface HomeContextOffer {
  readonly kind: HomeContextOfferKind;
  readonly headline: string;
  readonly detail: string;
  readonly destinationID: string;
  readonly evidenceIDs: readonly string[];
  readonly availableAt: EpochMs;
  readonly expiresAt: EpochMs;
  readonly exposureKeys?: readonly string[];
  readonly isConsumed: boolean;
}

export function isOfferEligible(offer: HomeContextOffer, now: EpochMs): boolean {
  return (
    offer.headline !== "" &&
    offer.detail !== "" &&
    offer.destinationID !== "" &&
    offer.evidenceIDs.length > 0 &&
    offer.evidenceIDs.every((id) => id.trim() !== "") &&
    Number.isFinite(offer.availableAt) &&
    Number.isFinite(offer.expiresAt) &&
    !offer.isConsumed &&
    offer.availableAt <= now &&
    now < offer.expiresAt
  );
}

export type HomeContextDestination =
  | { readonly kind: "weeklyWrap"; readonly period: WeeklyWrapPeriod }
  | { readonly kind: "discovery"; readonly id: string }
  | { readonly kind: "weekAhead"; readonly id: string }
  | { readonly kind: "watchlist" };

/** What the card says, as data. Message keys mirror iOS: `intelligence.weekSummary.*`, `intelligence.watchlistMover.*`, … */
export type HomeContextContent =
  | { readonly kind: "portfolioWrap"; readonly period: WeeklyWrapPeriod; readonly percentage: Decimal }
  | { readonly kind: "watchlistMoverWrap"; readonly period: WeeklyWrapPeriod; readonly symbol: string; readonly percentage: Decimal }
  | { readonly kind: "weeklyClose"; readonly period: WeeklyWrapPeriod; readonly rises: number; readonly count: number }
  | { readonly kind: "watchlist"; readonly insight: Insight }
  | { readonly kind: "discovery"; readonly headline: string; readonly detail: string }
  | { readonly kind: "weekAhead"; readonly headline: string; readonly detail: string };

export interface HomeContextFeature {
  readonly content: HomeContextContent;
  readonly destination: HomeContextDestination;
  readonly expiresAt: EpochMs;
  readonly exposureKeys: readonly string[];
}

export const featureWrapPeriodKey = (feature: HomeContextFeature) =>
  feature.destination.kind === "weeklyWrap" ? wrapPeriodKey(feature.destination.period) : null;

export interface HomeContextInput {
  readonly now: EpochMs;
  readonly marketState: MarketState;
  readonly calendarValidUntil: EpochMs;
  readonly wrapPeriods: readonly WeeklyWrapPeriod[];
  readonly wrap: WeeklyWrap | null;
  readonly completedWrapKeys: ReadonlySet<string>;
  readonly hidesPersonalValues: boolean;
  readonly isOffline: boolean;
  readonly discovery?: HomeContextOffer | null;
  readonly weekAhead?: HomeContextOffer | null;
  readonly calendar?: MarketCalendar | null;
  readonly watchlistInsights?: readonly Insight[];
}

export interface HomeContextDependencies {
  readonly availability: IntelligenceAvailability;
  /**
   * iOS `WatchlistInsightPolicy.candidates(…, limit: 1, surface: .home).first` over the already filtered insights,
   * with the watched ids and consumed keys the caller holds. Without it the Saturday watchlist fallback is skipped.
   */
  readonly watchlistCandidate?: (insights: readonly Insight[]) => Insight | null;
  /** iOS `InsightPersonalization.receiptKeys(for:)`: exposure receipts a shown card writes. */
  readonly receiptKeys?: (insight: Insight) => readonly string[];
}

const PERIOD_STATES: readonly MarketState[] = ["postClose", "weekend", "holiday", "closed"];
const SUNDAY = 1;
const SATURDAY = 7;

/** The weekly release Home may show now: last week's or this week's, released and with its last session closed. */
export function periodToLoad(
  state: MarketState,
  now: EpochMs,
  periods: readonly WeeklyWrapPeriod[],
  calendar?: MarketCalendar | null,
): WeeklyWrapPeriod | null {
  const week = MarketCalendar.week(now);
  if (!Number.isFinite(now) || !PERIOD_STATES.includes(state) || !week) return null;
  const previousStart = week.start - 7 * DAY_MS;
  const eligible = periods.filter((period) => {
    if (period.kind !== "weekly" || period.start < previousStart || period.start > week.start || !isVisibleOnHome(period, now)) return false;
    if (calendar) {
      const interval = { start: period.start, endExclusive: period.endExclusive };
      if (!calendar.isTradingWeek(interval, now)) return false;
      const sessions = calendar.sessions(interval, now);
      const last = sessions?.at(-1);
      if (!last || last.closesAt > now) return false;
    }
    return true;
  });
  return eligible.reduce<WeeklyWrapPeriod | null>((latest, period) => (!latest || period.start > latest.start ? period : latest), null);
}

export function resolveHomeContext(raw: HomeContextInput, dependencies: HomeContextDependencies): HomeContextFeature | null {
  const { availability } = dependencies;
  const insights = featureAllows(availability, "personalized_home")
    ? (raw.watchlistInsights ?? []).filter((insight) => permitsInsightType(availability, insight.type))
    : [];
  const input: HomeContextInput = {
    ...raw,
    wrap: featureAllows(availability, "weekly_wrap") ? raw.wrap : null,
    discovery: featureAllows(availability, "saturday_discover") ? raw.discovery : null,
    weekAhead: featureAllows(availability, "week_ahead") ? raw.weekAhead : null,
    watchlistInsights: insights,
  };
  if (input.isOffline || !Number.isFinite(input.now) || !Number.isFinite(input.calendarValidUntil) || !(input.now < input.calendarValidUntil)) return null;
  const wrap = wrapFeature(input, dependencies, false);
  if (wrap) return wrap;
  const day = weekday(input.now);
  const weekendDay = day === SUNDAY || day === SATURDAY;
  const discovery = () => offerFeature(input.discovery, "discovery", input.now, input.calendarValidUntil);
  switch (input.marketState) {
    case "postClose":
      return wrapFeature(input, dependencies, false);
    case "holiday":
    case "closed":
      if (!weekendDay) return wrapFeature(input, dependencies, false);
      if (day === SUNDAY) return offerFeature(input.weekAhead, "weekAhead", input.now, input.calendarValidUntil);
      return null;
    case "weekend": {
      if (day === SUNDAY) return offerFeature(input.weekAhead, "weekAhead", input.now, input.calendarValidUntil);
      if (day !== SATURDAY) return null;
      const offer = discovery();
      if (offer) return offer;
      const personal = wrapFeature(input, dependencies, true);
      if (personal) return personal;
      const policy = { surface: "inApp", privacyEnabled: input.hidesPersonalValues } as const;
      const insight = allows(policy, "personalContext") ? (dependencies.watchlistCandidate?.(insights) ?? null) : null;
      if (insight) {
        return {
          content: { kind: "watchlist", insight },
          destination: { kind: "watchlist" },
          expiresAt: Math.min(input.calendarValidUntil, insight.expiresAt),
          exposureKeys: [...(dependencies.receiptKeys?.(insight) ?? [])],
        };
      }
      return discovery();
    }
    case "open":
    case "preMarket":
    case "unknown":
      return null;
  }
}

function wrapFeature(input: HomeContextInput, dependencies: HomeContextDependencies, requiresPersonalFact: boolean): HomeContextFeature | null {
  const period = periodToLoad(input.marketState, input.now, input.wrapPeriods, input.calendar);
  const wrap = input.wrap;
  const generatedAt = wrap?.generatedAt;
  if (
    !period ||
    !wrap ||
    wrapPeriodKey(wrap.period) !== wrapPeriodKey(period) ||
    wrap.period.start !== period.start ||
    wrap.period.endExclusive !== period.endExclusive ||
    generatedAt == null ||
    !Number.isFinite(generatedAt) ||
    generatedAt > input.now ||
    wrap.verifiedInsights == null ||
    wrap.stories.length <= 2
  ) {
    return null;
  }
  const expiresAt = Math.min(period.expiresAt ?? input.calendarValidUntil, input.calendarValidUntil);
  const destination: HomeContextDestination = { kind: "weeklyWrap", period };
  const receipts = (type: Insight["type"]) => [
    ...new Set((wrap.verifiedInsights ?? []).filter((insight) => insight.type === type).flatMap((insight) => dependencies.receiptKeys?.(insight) ?? [])),
  ];
  const policy = { surface: "inApp", privacyEnabled: input.hidesPersonalValues } as const;
  const portfolio = wrap.portfolio;
  if (allows(policy, "privateFinancial") && portfolio && portfolio.positionEvidence != null && !portfolio.percentage.isNaN()) {
    return {
      content: { kind: "portfolioWrap", period, percentage: portfolio.percentage },
      destination,
      expiresAt,
      exposureKeys: receipts("portfolioPricePerformance"),
    };
  }
  const highlight = wrap.watchedHighlight;
  if (
    allows(policy, "personalContext") &&
    highlight &&
    wrap.watchedCount > 0 &&
    !highlight.percentage.isNaN() &&
    wrap.stories.some((story) => story.kind === "watchlistHighlight")
  ) {
    return {
      content: { kind: "watchlistMoverWrap", period, symbol: highlight.symbol, percentage: highlight.percentage },
      destination,
      expiresAt,
      exposureKeys: receipts("watchlistMovement"),
    };
  }
  if (requiresPersonalFact) return null;
  const breadth = wrap.stories.find((story) => story.kind === "marketBreadth");
  if (breadth?.kind !== "marketBreadth" || breadthCount(breadth.breadth) <= 0) return null;
  return {
    content: { kind: "weeklyClose", period, rises: breadth.breadth.rises, count: breadthCount(breadth.breadth) },
    destination,
    expiresAt,
    exposureKeys: [],
  };
}

function offerFeature(offer: HomeContextOffer | null | undefined, kind: HomeContextOfferKind, now: EpochMs, expiresAt: EpochMs): HomeContextFeature | null {
  if (!offer || offer.kind !== kind || !isOfferEligible(offer, now)) return null;
  return {
    content: { kind, headline: offer.headline, detail: offer.detail },
    destination: kind === "discovery" ? { kind: "discovery", id: offer.destinationID } : { kind: "weekAhead", id: offer.destinationID },
    expiresAt: Math.min(offer.expiresAt, expiresAt),
    exposureKeys: [...(offer.exposureKeys ?? [])],
  };
}
