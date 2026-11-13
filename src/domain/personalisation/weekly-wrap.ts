import type { Insight } from "../intelligence/models";
import type { EpochMs } from "../market/zone";
import { rankInsights } from "./insight-personalization";
import type { UserInterestProfile } from "./profile";

/*
 * iOS `WeeklyWrapPersonalization`. Only the slice of a Wrap story this ordering reads is named here; the Wrap itself
 * (W15) passes its own story values through unchanged.
 */

export type WeeklyWrapStoryKind =
  | "opening"
  | "marketIndex"
  | "marketBreadth"
  | "marketRise"
  | "marketFall"
  | "watchlist"
  | "watchlistHighlight"
  | "portfolio"
  | "portfolioContributor"
  | "personalStat"
  | "summary";

export interface WeeklyWrapStoryRef {
  readonly kind: WeeklyWrapStoryKind;
  /** Present on moves (`marketIndex`, `marketRise`, `marketFall`, `watchlistHighlight`). */
  readonly move?: { readonly securityID: string; readonly lastDate: EpochMs };
}

export function wrapStoryFacts(story: WeeklyWrapStoryRef, insights: readonly Insight[]): Insight[] {
  switch (story.kind) {
    case "portfolio":
    case "portfolioContributor":
      return insights.filter((i) => i.type === "portfolioPricePerformance");
    case "watchlist":
      return insights.filter((i) => i.type === "watchlistBreadth");
    case "watchlistHighlight":
    case "marketRise":
    case "marketFall":
    case "marketIndex": {
      const move = story.move;
      if (!move) return [];
      return insights.filter((i) => {
        if (i.fact.kind === "priceChange") return i.fact.value.assetID === move.securityID && i.fact.value.lastObservedAt === move.lastDate;
        if (i.fact.kind === "watchlistMovement")
          return i.fact.value.movement.assetID === move.securityID && i.fact.value.movement.lastObservedAt === move.lastDate;
        return false;
      });
    }
    default:
      return [];
  }
}

const MANDATORY: readonly WeeklyWrapStoryKind[] = ["opening", "portfolio", "portfolioContributor", "watchlist", "marketBreadth", "marketIndex"];
const OPTIONAL: readonly WeeklyWrapStoryKind[] = ["watchlistHighlight", "marketRise", "marketFall"];

/** Mandatory stories first, then at most three ranked optional moves, the personal stat and the summary. */
export function orderWrapStories<Story extends WeeklyWrapStoryRef>(
  stories: readonly Story[],
  insights: readonly Insight[],
  profile: UserInterestProfile,
  now: EpochMs,
): Story[] {
  const mandatory = stories.filter((s) => MANDATORY.includes(s.kind));
  const storyByFact = new Map<string, Story>();
  const candidates: Insight[] = [];
  for (const story of stories.filter((s) => OPTIONAL.includes(s.kind))) {
    const fact = wrapStoryFacts(story, insights).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
    if (!fact || storyByFact.has(fact.id)) continue;
    storyByFact.set(fact.id, story);
    candidates.push(fact);
  }
  const ranked = rankInsights(candidates, { surface: "weeklyWrap", profile, now, limit: 3 });
  return [
    ...mandatory,
    ...ranked.map((i) => storyByFact.get(i.id)).filter((s): s is Story => s !== undefined),
    ...stories.filter((s) => s.kind === "personalStat"),
    ...stories.filter((s) => s.kind === "summary"),
  ];
}
