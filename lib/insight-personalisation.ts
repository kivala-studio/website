import {
  emptyInterests,
  interestWeight,
  type InterestProfile,
} from "./personalisation.ts";
export type InsightSurface = "home" | "watchlist" | "portfolio";
export type InsightCandidate = {
  id: string;
  factKeys: string[];
  topics: string[];
  assets: string[];
  relationshipAssets?: string[];
  family: string;
  category: "portfolio" | "watchlist" | "market";
  observedAt: number;
  expiresAt: number;
  significance: number;
  mandatory?: boolean;
  rejection?: string;
};
export type Usefulness = {
  scope: "fact" | "familyOnSurface";
  factKeys: string[];
  family: string;
  surface: InsightSurface;
  recordedAt: number;
};
export type Exposure = {
  shown: Record<string, number>;
  opened: Record<string, number>;
  topics: Record<string, number>;
  feedback: Usefulness[];
};
export const emptyExposure = (): Exposure => ({
  shown: {},
  opened: {},
  topics: {},
  feedback: [],
});
export const exposureRetention = 56 * 86400000;
const overlaps = (a: string[], b: string[]) => a.some((k) => b.includes(k));
export function matchesFeedback(
  record: Usefulness,
  candidate: InsightCandidate,
  surface: InsightSurface,
) {
  return record.scope === "fact"
    ? overlaps(record.factKeys, candidate.factKeys)
    : record.family === candidate.family && record.surface === surface;
}
export function pruneExposure(input: Exposure, now: number): Exposure {
  const dates = (rows: Record<string, number>) =>
    Object.fromEntries(
      Object.entries(rows || {})
        .filter(
          ([k, t]) =>
            k && Number.isFinite(t) && t <= now && now - t < exposureRetention,
        )
        .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
        .slice(0, 2000),
    );
  return {
    shown: dates(input.shown),
    opened: dates(input.opened),
    topics: dates(input.topics),
    feedback: (input.feedback || [])
      .filter(
        (r) =>
          ["fact", "familyOnSurface"].includes(r.scope) &&
          ["home", "watchlist", "portfolio"].includes(r.surface) &&
          Array.isArray(r.factKeys) &&
          r.factKeys.length > 0 &&
          r.factKeys.every((k) => typeof k === "string" && k.length > 0) &&
          typeof r.family === "string" &&
          r.family.length > 0 &&
          Number.isFinite(r.recordedAt) &&
          r.recordedAt <= now &&
          now - r.recordedAt < exposureRetention,
      )
      .sort((a, b) => a.recordedAt - b.recordedAt)
      .slice(-200),
  };
}
export function recordExposure(
  input: Exposure,
  candidate: InsightCandidate,
  opened: boolean,
  now: number,
) {
  const next = pruneExposure(input, now);
  for (const key of candidate.factKeys) {
    next.shown[key] = now;
    if (opened) next.opened[key] = now;
  }
  for (const key of candidate.topics) next.topics[key] = now;
  return pruneExposure(next, now);
}
export function recordUsefulness(
  input: Exposure,
  candidate: InsightCandidate,
  surface: InsightSurface,
  scope: Usefulness["scope"] | null,
  now: number,
) {
  const next = pruneExposure(input, now);
  next.feedback = next.feedback.filter((r) =>
    scope === null
      ? !matchesFeedback(r, candidate, surface)
      : !(
          r.scope === scope &&
          (scope === "fact"
            ? overlaps(r.factKeys, candidate.factKeys)
            : r.family === candidate.family && r.surface === surface)
        ),
  );
  if (scope)
    next.feedback.push({
      scope,
      factKeys: candidate.factKeys,
      family: candidate.family,
      surface,
      recordedAt: now,
    });
  return pruneExposure(next, now);
}
export function feedbackAdjustment(
  candidate: InsightCandidate,
  surface: InsightSurface,
  records: Usefulness[],
  now: number,
) {
  if (candidate.mandatory || candidate.significance >= 3) return 0;
  return Math.min(
    0,
    ...records
      .filter(
        (r) =>
          r.recordedAt <= now &&
          now - r.recordedAt < exposureRetention &&
          matchesFeedback(r, candidate, surface),
      )
      .map(
        (r) =>
          -Math.round(
            (r.scope === "fact" ? 12 : 16) *
              Math.pow(0.5, (now - r.recordedAt) / (28 * 86400000)),
          ),
      ),
  );
}
function aliases(initial: string[], candidates: InsightCandidate[]) {
  const keys = new Set(initial);
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of candidates)
      if (!c.rejection && c.factKeys.some((k) => keys.has(k)))
        for (const key of c.factKeys)
          if (!keys.has(key)) {
            keys.add(key);
            changed = true;
          }
  }
  return keys;
}
/** Domain validators establish truth before this attention-only projection. */
export function rankInsights<T extends InsightCandidate>(
  candidates: T[],
  surface: InsightSurface,
  profile: InterestProfile,
  input: Exposure,
  now: number,
  limit: number,
  mode: "standard" | "significance" | "v2" = "standard",
) {
  const exposure = pruneExposure(input, now),
    shown = aliases(Object.keys(exposure.shown), candidates),
    opened = aliases(Object.keys(exposure.opened), candidates);
  const groups = new Map<string, T[]>();
  for (const c of candidates)
    groups.set(c.id, [...(groups.get(c.id) || []), c]);
  const ranked = [...groups.values()]
    .flatMap((copies) => {
      const c = copies[0],
        related = c.relationshipAssets || c.assets;
      if (
        copies.some((other) => JSON.stringify(other) !== JSON.stringify(c)) ||
        c.rejection ||
        !c.id ||
        !c.factKeys.length ||
        !Number.isFinite(now) ||
        !Number.isFinite(c.observedAt) ||
        !Number.isFinite(c.expiresAt) ||
        c.observedAt > now ||
        c.expiresAt <= now ||
        now - c.observedAt >= 7 * 86400000 ||
        !Number.isInteger(c.significance) ||
        c.significance < 0 ||
        c.significance > 4
      )
        return [];
      if (!c.mandatory && c.significance < (surface === "portfolio" ? 0 : 1))
        return [];
      if (
        surface === "watchlist" &&
        (c.category !== "watchlist" || !overlaps(related, profile.watched))
      )
        return [];
      if (
        surface === "portfolio" &&
        (c.category !== "portfolio" || !overlaps(related, profile.held))
      )
        return [];
      if (surface !== "portfolio" && c.factKeys.some((k) => opened.has(k)))
        return [];
      const significance = [0, 10, 20, 30, 100][c.significance];
      const relationship = interestWeight(
        { ...profile, behavior: {} },
        related,
      );
      const behavior =
        mode === "standard"
          ? interestWeight(
              { ...emptyInterests, behavior: profile.behavior },
              c.assets,
            )
          : 0;
      const age = now - c.observedAt;
      const novelty = c.factKeys.some((k) => shown.has(k))
        ? -15
        : overlaps(c.topics, Object.keys(exposure.topics))
          ? -8
          : 10;
      const score =
        mode === "significance"
          ? significance
          : significance +
            relationship +
            behavior +
            (age < 86400000 ? 12 : age < 3 * 86400000 ? 8 : 4) +
            novelty +
            feedbackAdjustment(c, surface, exposure.feedback, now);
      if (
        mode !== "significance" &&
        surface === "home" &&
        score < 60 &&
        !c.mandatory
      )
        return [];
      return [{ candidate: c, score }];
    })
    .sort(
      (a, b) =>
        Number(!!b.candidate.mandatory) - Number(!!a.candidate.mandatory) ||
        b.score - a.score ||
        b.candidate.observedAt - a.candidate.observedAt ||
        familyOrder(a.candidate.family, surface) -
          familyOrder(b.candidate.family, surface) ||
        a.candidate.id.localeCompare(b.candidate.id),
    );
  const occupied = new Set<string>(),
    selected: T[] = [];
  for (const { candidate: c } of ranked) {
    if (selected.length >= Math.max(0, limit)) break;
    if (c.factKeys.some((k) => occupied.has(k))) continue;
    selected.push(c);
    for (const key of aliases(c.factKeys, candidates)) occupied.add(key);
  }
  return selected;
}
function familyOrder(family: string, surface: InsightSurface) {
  return surface === "watchlist"
    ? ({
        watchlistInformation: 0,
        watchlistMovement: 1,
        watchlistSessionRun: 2,
        watchlistClosingExtreme: 3,
        watchlistBreadth: 4,
      }[family] ?? 5)
    : 0;
}
