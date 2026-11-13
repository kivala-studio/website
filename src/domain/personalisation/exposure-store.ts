import { DAY_MS, type EpochMs, civilDate, startOfDay } from "../market/zone";
import {
  type ContentExposureSnapshot,
  EXPOSURE_RETENTION_MS,
  type PersonalizationCandidate,
  type PersonalizationFeedback,
  exposureSnapshot,
  feedbackMatches,
  feedbackReplaces,
} from "./candidate";
import { PERSONALIZATION_SURFACES, type PersonalizationSurface } from "./configuration";
import { marketDayStart } from "./profile";
import { EXPOSURE_PREFIX, type KeyValueStorage, dateRecord, isFiniteNumber, isRecord, readJSON, removeKey, stringArray, writeJSON } from "./storage";

/*
 * iOS `ContentExposureStore`: account-scoped receipts of what was shown and opened, explicit feedback and the
 * behaviour reset cutoff. Kept 56 days, at most 2000 keys per kind and 200 feedback records.
 */

export const MAXIMUM_RECEIPT_KEYS = 2000;
const MAXIMUM_FEEDBACK = 200;

interface Archive {
  shown: Map<string, number>;
  opened: Map<string, number>;
  topics: Map<string, number>;
  homeShown: Map<string, number>;
  behaviorSince: EpochMs | null;
  measurements: Map<string, number>;
  feedback: PersonalizationFeedback[];
}

const emptyArchive = (): Archive => ({
  shown: new Map(),
  opened: new Map(),
  topics: new Map(),
  homeShown: new Map(),
  behaviorSince: null,
  measurements: new Map(),
  feedback: [],
});

function decodeFeedback(value: unknown): PersonalizationFeedback | null {
  if (!isRecord(value)) return null;
  const { scope, family, category, surface, recordedAt } = value;
  if ((scope !== "fact" && scope !== "familyOnSurface") || typeof family !== "string" || typeof category !== "string") return null;
  if (!PERSONALIZATION_SURFACES.includes(surface as PersonalizationSurface) || !isFiniteNumber(recordedAt)) return null;
  return {
    scope,
    family,
    category,
    surface: surface as PersonalizationSurface,
    recordedAt,
    factKeys: new Set(stringArray(value.factKeys)),
    assets: new Set(stringArray(value.assets)),
    issuers: new Set(stringArray(value.issuers)),
    topics: new Set(stringArray(value.topics)),
  };
}

const encodeFeedback = (f: PersonalizationFeedback) => ({
  ...f,
  factKeys: [...f.factKeys],
  assets: [...f.assets],
  issuers: [...f.issuers],
  topics: [...f.topics],
});

function decodeArchive(value: unknown): Archive {
  if (!isRecord(value)) return emptyArchive();
  const measurements = new Map<string, number>();
  if (isRecord(value.measurements))
    for (const [key, count] of Object.entries(value.measurements)) if (Number.isInteger(count)) measurements.set(key, count as number);
  return {
    shown: dateRecord(value.shown),
    opened: dateRecord(value.opened),
    topics: dateRecord(value.topics),
    homeShown: dateRecord(value.homeShown),
    behaviorSince: isFiniteNumber(value.behaviorSince) ? value.behaviorSince : null,
    measurements,
    // Optional so archives written before feedback keep their receipts.
    feedback: Array.isArray(value.feedback) ? value.feedback.map(decodeFeedback).filter((f): f is PersonalizationFeedback => f !== null) : [],
  };
}

function encodeArchive(archive: Archive) {
  return {
    shown: Object.fromEntries(archive.shown),
    opened: Object.fromEntries(archive.opened),
    topics: Object.fromEntries(archive.topics),
    homeShown: Object.fromEntries(archive.homeShown),
    behaviorSince: archive.behaviorSince,
    measurements: Object.fromEntries(archive.measurements),
    feedback: archive.feedback.map(encodeFeedback),
  };
}

const intersects = (a: ReadonlySet<string>, b: Iterable<string>) => {
  for (const value of b) if (a.has(value)) return true;
  return false;
};

export class ContentExposureStore {
  private readonly accounts = new Map<string, Archive>();
  private readonly removedAccounts = new Set<string>();

  constructor(private readonly storage: KeyValueStorage) {}

  snapshot(userID: string, now: EpochMs): ContentExposureSnapshot {
    if (this.removedAccounts.has(userID)) return exposureSnapshot();
    const archive = this.current(userID, now);
    this.persist(userID);
    return {
      shown: new Set(archive.shown.keys()),
      opened: new Set(archive.opened.keys()),
      topics: new Set(archive.topics.keys()),
      homeShown: new Set(archive.homeShown.keys()),
      feedback: [...archive.feedback],
    };
  }

  keys(userID: string, now: EpochMs): ReadonlySet<string> {
    return this.snapshot(userID, now).opened;
  }

  behaviorSince(userID: string, now: EpochMs): EpochMs | null {
    if (this.removedAccounts.has(userID)) return null;
    return this.current(userID, now).behaviorSince;
  }

  /**
   * No await between checking and recording: simultaneous callbacks for one account and fact authorise at most one
   * presentation.
   */
  claimNotificationPresentation(keys: ReadonlySet<string>, userID: string, now: EpochMs): boolean {
    if (!Number.isFinite(now) || keys.size === 0 || this.removedAccounts.has(userID) || [...keys].some((key) => key === "")) return false;
    const archive = this.current(userID, now);
    if (intersects(keys, archive.shown.keys())) return false;
    this.record({ keys, opened: false, surface: "notification", userID, now });
    return true;
  }

