import { allows } from "../intelligence/privacy";
import { DAY_MS, startOfDay, weekday } from "../market/zone";
import { type PersonalizationAvailability, personalizationAvailability } from "./availability";
import { type ContentExposureSnapshot, type PersonalizationCandidate, type PersonalizationContext, feedbackAdjustment } from "./candidate";
import {
  type PersonalizationConfiguration,
  SIGNIFICANCE_ONLY_CONFIGURATION,
  STANDARD_CONFIGURATION,
  V2_CONFIGURATION,
  atLeast,
  familyTiePriority,
  isSignificanceOnly,
  minimumScore,
  minimumSignificance,
  significanceWeight,
} from "./configuration";
import { type Relationship, type UserInterestProfile, interestProfile, interestWeight, relationship, relationshipWeight } from "./profile";

/*
 * iOS `PersonalizationEngine`: one deterministic selection. Domain adapters establish truth and significance first.
 * Nothing here is sent to analytics.
 */

export interface PersonalizationScore {
  readonly relationship: number;
  readonly significance: number;
  readonly recency: number;
  readonly novelty: number;
  readonly interest: number;
  readonly marketImportance: number;
  readonly feedback: number;
}

export const scoreTotal = (s: PersonalizationScore) => s.relationship + s.significance + s.recency + s.novelty + s.interest + s.marketImportance + s.feedback;

export interface PersonalizationDecision {
  readonly candidate: PersonalizationCandidate;
  readonly score: PersonalizationScore | null;
  rejection: string | null;
  selectionReason: string | null;
  /** Evaluation evidence (iOS debug fields); never logged. */
  readonly debug: { relationship?: Relationship; noveltyReason?: string; rank?: number; selectedPosition?: number };
}

export interface PersonalizationEvaluation {
  readonly selected: readonly PersonalizationDecision[];
  readonly decisions: readonly PersonalizationDecision[];
}

/** QA explanation of one evaluation (iOS `Evaluation.explanation`). */
export function explanation(evaluation: PersonalizationEvaluation): string {
  return evaluation.decisions
    .map((d) => {
      const s = d.score;
      return `${d.candidate.id}: total=${s ? scoreTotal(s) : 0} relationship=${s?.relationship ?? 0} significance=${s?.significance ?? 0} recency=${s?.recency ?? 0} novelty=${s?.novelty ?? 0} interest=${s?.interest ?? 0} market=${s?.marketImportance ?? 0} feedback=${s?.feedback ?? 0} result=${d.rejection ?? d.selectionReason ?? "eligible"}`;
    })
    .join("\n");
}

const intersects = (a: ReadonlySet<string>, b: ReadonlySet<string>) => [...a].some((value) => b.has(value));
const isSubset = (a: ReadonlySet<string>, b: ReadonlySet<string>) => [...a].every((value) => b.has(value));
const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function evaluatePersonalization(
  candidates: readonly PersonalizationCandidate[],
  context: PersonalizationContext,
  limit: number,
  configuration: PersonalizationConfiguration = STANDARD_CONFIGURATION,
  availability?: PersonalizationAvailability,
): PersonalizationEvaluation {
  const features = availability ?? personalizationAvailability(context.now);
  const effective =
    features.personalizationVersion === "significance" || (context.surface === "home" && !features.personalizedHome)
      ? SIGNIFICANCE_ONLY_CONFIGURATION
      : features.personalizationVersion === "v2"
        ? V2_CONFIGURATION
        : configuration;
  const cached = rankingCache.value(candidates, context, limit, effective);
  if (cached) return cached;
  const result = calculate(candidates, context, limit, effective);
  rankingCache.insert(result, candidates, context, limit, effective);
  return result;
}

function aliasClosure(initial: ReadonlySet<string>, candidates: readonly PersonalizationCandidate[]): Set<string> {
  const keys = new Set(initial);
  let changed = true;
  while (changed) {
    changed = false;
    for (const candidate of candidates) {
      if (candidate.rejection) continue;
      if (intersects(keys, candidate.factKeys) && !isSubset(candidate.factKeys, keys)) {
        for (const key of candidate.factKeys) keys.add(key);
        changed = true;
      }
    }
  }
  return keys;
}

function sameCandidate(a: PersonalizationCandidate, b: PersonalizationCandidate) {
  return candidateKey(a) === candidateKey(b);
}

