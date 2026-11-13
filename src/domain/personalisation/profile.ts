import { DAY_MS, type EpochMs, dayStart } from "../market/zone";
import { type PersonalizationConfiguration, STANDARD_CONFIGURATION } from "./configuration";

/*
 * iOS `UserInterestProfile`: observable product relationships only. No inferred investor type, wealth or risk preference.
 */

export type Relationship = "market" | "alert" | "watchlist" | "portfolio";

export interface UserInterestProfile {
  readonly holdingIDs: ReadonlySet<string>;
  readonly watchedIDs: ReadonlySet<string>;
  readonly alertIDs: ReadonlySet<string>;
  readonly behavior: ReadonlyMap<string, number>;
}

export function interestProfile(values: Partial<UserInterestProfile> = {}): UserInterestProfile {
  return {
    holdingIDs: values.holdingIDs ?? new Set(),
    watchedIDs: values.watchedIDs ?? new Set(),
    alertIDs: values.alertIDs ?? new Set(),
    behavior: values.behavior ?? new Map(),
  };
}

/** One `user_activity_daily` row (iOS `PersonalisationAggregate`). */
export interface PersonalisationAggregate {
  readonly userID: string;
  readonly installationID: string;
  /** `YYYY-MM-DD`, Luanda. */
  readonly activityDay: string;
  readonly kind: string;
  readonly securityID: string | null;
  readonly relatedSecurityID: string | null;
  readonly variant: string;
  readonly activityCount: number;
}

const intersects = (a: ReadonlySet<string>, b: ReadonlySet<string>) => [...a].some((value) => b.has(value));
export const utf8Length = (value: string) => new TextEncoder().encode(value).length;

export function relationship(profile: UserInterestProfile, assets: ReadonlySet<string>): Relationship {
  if (intersects(assets, profile.holdingIDs)) return "portfolio";
  if (intersects(assets, profile.watchedIDs)) return "watchlist";
  if (intersects(assets, profile.alertIDs)) return "alert";
  return "market";
}

export function relationshipWeight(profile: UserInterestProfile, assets: ReadonlySet<string>, configuration = STANDARD_CONFIGURATION): number {
  switch (relationship(profile, assets)) {
    case "portfolio":
      return configuration.holdingWeight;
    case "watchlist":
      return configuration.watchlistWeight;
    case "alert":
      return configuration.alertWeight;
    case "market":
      return 0;
  }
}

export function interestWeight(profile: UserInterestProfile, assets: ReadonlySet<string>, configuration = STANDARD_CONFIGURATION): number {
  const values = [...assets].map((id) => profile.behavior.get(id)).filter((v): v is number => v !== undefined && Number.isFinite(v) && v > 0);
  const value = values.length ? Math.max(...values) : 0;
  return Math.floor(Math.min(Math.max(0, configuration.maximumBehaviorWeight), value));
}

export function rankedAssetIDs(profile: UserInterestProfile): string[] {
  const ids = new Set([...profile.holdingIDs, ...profile.watchedIDs, ...profile.alertIDs, ...profile.behavior.keys()]);
  const weight = (id: string) => relationshipWeight(profile, new Set([id])) + interestWeight(profile, new Set([id]));
  return [...ids].sort((a, b) => {
    const lhs = weight(a);
    const rhs = weight(b);
    return lhs === rhs ? (a < b ? -1 : a > b ? 1 : 0) : rhs - lhs;
  });
}

/** Strict market-day key → its Luanda midnight (iOS `MarketEventDay(rawValue:)`). */
export function marketDayStart(value: string): EpochMs | undefined {
  return utf8Length(value) === 10 ? dayStart(value) : undefined;
}

export function behavioralInterest(
  rows: readonly PersonalisationAggregate[],
  userID: string,
  now: EpochMs,
  since: EpochMs | null = null,
  configuration: PersonalizationConfiguration = STANDARD_CONFIGURATION,
): Map<string, number> {
  const result = new Map<string, number>();
  if (!Number.isFinite(now) || !(configuration.behaviorHalfLifeDays > 0) || !Number.isFinite(configuration.behaviorHalfLifeDays)) return result;
  // Merge installations before capping each deliberate action per asset and day.
  const daily = new Map<string, { asset: string; day: EpochMs; weight: number; count: number }>();
  for (const row of rows) {
    if (row.userID !== userID || !(row.activityCount > 0)) continue;
    const day = marketDayStart(row.activityDay);
    const weight = Object.hasOwn(configuration.behaviorWeights, row.kind) ? configuration.behaviorWeights[row.kind] : undefined;
    if (
      day === undefined ||
      day > now ||
      (since !== null && day < since) ||
      !(now - day < configuration.behaviorRetentionDays * DAY_MS) ||
      weight === undefined ||
      !Number.isFinite(weight) ||
      !(weight > 0)
    )
      continue;
    const ids = new Set([row.securityID, row.kind === "comparison" ? row.relatedSecurityID : null].filter((id): id is string => id !== null));
    for (const id of ids) {
      if (id === "") continue;
      const key = `${row.activityDay}:${row.kind}:${utf8Length(id)}:${id}`;
      const count = Math.min(Math.max(0, configuration.maximumDailySignalCount), row.activityCount);
      const previous = daily.get(key)?.count ?? 0;
      daily.set(key, { asset: id, day, weight, count: Math.min(configuration.maximumDailySignalCount, previous + count) });
    }
  }
  for (const key of [...daily.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    const value = daily.get(key)!;
    const age = (now - value.day) / DAY_MS;
    const decay = Math.pow(0.5, age / configuration.behaviorHalfLifeDays);
    result.set(value.asset, (result.get(value.asset) ?? 0) + value.count * value.weight * decay);
  }
  for (const [id, value] of result) result.set(id, Math.min(configuration.maximumBehaviorWeight, value));
  return result;
}
