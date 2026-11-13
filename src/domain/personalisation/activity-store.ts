import type { InsightPeriod } from "../intelligence/models";
import { isValidPeriod } from "../intelligence/models";
import { DAY_MS, type EpochMs, civilDate, startOfDay, weekday } from "../market/zone";
import type { ContentExposureStore } from "./exposure-store";
import { type PersonalisationAggregate, type UserInterestProfile, behavioralInterest, interestProfile, marketDayStart, rankedAssetIDs } from "./profile";
import { type KeyValueStorage, PERSONALISATION_PREFIX, dateRecord, isFiniteNumber, isRecord, readJSON, removeKey, stringArray, writeJSON } from "./storage";

/*
 * iOS `PersonalisationEvent`, `PersonalisationSnapshot` and `PersonalisationStore`: deliberate discovery actions become
 * bounded daily counters per installation, kept 112 days in the browser and reconciled with `user_activity_daily`.
 * Search terms, tap trails and portfolio amounts are never recorded.
 */

export const ACTIVITY_RETENTION_DAYS = 112;
const RETENTION_MS = ACTIVITY_RETENTION_DAYS * DAY_MS;
const VIEW_DEBOUNCE_MS = 30 * 60_000;
const UPLOAD_BATCH = 100;

export type WeeklyWrapEvent = "wrap_available" | "wrap_opened" | "wrap_completed" | "wrap_abandoned" | "wrap_shared";

export type PersonalisationEvent =
  | { readonly type: "assetViewed"; readonly securityID: string; readonly at: EpochMs }
  | { readonly type: "searchSelected"; readonly securityID: string; readonly at: EpochMs }
  | { readonly type: "comparisonCreated"; readonly primaryID: string; readonly relatedID: string; readonly at: EpochMs }
  /** `range` is the chart range id (`1D`, `1S`, `1M`, `3M`, `6M`, `1A`, `Tudo`). */
  | { readonly type: "chartRangeSelected"; readonly securityID: string; readonly range: string; readonly at: EpochMs }
  | { readonly type: "watchlistAdded"; readonly securityID: string; readonly at: EpochMs }
  | { readonly type: "watchlistRemoved"; readonly securityID: string; readonly at: EpochMs }
  | { readonly type: "wrapOpened"; readonly at: EpochMs }
  | { readonly type: "weeklyWrap"; readonly event: WeeklyWrapEvent; readonly periodKey: string; readonly at: EpochMs };

interface Dimensions {
  readonly kind: string;
  readonly securityID: string | null;
  readonly relatedID: string | null;
  readonly variant: string;
  readonly date: EpochMs;
}