function surfaceRejection(candidate: PersonalizationCandidate, context: PersonalizationContext, profile: UserInterestProfile): string | null {
  const related = candidate.relationshipAssets ?? candidate.assets;
  if (!atLeast(candidate.significance, minimumSignificance(context.surface)) && !candidate.isMandatory) return "insufficient-significance";
  if (context.surface === "notification") {
    if (relationship(profile, related) === "market" && !(candidate.isMarketWide && candidate.significance === "critical"))
      return "insufficient-explicit-relationship";
    if (candidate.isUpcoming) return "scheduled-event-requires-orchestration";
    if (intersects(candidate.factKeys, context.exposure.shown)) return "already-exposed";
  }
  if (context.surface === "portfolio" && relationship(profile, related) !== "portfolio") return "not-a-holding";
  if (context.surface === "watchlist" && !intersects(related, profile.watchedIDs)) return "not-watched";
  if (context.surface === "weekAhead" && !candidate.isUpcoming) return "not-upcoming";
  if (context.surface === "saturdayDiscover") {
    if (weekday(context.now) !== 7 || !["weekend", "holiday", "closed"].includes(context.marketState)) return "not-saturday-closed";
    if (intersects(candidate.factKeys, context.exposure.homeShown)) return "shown-on-home";
  }
  const suppressOpened = ["home", "watchlist", "saturdayDiscover", "notification"].includes(context.surface);
  if (suppressOpened && intersects(candidate.factKeys, context.exposure.opened)) return "already-opened";
  return null;
}

