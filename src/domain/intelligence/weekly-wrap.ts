import type Decimal from "decimal.js";

import { MarketCalendar } from "../market/calendar";
import { DAY_MS, type EpochMs, civilDate } from "../market/zone";
import type { Insight } from "./models";
import { type IntelligencePrivacyClassification, allows, privacyClassification } from "./privacy";

/*
 * The Weekly Wrap shapes the Home context slot and privacy rules need (iOS `Features/WeeklyWrap/Data/WeeklyWrap.swift`).
 * W15 assembles wraps from `get_weekly_wrap_evidence`; nothing here computes one.
 */

export type WeeklyWrapKind = "weekly" | "monthly" | "yearly";

export interface WeeklyWrapPeriod {
  readonly kind: WeeklyWrapKind;
  readonly start: EpochMs;
  readonly endExclusive: EpochMs;
  /** Server-scheduled release; absent means the period never appears on Home. */
  readonly availableAt: EpochMs | null;
  readonly expiresAt: EpochMs | null;
}

export const wrapPeriod = (
  start: EpochMs,
  endExclusive: EpochMs,
  availableAt: EpochMs | null = null,
  expiresAt: EpochMs | null = null,
  kind: WeeklyWrapKind = "weekly",
): WeeklyWrapPeriod => ({
  kind,
  start,
  endExclusive,
  availableAt,
  expiresAt,
});

/** `weekly-YYYY-MM-DD`, the Luanda civil date of the start. */
export const wrapPeriodKey = (period: WeeklyWrapPeriod) => `${period.kind}-${civilDate(period.start)}`;

export const lastCalendarDay = (period: WeeklyWrapPeriod): EpochMs => period.endExclusive - DAY_MS;

/** Only server-scheduled releases appear on Home; a weekly one leaves at the end of its own week. Cached stories never extend the window. */
export function isVisibleOnHome(period: WeeklyWrapPeriod, now: EpochMs): boolean {
  const { availableAt, expiresAt } = period;
  if (availableAt === null || expiresAt === null) return false;
  const homeExpiry = period.kind === "weekly" ? Math.min(expiresAt, MarketCalendar.week(period.start)?.endExclusive ?? expiresAt) : expiresAt;
  return now >= availableAt && now < homeExpiry;
}

export interface WeeklyWrapPricePoint {
  readonly date: EpochMs;
  readonly price: Decimal;
}

export interface WeeklyWrapMove {
  readonly securityID: string;
  readonly symbol: string;
  readonly currencyCode: string;
  readonly start: Decimal;
  readonly end: Decimal;
  readonly percentage: Decimal;
  readonly firstDate: EpochMs;
  readonly lastDate: EpochMs;
  readonly points: readonly WeeklyWrapPricePoint[];
}

export interface WeeklyWrapBreadth {
  readonly rises: number;
  readonly falls: number;
  readonly unchanged: number;
}

export const breadthCount = (breadth: WeeklyWrapBreadth) => breadth.rises + breadth.falls + breadth.unchanged;

export interface WeeklyWrapPositionEvidence {
  readonly securityID: string;
  readonly quantity: Decimal;
  readonly priceInsightID: string;
  readonly transactionIDs: readonly string[];
}

export interface WeeklyWrapPortfolio {
  readonly startValue: Decimal;
  readonly endValue: Decimal;
  readonly change: Decimal;
  readonly percentage: Decimal;
  readonly firstDate: EpochMs;
  readonly lastDate: EpochMs;
  readonly leadingSymbol: string;
  readonly leadingContribution: Decimal;
  readonly holdingCount: number;
  readonly weakestSymbol?: string | null;
  readonly weakestContribution?: Decimal | null;
  readonly positionEvidence?: readonly WeeklyWrapPositionEvidence[] | null;
}

export type WeeklyWrapPersonalStat =
  { readonly kind: "mostViewed"; readonly symbol: string; readonly views: number } | { readonly kind: "explorer"; readonly assets: number };

export type WeeklyWrapStory =
  | { readonly kind: "opening" }
  | { readonly kind: "marketIndex"; readonly move: WeeklyWrapMove }
  | { readonly kind: "marketBreadth"; readonly breadth: WeeklyWrapBreadth }
  | { readonly kind: "marketRise"; readonly move: WeeklyWrapMove }
  | { readonly kind: "marketFall"; readonly move: WeeklyWrapMove }
  | { readonly kind: "watchlist"; readonly breadth: WeeklyWrapBreadth; readonly total: number }
  | { readonly kind: "watchlistHighlight"; readonly move: WeeklyWrapMove }
  | { readonly kind: "portfolio"; readonly portfolio: WeeklyWrapPortfolio }
  | { readonly kind: "portfolioContributor"; readonly portfolio: WeeklyWrapPortfolio }
  | { readonly kind: "personalStat"; readonly stat: WeeklyWrapPersonalStat }
  | { readonly kind: "summary" };

export type WeeklyWrapOmission = "portfolioTransactions" | "portfolioDataMissing" | "watchlistDataMissing" | "marketCoveragePartial";

export interface WeeklyWrap {
  readonly period: WeeklyWrapPeriod;
  readonly stories: readonly WeeklyWrapStory[];
  readonly watchedCount: number;
  readonly indexChange: Decimal | null;
  readonly watchedHighlight: WeeklyWrapMove | null;
  readonly portfolio: WeeklyWrapPortfolio | null;
  readonly generatedAt?: EpochMs | null;
  readonly verifiedInsights?: readonly Insight[] | null;
  readonly omissions?: readonly WeeklyWrapOmission[] | null;
}

export function storyPrivacyClassification(story: WeeklyWrapStory): IntelligencePrivacyClassification {
  switch (story.kind) {
    case "portfolio":
    case "portfolioContributor":
      return "privateFinancial";
    case "watchlist":
    case "watchlistHighlight":
    case "personalStat":
      return "personalContext";
    case "opening":
    case "marketIndex":
    case "marketBreadth":
    case "marketRise":
    case "marketFall":
    case "summary":
      return "publicMarket";
  }
}

/** What playback shows. Archived stories are never mutated; privacy mode only filters the presentation. */
export function presentationStories(wrap: WeeklyWrap, privacyEnabled: boolean): WeeklyWrapStory[] {
  const policy = { surface: "inApp", privacyEnabled } as const;
  return wrap.stories.filter((story) => allows(policy, storyPrivacyClassification(story)));
}

export function presentationInsights(wrap: WeeklyWrap, privacyEnabled: boolean): Insight[] {
  const policy = { surface: "inApp", privacyEnabled } as const;
  return (wrap.verifiedInsights ?? []).filter((insight) => allows(policy, privacyClassification(insight)));
}
