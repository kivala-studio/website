import { type InformationSignificance, significanceRank } from "../intelligence/models";

/*
 * iOS `PersonalizationConfiguration`: attention policy, not financial calculations. Values are ordinal relevance points.
 */

export const PERSONALIZATION_SURFACES = [
  "home",
  "portfolio",
  "watchlist",
  "weeklyWrap",
  "saturdayDiscover",
  "weekAhead",
  "activityCenter",
  "notification",
] as const;
export type PersonalizationSurface = (typeof PERSONALIZATION_SURFACES)[number];

export interface PersonalizationConfiguration {
  readonly name: "standard" | "significanceOnly" | "v2" | "custom";
  readonly holdingWeight: number;
  readonly watchlistWeight: number;
  readonly alertWeight: number;
  readonly maximumBehaviorWeight: number;
  readonly behaviorHalfLifeDays: number;
  readonly behaviorRetentionDays: number;
  readonly maximumDailySignalCount: number;
  readonly behaviorWeights: Readonly<Record<string, number>>;
  readonly freshDayWeight: number;
  readonly freshThreeDaysWeight: number;
  readonly olderWeight: number;
  readonly unseenWeight: number;
  readonly seenPenalty: number;
  readonly relatedTopicPenalty: number;
  readonly significantMarketWeight: number;
  readonly perAssetLimit: number;
  readonly perIssuerLimit: number;
  readonly perFamilyLimit: number;
  readonly perCategoryLimit: number;
  readonly explorationSlots: number;
}

export const STANDARD_CONFIGURATION: PersonalizationConfiguration = {
  name: "standard",
  holdingWeight: 80,
  watchlistWeight: 40,
  alertWeight: 20,
  maximumBehaviorWeight: 8,
  behaviorHalfLifeDays: 28,
  behaviorRetentionDays: 112,
  maximumDailySignalCount: 3,
  behaviorWeights: { asset_view: 1, search_select: 1, comparison: 2, chart_range: 0.25 },
  freshDayWeight: 12,
  freshThreeDaysWeight: 8,
  olderWeight: 4,
  unseenWeight: 10,
  seenPenalty: 15,
  relatedTopicPenalty: 8,
  significantMarketWeight: 10,
  perAssetLimit: 2,
  perIssuerLimit: 2,
  perFamilyLimit: 2,
  perCategoryLimit: 2,
  explorationSlots: 1,
};

/** Explicit relationships still establish domain eligibility; only significance affects ordering. */
export const SIGNIFICANCE_ONLY_CONFIGURATION: PersonalizationConfiguration = {
  ...STANDARD_CONFIGURATION,
  name: "significanceOnly",
  holdingWeight: 0,
  watchlistWeight: 0,
  alertWeight: 0,
  maximumBehaviorWeight: 0,
  freshDayWeight: 0,
  freshThreeDaysWeight: 0,
  olderWeight: 0,
  unseenWeight: 0,
  seenPenalty: 0,
  relatedTopicPenalty: 0,
  significantMarketWeight: 0,
};

export const V2_CONFIGURATION: PersonalizationConfiguration = { ...STANDARD_CONFIGURATION, name: "v2", maximumBehaviorWeight: 0 };

/** Swift compares the whole value; the significance-only configuration is recognised by its values. */
export function isSignificanceOnly(configuration: PersonalizationConfiguration): boolean {
  const keys = Object.keys(SIGNIFICANCE_ONLY_CONFIGURATION).filter((key) => key !== "name") as (keyof PersonalizationConfiguration)[];
  return keys.every((key) => JSON.stringify(configuration[key]) === JSON.stringify(SIGNIFICANCE_ONLY_CONFIGURATION[key]));
}

export function minimumSignificance(surface: PersonalizationSurface): InformationSignificance {
  switch (surface) {
    case "portfolio":
    case "weeklyWrap":
    case "weekAhead":
      return "routine";
    case "saturdayDiscover":
    case "watchlist":
    case "activityCenter":
    case "home":
      return "noteworthy";
    case "notification":
      return "material";
  }
}

export function minimumScore(configuration: PersonalizationConfiguration, surface: PersonalizationSurface): number {
  if (isSignificanceOnly(configuration)) return 0;
  return surface === "home" ? 60 : surface === "notification" ? 70 : 0;
}

const FAMILY_TIE_PRIORITY: Readonly<Record<string, number>> = {
  watchlistInformation: 0,
  watchlistMovement: 1,
  watchlistSessionRun: 2,
  watchlistClosingExtreme: 3,
  watchlistBreadth: 4,
};

export function familyTiePriority(family: string, surface: PersonalizationSurface): number {
  if (surface !== "watchlist" && surface !== "weeklyWrap") return 0;
  return FAMILY_TIE_PRIORITY[family] ?? 5;
}

export function significanceWeight(significance: InformationSignificance): number {
  return [0, 10, 20, 30, 100][significanceRank(significance)];
}

export const atLeast = (value: InformationSignificance, minimum: InformationSignificance) => significanceRank(value) >= significanceRank(minimum);