function calculate(
  candidates: readonly PersonalizationCandidate[],
  input: PersonalizationContext,
  limit: number,
  configuration: PersonalizationConfiguration,
): PersonalizationEvaluation {
  const exposure: ContentExposureSnapshot = {
    ...input.exposure,
    opened: aliasClosure(input.exposure.opened, candidates),
    shown: aliasClosure(input.exposure.shown, candidates),
    homeShown: aliasClosure(input.exposure.homeShown, candidates),
  };
  const context: PersonalizationContext = { ...input, exposure };
  const allowsPersonalContext = allows({ surface: "inApp", privacyEnabled: context.hidesPersonalValues }, "personalContext");
  const profile = allowsPersonalContext ? context.profile : interestProfile();
  const significanceOnly = isSignificanceOnly(configuration);
  const groups = new Map<string, PersonalizationCandidate[]>();
  for (const candidate of candidates) groups.set(candidate.id, [...(groups.get(candidate.id) ?? []), candidate]);
  const decisions: PersonalizationDecision[] = [...groups.keys()].sort(byString).map((id) => {
    const copies = groups.get(id)!;
    const candidate = copies[0];
    let rejection: string | null = candidate.rejection ?? null;
    if (!copies.every((copy) => sameCandidate(copy, candidate))) rejection = "conflicting-revisions";
    if (
      !Number.isFinite(context.now) ||
      candidate.id === "" ||
      candidate.factKeys.size === 0 ||
      !Number.isFinite(candidate.observedAt) ||
      !Number.isFinite(candidate.expiresAt)
    ) {
      rejection = "missing-evidence";
    } else if (context.now >= candidate.expiresAt) rejection = "expired";
    else if (!candidate.isUpcoming && candidate.observedAt > context.now) rejection = "future-observation";
    if (rejection === null) rejection = surfaceRejection(candidate, context, profile);
    if (rejection !== null) return { candidate, score: null, rejection, selectionReason: null, debug: {} };
    const age = context.now - candidate.observedAt;
    const seen = intersects(candidate.factKeys, exposure.shown);
    const similar = intersects(candidate.topicKeys, exposure.topics);
    const novelty = seen ? -configuration.seenPenalty : similar ? -configuration.relatedTopicPenalty : configuration.unseenWeight;
    const related = candidate.relationshipAssets ?? candidate.assets;
    const score: PersonalizationScore = {
      relationship: relationshipWeight(profile, related, configuration),
      significance: significanceWeight(candidate.significance),
      recency: age < 86_400_000 ? configuration.freshDayWeight : age < 3 * 86_400_000 ? configuration.freshThreeDaysWeight : configuration.olderWeight,
      novelty: novelty === 0 ? 0 : novelty,
      interest: interestWeight(profile, candidate.assets, configuration),
      marketImportance: candidate.isMarketWide && atLeast(candidate.significance, "material") ? configuration.significantMarketWeight : 0,
      feedback: allowsPersonalContext && !significanceOnly ? feedbackAdjustment(candidate, context.surface, exposure.feedback, context.now) : 0,
    };
    return {
      candidate,
      score,
      rejection: scoreTotal(score) < minimumScore(configuration, context.surface) && !candidate.isMandatory ? "below-surface-threshold" : null,
      selectionReason: null,
      debug: { relationship: relationship(profile, related), noveltyReason: seen ? "same-fact-seen" : similar ? "related-topic-seen" : "unseen" },
    };
  });
  const ranked = decisions
    .map((_, index) => index)
    .filter((index) => decisions[index].rejection === null)
    .sort((a, b) => {
      const lhs = decisions[a];
      const rhs = decisions[b];
      if (Boolean(lhs.candidate.isMandatory) !== Boolean(rhs.candidate.isMandatory)) return lhs.candidate.isMandatory ? -1 : 1;
      const lt = lhs.score ? scoreTotal(lhs.score) : 0;
      const rt = rhs.score ? scoreTotal(rhs.score) : 0;
      if (lt !== rt) return rt - lt;
      if (lhs.candidate.observedAt !== rhs.candidate.observedAt) {
        return context.surface === "weekAhead" ? lhs.candidate.observedAt - rhs.candidate.observedAt : rhs.candidate.observedAt - lhs.candidate.observedAt;
      }
      const lf = familyTiePriority(lhs.candidate.family, context.surface);
      const rf = familyTiePriority(rhs.candidate.family, context.surface);
      if (lf !== rf) return lf - rf;
      return byString(lhs.candidate.id, rhs.candidate.id);
    });
  ranked.forEach((index, position) => (decisions[index].debug.rank = position + 1));

  const selected: number[] = [];
  const occupied = new Set<string>();
  const assetCounts = new Map<string, number>();
  const issuerCounts = new Map<string, number>();
  const familyCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const count = (map: Map<string, number>, key: string) => map.get(key) ?? 0;
  const diverse = context.surface === "saturdayDiscover" || context.surface === "weeklyWrap";
  const maximum = Math.max(0, context.surface === "saturdayDiscover" ? Math.min(limit, 5) : limit);
  // Explore only a significant unconnected market fact; never random or below the surface gate.
  const exploration =
    context.surface === "saturdayDiscover" && maximum >= 3 && configuration.explorationSlots > 0
      ? ranked.find((index) => {
          const value = decisions[index].candidate;
          return (
            value.category === "market" && atLeast(value.significance, "material") && relationship(profile, value.assets) === "market" && !value.isMandatory
          );
        })
      : undefined;
  const explorationCandidate = exploration === undefined ? undefined : decisions[exploration].candidate;
  for (const index of ranked) {
    const decision = decisions[index];
    const candidate = decision.candidate;
    if (selected.length >= maximum) {
      decision.rejection = "selection-limit";
      continue;
    }
    if (intersects(occupied, candidate.factKeys)) {
      decision.rejection = "same-fact";
      continue;
    }
    const sharesReservedQuota =
      explorationCandidate !== undefined &&
      ((candidate.family === explorationCandidate.family && count(familyCounts, candidate.family) >= configuration.perFamilyLimit - 1) ||
        (candidate.category === explorationCandidate.category && count(categoryCounts, candidate.category) >= configuration.perCategoryLimit - 1) ||
        [...candidate.assets].some((id) => explorationCandidate.assets.has(id) && count(assetCounts, id) >= configuration.perAssetLimit - 1) ||
        [...candidate.issuers].some((id) => explorationCandidate.issuers.has(id) && count(issuerCounts, id) >= configuration.perIssuerLimit - 1));
    const reserved =
      exploration !== undefined &&
      !selected.includes(exploration) &&
      index !== exploration &&
      (selected.length === maximum - 1 || sharesReservedQuota) &&
      !candidate.isMandatory &&
      candidate.significance !== "critical";
    if (reserved) {
      decision.rejection = "exploration-slot";
      continue;
    }
    if (diverse && !candidate.isMandatory && candidate.significance !== "critical") {
      if (
        [...candidate.assets].some((id) => count(assetCounts, id) >= configuration.perAssetLimit) ||
        [...candidate.issuers].some((id) => count(issuerCounts, id) >= configuration.perIssuerLimit) ||
        count(familyCounts, candidate.family) >= configuration.perFamilyLimit ||
        count(categoryCounts, candidate.category) >= configuration.perCategoryLimit
      ) {
        decision.rejection = "diversity-limit";
        continue;
      }
    }
    selected.push(index);
    decision.debug.selectedPosition = selected.length;
    for (const key of aliasClosure(candidate.factKeys, candidates)) occupied.add(key);
    for (const id of candidate.assets) assetCounts.set(id, count(assetCounts, id) + 1);
    for (const id of candidate.issuers) issuerCounts.set(id, count(issuerCounts, id) + 1);
    familyCounts.set(candidate.family, count(familyCounts, candidate.family) + 1);
    categoryCounts.set(candidate.category, count(categoryCounts, candidate.category) + 1);
    decision.selectionReason = index === exploration ? "market-exploration" : candidate.isMandatory ? "mandatory-financial-context" : "relevance";
  }
  return { selected: selected.map((index) => decisions[index]), decisions };
}

