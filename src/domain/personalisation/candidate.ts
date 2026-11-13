import type { InformationSignificance } from "../intelligence/models";
import type { MarketState } from "../market/calendar";
import type { EpochMs } from "../market/zone";
import { type PersonalizationSurface, atLeast } from "./configuration";
import { type UserInterestProfile, interestProfile } from "./profile";

/*
 * iOS `PersonalizationCandidate`, `ContentExposureSnapshot`, `PersonalizationContext` and `PersonalizationFeedback`.
 * A candidate is a projection of verified content: no prices, quantities or formulas.
 */

export interface PersonalizationCandidate {
  readonly id: string;
  readonly factKeys: ReadonlySet<string>;
  readonly topicKeys: ReadonlySet<string>;
  readonly assets: ReadonlySet<string>;
  readonly issuers: ReadonlySet<string>;
  readonly family: string;
  readonly category: string;
  readonly observedAt: EpochMs;
  readonly expiresAt: EpochMs;
  readonly significance: InformationSignificance;
  readonly isMarketWide?: boolean;
  readonly isMandatory?: boolean;
  readonly isUpcoming?: boolean;
  readonly rejection?: string | null;
  readonly relationshipAssets?: ReadonlySet<string> | null;
}

export type FeedbackScope = "fact" | "familyOnSurface";

/** Explicit usefulness preferences. Observed metadata never implies an asset or issuer dislike. */
export interface PersonalizationFeedback {
  readonly scope: FeedbackScope;
  readonly factKeys: ReadonlySet<string>;
  readonly family: string;
  readonly assets: ReadonlySet<string>;
  readonly issuers: ReadonlySet<string>;
  readonly category: string;
  readonly topics: ReadonlySet<string>;
  readonly surface: PersonalizationSurface;
  readonly recordedAt: EpochMs;
}

export interface ContentExposureSnapshot {
  readonly shown: ReadonlySet<string>;
  readonly opened: ReadonlySet<string>;
  readonly topics: ReadonlySet<string>;
  readonly homeShown: ReadonlySet<string>;
  readonly feedback: readonly PersonalizationFeedback[];
}

export function exposureSnapshot(values: Partial<ContentExposureSnapshot> = {}): ContentExposureSnapshot {
  return {
    shown: values.shown ?? new Set(),
    opened: values.opened ?? new Set(),
    topics: values.topics ?? new Set(),
    homeShown: values.homeShown ?? new Set(),
    feedback: values.feedback ?? [],
  };
}

export interface PersonalizationContext {
  readonly surface: PersonalizationSurface;
  readonly now: EpochMs;
  readonly profile: UserInterestProfile;
  readonly exposure: ContentExposureSnapshot;
  readonly marketState: MarketState;
  readonly hidesPersonalValues: boolean;
}

export function personalizationContext(values: Partial<PersonalizationContext> & Pick<PersonalizationContext, "surface" | "now">): PersonalizationContext {
  return {
    profile: interestProfile(),
    exposure: exposureSnapshot(),
    marketState: "unknown",
    hidesPersonalValues: false,
    ...values,
  };
}

/** Exposure receipts and feedback are kept 56 days (iOS `ContentExposureStore.retention`). */
export const EXPOSURE_RETENTION_MS = 56 * 86_400_000;

const intersects = (a: ReadonlySet<string>, b: ReadonlySet<string>) => [...a].some((value) => b.has(value));

export function feedbackFor(candidate: PersonalizationCandidate, scope: FeedbackScope, surface: PersonalizationSurface, now: EpochMs): PersonalizationFeedback {
  return {
    scope,
    factKeys: candidate.factKeys,
    family: candidate.family,
    assets: candidate.assets,
    issuers: candidate.issuers,
    category: candidate.category,
    topics: candidate.topicKeys,
    surface,
    recordedAt: now,
  };
}

export function feedbackMatches(feedback: PersonalizationFeedback, candidate: PersonalizationCandidate, surface: PersonalizationSurface): boolean {
  return feedback.scope === "fact"
    ? intersects(feedback.factKeys, candidate.factKeys)
    : feedback.family !== "" && feedback.family === candidate.family && feedback.surface === surface;
}

export function feedbackReplaces(feedback: PersonalizationFeedback, other: PersonalizationFeedback): boolean {
  if (feedback.scope !== other.scope) return false;
  return feedback.scope === "fact" ? intersects(feedback.factKeys, other.factKeys) : feedback.family === other.family && feedback.surface === other.surface;
}

/** Financial significance and explicit alert delivery remain authoritative. */
export function feedbackAdjustment(
  candidate: PersonalizationCandidate,
  surface: PersonalizationSurface,
  records: readonly PersonalizationFeedback[],
  now: EpochMs,
): number {
  if (candidate.isMandatory || atLeast(candidate.significance, "material") || surface === "notification") return 0;
  const values = records
    .filter((r) => Number.isFinite(r.recordedAt) && r.recordedAt <= now && now - r.recordedAt < EXPOSURE_RETENTION_MS && feedbackMatches(r, candidate, surface))
    .map((r) => {
      const age = (now - r.recordedAt) / 86_400_000;
      const weight = r.scope === "fact" ? 12 : 16;
      return 0 - Math.round(weight * Math.pow(0.5, age / 28));
    });
  return values.length ? Math.min(...values) : 0;
}