  /** Undo only this callback's claim; a later open or receipt must survive cancellation. */
  cancelNotificationPresentation(keys: ReadonlySet<string>, userID: string, claimedAt: EpochMs): void {
    const archive = this.accounts.get(userID);
    if (this.removedAccounts.has(userID) || !archive) return;
    const claimed = [...keys].filter((key) => archive.shown.get(key) === claimedAt && archive.opened.get(key) !== claimedAt);
    if (claimed.length === 0) return;
    for (const key of claimed) archive.shown.delete(key);
    if (Number.isFinite(claimedAt)) {
      const metric = `${civilDate(claimedAt)}:notification:shown`;
      archive.measurements.set(metric, Math.max(0, (archive.measurements.get(metric) ?? 0) - 1));
    }
    this.persist(userID);
  }

  record(input: {
    readonly keys: ReadonlySet<string>;
    readonly topics?: ReadonlySet<string>;
    readonly opened: boolean;
    readonly surface: PersonalizationSurface;
    readonly userID: string;
    readonly now: EpochMs;
  }): void {
    const { keys, topics = new Set<string>(), opened, surface, userID, now } = input;
    if (!Number.isFinite(now) || keys.size === 0 || this.removedAccounts.has(userID)) return;
    const archive = this.current(userID, now);
    const first = !intersects(keys, (opened ? archive.opened : archive.shown).keys());
    for (const key of keys) {
      if (key === "") continue;
      archive.shown.set(key, now);
      if (surface === "home") archive.homeShown.set(key, now);
      if (opened) archive.opened.set(key, now);
    }
    for (const key of topics) archive.topics.set(key, now);
    if (first) {
      const metric = `${civilDate(now)}:${surface}:${opened ? "opened" : "shown"}`;
      archive.measurements.set(metric, Math.min(1000, (archive.measurements.get(metric) ?? 0) + 1));
    }
    this.current(userID, now);
    this.persist(userID);
  }

  recordFeedback(feedback: PersonalizationFeedback, userID: string, now: EpochMs): void {
    if (!Number.isFinite(now) || feedback.recordedAt !== now || feedback.factKeys.size === 0 || feedback.family === "" || this.removedAccounts.has(userID))
      return;
    const archive = this.current(userID, now);
    archive.feedback = [...archive.feedback.filter((record) => !feedbackReplaces(feedback, record)), feedback].slice(-MAXIMUM_FEEDBACK);
    this.persist(userID);
  }

  removeFeedback(candidate: PersonalizationCandidate, surface: PersonalizationSurface, userID: string, now: EpochMs): void {
    if (this.removedAccounts.has(userID)) return;
    const archive = this.current(userID, now);
    archive.feedback = archive.feedback.filter((record) => !feedbackMatches(record, candidate, surface));
    this.persist(userID);
  }

  resetFeedback(userID: string, now: EpochMs): void {
    if (!Number.isFinite(now) || this.removedAccounts.has(userID)) return;
    this.current(userID, now).feedback = [];
    this.persist(userID);
  }

  /** Daily counters cannot split today into before and after the reset; behaviour resumes tomorrow. */
  resetBehavior(userID: string, now: EpochMs): void {
    if (!Number.isFinite(now) || this.removedAccounts.has(userID)) return;
    this.current(userID, now).behaviorSince = startOfDay(now) + DAY_MS;
    this.persist(userID);
  }

  /** Account deletion: later writes for this account are ignored for the life of the store. */
  remove(userID: string): void {
    this.removedAccounts.add(userID);
    this.accounts.delete(userID);
    removeKey(this.storage, EXPOSURE_PREFIX + userID);
  }

  /** Sign-out: forget the account's receipts on this browser; a later sign-in starts fresh. */
  clear(userID: string): void {
    this.accounts.delete(userID);
    removeKey(this.storage, EXPOSURE_PREFIX + userID);
  }

  measurements(userID: string, now: EpochMs): ReadonlyMap<string, number> {
    if (this.removedAccounts.has(userID)) return new Map();
    return new Map(this.current(userID, now).measurements);
  }

  private current(userID: string, now: EpochMs): Archive {
    let value = this.accounts.get(userID);
    if (!value) {
      value = decodeArchive(readJSON(this.storage, EXPOSURE_PREFIX + userID));
      this.accounts.set(userID, value);
    }
    const retained = (dates: Map<string, number>) =>
      new Map(
        [...dates]
          .filter(([key, date]) => key !== "" && Number.isFinite(date) && date <= now && now - date < EXPOSURE_RETENTION_MS)
          .sort(([ka, a], [kb, b]) => (a === b ? (ka < kb ? -1 : ka > kb ? 1 : 0) : b - a))
          .slice(0, MAXIMUM_RECEIPT_KEYS),
      );
    value.shown = retained(value.shown);
    value.opened = retained(value.opened);
    value.topics = retained(value.topics);
    value.homeShown = retained(value.homeShown);
    value.feedback = value.feedback
      .filter(
        (f) => f.factKeys.size > 0 && f.family !== "" && Number.isFinite(f.recordedAt) && f.recordedAt <= now && now - f.recordedAt < EXPOSURE_RETENTION_MS,
      )
      .sort((a, b) => a.recordedAt - b.recordedAt)
      .slice(-MAXIMUM_FEEDBACK);
    value.measurements = new Map(
      [...value.measurements].filter(([key]) => {
        const day = marketDayStart(key.slice(0, 10));
        return day !== undefined && day <= now && now - day < EXPOSURE_RETENTION_MS;
      }),
    );
    return value;
  }

  private persist(userID: string): void {
    writeJSON(this.storage, EXPOSURE_PREFIX + userID, encodeArchive(this.accounts.get(userID) ?? emptyArchive()));
  }
}