// MARK: - Ranking cache (iOS `PersonalizationRankingCache`): bounded memoisation for the tab.

const sorted = (set: ReadonlySet<string> | null | undefined) => (set ? [...set].sort(byString) : null);

function candidateKey(c: PersonalizationCandidate): string {
  return JSON.stringify([
    c.id,
    sorted(c.factKeys),
    sorted(c.topicKeys),
    sorted(c.assets),
    sorted(c.issuers),
    c.family,
    c.category,
    c.observedAt,
    c.expiresAt,
    c.significance,
    Boolean(c.isMarketWide),
    Boolean(c.isMandatory),
    Boolean(c.isUpcoming),
    c.rejection ?? null,
    sorted(c.relationshipAssets),
  ]);
}

function contextKey(context: PersonalizationContext): string {
  const { profile, exposure } = context;
  return JSON.stringify([
    context.surface,
    context.marketState,
    context.hidesPersonalValues,
    sorted(profile.holdingIDs),
    sorted(profile.watchedIDs),
    sorted(profile.alertIDs),
    [...profile.behavior.entries()].sort(([a], [b]) => byString(a, b)),
    sorted(exposure.shown),
    sorted(exposure.opened),
    sorted(exposure.topics),
    sorted(exposure.homeShown),
    exposure.feedback.map((f) => [
      f.scope,
      sorted(f.factKeys),
      f.family,
      sorted(f.assets),
      sorted(f.issuers),
      f.category,
      sorted(f.topics),
      f.surface,
      f.recordedAt,
    ]),
  ]);
}

interface CacheEntry {
  readonly key: string;
  readonly now: number;
  readonly expiresAt: number;
  readonly result: PersonalizationEvaluation;
}

const rankingCache = {
  entries: [] as CacheEntry[],
  key(candidates: readonly PersonalizationCandidate[], context: PersonalizationContext, limit: number, configuration: PersonalizationConfiguration) {
    return JSON.stringify([candidates.map(candidateKey), contextKey(context), limit, configuration]);
  },
  value(candidates: readonly PersonalizationCandidate[], context: PersonalizationContext, limit: number, configuration: PersonalizationConfiguration) {
    this.entries = this.entries.filter((entry) => entry.expiresAt > context.now);
    const key = this.key(candidates, context, limit, configuration);
    return this.entries.find((entry) => context.now >= entry.now && context.now < entry.expiresAt && entry.key === key)?.result;
  },
  insert(
    result: PersonalizationEvaluation,
    candidates: readonly PersonalizationCandidate[],
    context: PersonalizationContext,
    limit: number,
    configuration: PersonalizationConfiguration,
  ) {
    if (!Number.isFinite(context.now)) return;
    const boundaries = [context.now + 60_000, startOfDay(context.now) + DAY_MS];
    for (const c of candidates) boundaries.push(c.observedAt, c.expiresAt, c.observedAt + 86_400_000, c.observedAt + 3 * 86_400_000);
    const future = boundaries.filter((value) => value > context.now);
    if (future.length === 0) return;
    this.entries.push({ key: this.key(candidates, context, limit, configuration), now: context.now, expiresAt: Math.min(...future), result });
    if (this.entries.length > 16) this.entries.splice(0, this.entries.length - 16);
  },
};

/** Sign-out, feedback and resets clear the memo (iOS `PersonalizationRankingCache.clear`). */
export function clearRankingCache(): void {
  rankingCache.entries = [];
}