function dimensions(event: PersonalisationEvent): Dimensions {
  switch (event.type) {
    case "assetViewed":
      return { kind: "asset_view", securityID: event.securityID, relatedID: null, variant: "", date: event.at };
    case "searchSelected":
      return { kind: "search_select", securityID: event.securityID, relatedID: null, variant: "", date: event.at };
    case "comparisonCreated":
      return { kind: "comparison", securityID: event.primaryID, relatedID: event.relatedID, variant: "", date: event.at };
    case "chartRangeSelected":
      return { kind: "chart_range", securityID: event.securityID, relatedID: null, variant: event.range, date: event.at };
    case "watchlistAdded":
      return { kind: "watchlist_add", securityID: event.securityID, relatedID: null, variant: "", date: event.at };
    case "watchlistRemoved":
      return { kind: "watchlist_remove", securityID: event.securityID, relatedID: null, variant: "", date: event.at };
    case "wrapOpened":
      return { kind: "wrap_open", securityID: null, relatedID: null, variant: "", date: event.at };
    case "weeklyWrap":
      return { kind: event.event, securityID: null, relatedID: null, variant: event.periodKey, date: event.at };
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUUID = (value: string) => UUID.test(value);
const normalizedID = (value: string | null) => (value === null ? null : isUUID(value) ? value.toLowerCase() : value);

/** `weekly-YYYY-MM-DD` naming a Luanda Monday (iOS `WeeklyWrapDeepLink`). */
export function isWeeklyWrapPeriodKey(key: string): boolean {
  if (!/^weekly-\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const day = marketDayStart(key.slice(7));
  return day !== undefined && weekday(day) === 2;
}

export const canUpload = (row: PersonalisationAggregate) =>
  (row.securityID === null || isUUID(row.securityID)) && (row.relatedSecurityID === null || isUUID(row.relatedSecurityID));

const aggregateKey = (row: Pick<PersonalisationAggregate, "installationID" | "activityDay" | "kind" | "securityID" | "relatedSecurityID" | "variant">) =>
  [row.installationID, row.activityDay, row.kind, row.securityID ?? "", row.relatedSecurityID ?? "", row.variant].join("|");

/** The account's `user_activity_daily` rows (iOS `PersonalisationRepository`). */
export interface PersonalisationRepository {
  upsert(rows: readonly PersonalisationAggregate[]): Promise<void>;
  fetch(userID: string, sinceDay: string): Promise<PersonalisationAggregate[]>;
}

export interface PersonalisationSnapshot {
  readonly uniqueAssetsViewed: number;
  readonly mostViewedAssetID: string | null;
  readonly mostViewedCount: number;
  readonly mostViewedDays: number;
  /** Ranked for consumers; current holdings and watchlist come from their source tables. */
  readonly relevantAssetIDs: readonly string[];
  readonly searchSelections: number;
  readonly comparisons: number;
  readonly chartRangeSelections: number;
  readonly watchlistAdds: number;
  readonly watchlistRemoves: number;
  readonly wrapOpens: number;
  readonly interestProfile: UserInterestProfile;
}

const emptySnapshot = (): PersonalisationSnapshot => ({
  uniqueAssetsViewed: 0,
  mostViewedAssetID: null,
  mostViewedCount: 0,
  mostViewedDays: 0,
  relevantAssetIDs: [],
  searchSelections: 0,
  comparisons: 0,
  chartRangeSelections: 0,
  watchlistAdds: 0,
  watchlistRemoves: 0,
  wrapOpens: 0,
  interestProfile: interestProfile(),
});

interface Profile {
  installationID: string;
  rows: PersonalisationAggregate[];
  lastViewedAt: Map<string, number>;
  pendingKeys: string[];
}

function decodeAggregate(value: unknown, userID: string): PersonalisationAggregate | null {
  if (!isRecord(value)) return null;
  const { installationID, activityDay, kind, securityID, relatedSecurityID, variant, activityCount } = value;
  if (typeof installationID !== "string" || typeof activityDay !== "string" || typeof kind !== "string" || typeof variant !== "string") return null;
  if (
    !Number.isInteger(activityCount) ||
    (securityID !== null && typeof securityID !== "string") ||
    (relatedSecurityID !== null && typeof relatedSecurityID !== "string")
  )
    return null;
  return { userID, installationID, activityDay, kind, securityID, relatedSecurityID, variant, activityCount: activityCount as number };
}

const newInstallationID = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "00000000-0000-4000-8000-000000000000");

export class PersonalisationStore {
  private readonly remoteRows = new Map<string, PersonalisationAggregate[]>();
  private readonly syncInProgress = new Set<string>();
  private clearEpoch = 0;

  constructor(
    private readonly storage: KeyValueStorage,
    private readonly exposure: ContentExposureStore,
    private readonly now: () => EpochMs = () => Date.now(),
  ) {}

  record(event: PersonalisationEvent, userID: string): void {
    const recordedAt = this.now();
    const d = dimensions(event);
    if (d.kind.startsWith("wrap_") && d.kind !== "wrap_open" && !isWeeklyWrapPeriodKey(d.variant)) return;
    const securityID = normalizedID(d.securityID);
    const relatedID = normalizedID(d.relatedID);
    if (
      !Number.isFinite(d.date) ||
      d.date > recordedAt ||
      d.date < recordedAt - RETENTION_MS ||
      securityID === "" ||
      relatedID === "" ||
      (securityID === relatedID && relatedID !== null)
    )
      return;
    const profile = this.load(userID);
    if (d.kind === "asset_view" && securityID !== null) {
      const last = profile.lastViewedAt.get(securityID);
      if (last !== undefined && d.date - last < VIEW_DEBOUNCE_MS) return;
      profile.lastViewedAt.set(securityID, d.date);
    }
    const dims = {
      installationID: profile.installationID,
      activityDay: civilDate(d.date),
      kind: d.kind,
      securityID,
      relatedSecurityID: relatedID,
      variant: d.variant,
    };
    const key = aggregateKey(dims);
    const index = profile.rows.findIndex((row) => aggregateKey(row) === key);
    if (index >= 0) profile.rows[index] = { ...profile.rows[index], activityCount: Math.min(1000, profile.rows[index].activityCount + 1) };
    else profile.rows.push({ userID, ...dims, activityCount: 1 });
    if (!profile.pendingKeys.includes(key)) profile.pendingKeys.push(key);
    this.prune(profile, recordedAt);
    this.save(profile, userID);
  }

  /**
   * Uploads pending counters, then reads every installation's counters back. `isCurrent` is asked after every await:
   * a signed-out or switched account stops the pass.
   */
  async sync(userID: string, repository: PersonalisationRepository, isCurrent: () => boolean = () => true): Promise<void> {
    if (this.syncInProgress.has(userID)) return;
    this.syncInProgress.add(userID);
    let repeat = false;
    try {
      const epoch = this.clearEpoch;
      const profile = this.load(userID);
      const pending = new Set(profile.pendingKeys);
      const uploads = profile.rows.filter((row) => pending.has(aggregateKey(row)) && canUpload(row));
      for (let start = 0; start < uploads.length; start += UPLOAD_BATCH) {
        await repository.upsert(uploads.slice(start, start + UPLOAD_BATCH));
        if (this.clearEpoch !== epoch || !isCurrent()) return;
      }
      if (uploads.length > 0) {
        const latest = this.load(userID);
        for (const uploaded of uploads) {
          const key = aggregateKey(uploaded);
          if (latest.rows.find((row) => aggregateKey(row) === key)?.activityCount === uploaded.activityCount) {
            latest.pendingKeys = latest.pendingKeys.filter((pendingKey) => pendingKey !== key);
          }
        }
        this.save(latest, userID);
      }
      const cutoff = civilDate(this.now() - RETENTION_MS);
      const fetched = await repository.fetch(userID, cutoff);
      if (this.clearEpoch !== epoch || !isCurrent()) return;
      this.remoteRows.set(userID, fetched);
      // An event recorded while this request was in flight needs its own upload pass.
      repeat = this.load(userID).pendingKeys.length > 0;
    } catch {
      // Pending counters wait for the next authenticated session or action.
    } finally {
      this.syncInProgress.delete(userID);
      if (repeat) void this.sync(userID, repository, isCurrent);
    }
  }

  /** Shared daily-aggregate query for any consumer, independent of Wrap presentation. */
  snapshot(
    userID: string,
    period: InsightPeriod,
    watchlistIDs: ReadonlySet<string>,
    portfolioIDs: ReadonlySet<string>,
    date: EpochMs = this.now(),
  ): PersonalisationSnapshot {
    if (
      !isValidPeriod(period) ||
      !Number.isFinite(date) ||
      startOfDay(period.start) !== period.start ||
      startOfDay(period.endExclusive) !== period.endExclusive
    ) {
      return emptySnapshot();
    }
    const profile = this.load(userID);
    this.prune(profile, date);
    this.save(profile, userID);
    const merged = new Map(profile.rows.map((row) => [aggregateKey(row), row]));
    for (const row of this.remoteRows.get(userID) ?? []) {
      if (row.userID !== userID) continue;
      const key = aggregateKey(row);
      if (row.activityCount > (merged.get(key)?.activityCount ?? 0)) merged.set(key, row);
    }
    const cutoff = civilDate(date - RETENTION_MS);
    const today = civilDate(date);
    const rows = [...merged.values()].filter((row) => row.activityDay >= cutoff && row.activityDay <= today);
    const firstDay = civilDate(period.start);
    const endDay = civilDate(period.endExclusive);
    const weekly = rows.filter((row) => row.activityDay >= firstDay && row.activityDay < endDay);
    const viewsByAsset = new Map<string, PersonalisationAggregate[]>();
    for (const row of weekly) {
      if (row.kind !== "asset_view" || row.securityID === null) continue;
      viewsByAsset.set(row.securityID, [...(viewsByAsset.get(row.securityID) ?? []), row]);
    }
    let top: { key: string; value: number } | null = null;
    for (const [key, views] of viewsByAsset) {
      const value = views.reduce((sum, row) => sum + row.activityCount, 0);
      // Highest count; ties go to the smaller id.
      if (top === null || value > top.value || (value === top.value && key < top.key)) top = { key, value };
    }
    const interests = interestProfile({
      holdingIDs: portfolioIDs,
      watchedIDs: watchlistIDs,
      behavior: behavioralInterest(rows, userID, date, this.exposure.behaviorSince(userID, date)),
    });
    const count = (kind: string) => weekly.filter((row) => row.kind === kind).reduce((sum, row) => sum + row.activityCount, 0);
    return {
      uniqueAssetsViewed: viewsByAsset.size,
      mostViewedAssetID: top?.key ?? null,
      mostViewedCount: top?.value ?? 0,
      mostViewedDays: top ? new Set(viewsByAsset.get(top.key)!.map((row) => row.activityDay)).size : 0,
      relevantAssetIDs: rankedAssetIDs(interests),
      searchSelections: count("search_select"),
      comparisons: count("comparison"),
      chartRangeSelections: count("chart_range"),
      watchlistAdds: count("watchlist_add"),
      watchlistRemoves: count("watchlist_remove"),
      wrapOpens: count("wrap_open"),
      interestProfile: interests,
    };
  }

  interestProfile(userID: string, date: EpochMs, since: EpochMs | null = null): UserInterestProfile {
    const profile = this.load(userID);
    this.prune(profile, date);
    this.save(profile, userID);
    const rows = new Map<string, PersonalisationAggregate>();
    for (const row of profile.rows) {
      const key = aggregateKey(row);
      const existing = rows.get(key);
      if (!existing || row.activityCount > existing.activityCount) rows.set(key, row);
    }
    for (const row of this.remoteRows.get(userID) ?? []) {
      if (row.userID !== userID) continue;
      const key = aggregateKey(row);
      if (row.activityCount > (rows.get(key)?.activityCount ?? 0)) rows.set(key, row);
    }
    return interestProfile({ behavior: behavioralInterest([...rows.values()], userID, date, since) });
  }

  /** Sign-out or account change: forget this account's counters on this browser. */
  clear(userID: string): void {
    this.clearEpoch += 1;
    this.remoteRows.delete(userID);
    removeKey(this.storage, PERSONALISATION_PREFIX + userID);
  }

  private load(userID: string): Profile {
    const value = readJSON(this.storage, PERSONALISATION_PREFIX + userID);
    if (!isRecord(value) || typeof value.installationID !== "string" || !Array.isArray(value.rows)) {
      return { installationID: newInstallationID(), rows: [], lastViewedAt: new Map(), pendingKeys: [] };
    }
    return {
      installationID: value.installationID,
      rows: value.rows.map((row) => decodeAggregate(row, userID)).filter((row): row is PersonalisationAggregate => row !== null),
      lastViewedAt: dateRecord(value.lastViewedAt),
      pendingKeys: stringArray(value.pendingKeys),
    };
  }

  private save(profile: Profile, userID: string): void {
    writeJSON(this.storage, PERSONALISATION_PREFIX + userID, {
      installationID: profile.installationID,
      rows: profile.rows.map((row) => ({
        installationID: row.installationID,
        activityDay: row.activityDay,
        kind: row.kind,
        securityID: row.securityID,
        relatedSecurityID: row.relatedSecurityID,
        variant: row.variant,
        activityCount: row.activityCount,
      })),
      lastViewedAt: Object.fromEntries(profile.lastViewedAt),
      pendingKeys: profile.pendingKeys,
    });
  }

  private prune(profile: Profile, date: EpochMs): void {
    const cutoff = civilDate(date - RETENTION_MS);
    profile.rows = profile.rows.filter((row) => row.activityDay >= cutoff);
    profile.lastViewedAt = new Map([...profile.lastViewedAt].filter(([, value]) => isFiniteNumber(value) && value >= date - RETENTION_MS));
    const retained = new Set(profile.rows.map(aggregateKey));
    profile.pendingKeys = profile.pendingKeys.filter((key) => retained.has(key));
  }
}
