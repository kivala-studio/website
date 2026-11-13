import type { Insight } from "../intelligence/models";
import type { MarketState } from "../market/calendar";
import { type EpochMs, weekday } from "../market/zone";
import { type ContentExposureSnapshot, exposureSnapshot } from "./candidate";
import { type PersonalizationScore, evaluatePersonalization } from "./engine";
import { focalAssets, insightCandidates, observedAt } from "./insight-personalization";
import { type UserInterestProfile, interestProfile, utf8Length } from "./profile";

/*
 * iOS `SaturdayDiscoverRanking`: the Saturday Discover adapter. Scoring, thresholds and diversity belong to the engine.
 */

export interface SaturdayDiscoverContext {
  readonly now: EpochMs;
  readonly marketState: MarketState;
  readonly calendarValidUntil: EpochMs;
  readonly heldIDs?: ReadonlySet<string>;
  readonly watchedIDs?: ReadonlySet<string>;
  readonly availableAssetIDs?: ReadonlySet<string>;
  readonly consumedKeys?: ReadonlySet<string>;
  readonly hidesPersonalValues?: boolean;
  readonly profile?: UserInterestProfile | null;
  readonly exposure?: ContentExposureSnapshot;
  readonly issuerByAsset?: ReadonlyMap<string, string>;
}

export interface DiscoverSelection {
  readonly id: string;
  readonly insight: Insight;
  readonly score: PersonalizationScore;
  readonly category: string;
  readonly focalAssets: ReadonlySet<string>;
}

/** A verified closed Saturday in Luanda, before the calendar evidence expires. */
export function isDiscoverSaturday(context: SaturdayDiscoverContext): boolean {
  return (
    Number.isFinite(context.now) &&
    Number.isFinite(context.calendarValidUntil) &&
    context.now < context.calendarValidUntil &&
    ["weekend", "closed", "holiday"].includes(context.marketState) &&
    weekday(context.now) === 7
  );
}

/** At most `limit` (≤ 5) insights for Saturday Discover. */
export function selectDiscover(insights: readonly Insight[], context: SaturdayDiscoverContext, limit = 5): DiscoverSelection[] {
  if (!isDiscoverSaturday(context)) return [];
  const heldIDs = context.heldIDs ?? new Set<string>();
  const watchedIDs = context.watchedIDs ?? new Set<string>();
  const hides = context.hidesPersonalValues ?? false;
  const profile = { ...(context.profile ?? interestProfile()), holdingIDs: heldIDs, watchedIDs };
  const base = context.exposure ?? exposureSnapshot();
  const exposure = { ...base, opened: new Set([...base.opened, ...(context.consumedKeys ?? [])]) };
  const candidates = insightCandidates(
    insights,
    { now: context.now, heldIDs, watchedIDs, availableAssetIDs: context.availableAssetIDs ?? new Set(), hidesPersonalValues: hides },
    "saturdayDiscover",
    context.issuerByAsset,
  );
  const evaluation = evaluatePersonalization(
    candidates,
    { surface: "saturdayDiscover", now: context.now, profile, exposure, marketState: context.marketState, hidesPersonalValues: hides },
    limit,
  );
  const byID = new Map<string, Insight>();
  for (const insight of insights) if (!byID.has(insight.id)) byID.set(insight.id, insight);
  return evaluation.selected.flatMap((decision) => {
    const insight = byID.get(decision.candidate.id);
    return insight && decision.score
      ? [{ id: insight.id, insight, score: decision.score, category: decision.candidate.category, focalAssets: decision.candidate.assets }]
      : [];
  });
}

export function discoverFamily(insight: Insight): string {
  return `${insight.type}:${[...focalAssets(insight)]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((id) => `${utf8Length(id)}:${id}`)
    .join("")}`;
}

export const discoverObservedAt = observedAt;
