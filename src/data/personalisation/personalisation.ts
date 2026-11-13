import {
  ContentExposureStore,
  type ContentExposureSnapshot,
  EXPOSURE_PREFIX,
  type FeedbackScope,
  type KeyValueStorage,
  PERSONALISATION_PREFIX,
  type PersonalisationEvent,
  PersonalisationStore,
  type PersonalizationCandidate,
  type PersonalizationSurface,
  type UserInterestProfile,
  clearRankingCache,
  exposureSnapshot,
  feedbackFor,
  interestProfile,
  memoryStorage,
  receiptKeys,
  topicKeys,
} from "@/domain/personalisation";
import type { Insight } from "@/domain/intelligence/models";

import { browserSupabase } from "../supabase/browser-client";
import { supabasePersonalisationRepository } from "./repository";

/*
 * The tab's personalisation session (iOS `PersonalizationSession` and `PersonalisationCapture`): cached receipts and
 * behaviour for the signed-in account, event capture and `user_activity_daily` sync. Computed in the browser only;
 * nothing here reaches analytics. Every await is followed by a check that the same account is still active.
 * Privacy mode stops capture, receipts and feedback.
 */

const REFRESH_INTERVAL_MS = 60_000;

function browserStorage(): KeyValueStorage {
  try {
    const storage = window.localStorage;
    const probe = `${PERSONALISATION_PREFIX}probe`;
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return memoryStorage();
  }
}

type Listener = () => void;

class PersonalisationSession {
  private storage: KeyValueStorage | null = null;
  private exposureStore: ContentExposureStore | null = null;
  private activityStore: PersonalisationStore | null = null;
  private token = 0;
  private refreshRequest = 0;
  private exposureRevision = 0;
  private refreshedAt: number | null = null;
  private listeners = new Set<Listener>();

  userID: string | null = null;
  exposure: ContentExposureSnapshot = exposureSnapshot();
  behavior: ReadonlyMap<string, number> = new Map();
  alertIDs: ReadonlySet<string> = new Set();
  privacyMode = false;

  private stores() {
    if (!this.storage) {
      this.storage = browserStorage();
      this.exposureStore = new ContentExposureStore(this.storage);
      this.activityStore = new PersonalisationStore(this.storage, this.exposureStore);
    }
    return { exposure: this.exposureStore!, activity: this.activityStore! };
  }

  private isCurrent(userID: string, token: number) {
    return this.userID === userID && this.token === token;
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  profile(held: ReadonlySet<string> = new Set(), watched: ReadonlySet<string> = new Set()): UserInterestProfile {
    return interestProfile({ holdingIDs: held, watchedIDs: watched, alertIDs: this.alertIDs, behavior: this.behavior });
  }

  /** Forgets the tab's in-memory state (sign-out, account switch). */
  reset(): void {
    clearRankingCache();
    this.token += 1;
    this.refreshRequest += 1;
    this.userID = null;
    this.exposure = exposureSnapshot();
    this.behavior = new Map();
    this.alertIDs = new Set();
    this.refreshedAt = null;
    this.exposureRevision = 0;
    this.notify();
  }

  async refresh(userID: string, force = false, now = Date.now()): Promise<void> {
    if (this.userID !== userID) {
      this.reset();
      this.userID = userID;
    }
    if (!force && this.refreshedAt !== null && now >= this.refreshedAt && now - this.refreshedAt < REFRESH_INTERVAL_MS) return;
    const token = this.token;
    const request = ++this.refreshRequest;
    const revision = this.exposureRevision;
    const { exposure, activity } = this.stores();
    // Local stores are synchronous; the yield keeps the contract of an asynchronous refresh.
    await Promise.resolve();
    if (!this.isCurrent(userID, token) || this.refreshRequest !== request || this.exposureRevision !== revision) return;
    const receipts = exposure.snapshot(userID, now);
    const interests = activity.interestProfile(userID, now, exposure.behaviorSince(userID, now));
    this.exposure = receipts;
    this.behavior = interests.behavior;
    this.refreshedAt = now;
    this.notify();
  }

  /** A deliberate discovery action; uploads the day's counters in the background. */
  capture(events: PersonalisationEvent | readonly PersonalisationEvent[], userID: string | null): void {
    if (userID === null || this.privacyMode || this.userID !== userID) return;
    const token = this.token;
    const { activity } = this.stores();
    for (const event of Array.isArray(events) ? events : [events as PersonalisationEvent]) activity.record(event, userID);
    void this.sync(userID, token);
  }

  async sync(userID: string, token = this.token): Promise<void> {
    if (!this.isCurrent(userID, token)) return;
    const { activity } = this.stores();
    await activity.sync(userID, supabasePersonalisationRepository(browserSupabase()), () => this.isCurrent(userID, token));
    if (!this.isCurrent(userID, token)) return;
    await this.refresh(userID, true);
  }

  async recordInsight(insight: Insight, opened: boolean, surface: PersonalizationSurface, userID: string): Promise<void> {
    await this.record(receiptKeys(insight), opened, surface, userID, topicKeys(insight));
  }

  async record(
    keys: ReadonlySet<string>,
    opened: boolean,
    surface: PersonalizationSurface,
    userID: string,
    topics: ReadonlySet<string> = new Set(),
  ): Promise<void> {
    if (this.userID !== userID || this.privacyMode) return;
    const token = this.token;
    const now = Date.now();
    this.stores().exposure.record({ keys, topics, opened, surface, userID, now });
    await Promise.resolve();
    if (!this.isCurrent(userID, token)) return;
    // Shown receipts apply on the next refresh, so a feed never rotates while it renders.
    if (!opened) return;
    this.exposureRevision += 1;
    const union = (a: ReadonlySet<string>, b: ReadonlySet<string>) => new Set([...a, ...b]);
    this.exposure = {
      ...this.exposure,
      opened: union(this.exposure.opened, keys),
      shown: union(this.exposure.shown, keys),
      topics: union(this.exposure.topics, topics),
      homeShown: surface === "home" ? union(this.exposure.homeShown, keys) : this.exposure.homeShown,
    };
    this.notify();
  }

  /** "Not useful" (`fact`) or "less like this" (`familyOnSurface`); `null` undoes it. */
  async setFeedback(candidate: PersonalizationCandidate, scope: FeedbackScope | null, surface: PersonalizationSurface, userID: string): Promise<boolean> {
    if (this.userID !== userID || this.privacyMode || candidate.rejection) return false;
    const token = this.token;
    const now = Date.now();
    const { exposure } = this.stores();
    if (scope) exposure.recordFeedback(feedbackFor(candidate, scope, surface, now), userID, now);
    else exposure.removeFeedback(candidate, surface, userID, now);
    await Promise.resolve();
    if (!this.isCurrent(userID, token) || this.privacyMode) return false;
    this.exposureRevision += 1;
    this.exposure = { ...this.exposure, feedback: exposure.snapshot(userID, now).feedback };
    clearRankingCache();
    this.refreshedAt = null;
    this.notify();
    return true;
  }

  /** Settings: forget viewing interest from tomorrow on. */
  async resetBehavior(userID: string): Promise<void> {
    if (this.userID !== userID) return;
    const token = this.token;
    this.stores().exposure.resetBehavior(userID, Date.now());
    await Promise.resolve();
    if (!this.isCurrent(userID, token)) return;
    await this.refresh(userID, true);
  }

  /** Settings: forget every "not useful" answer. */
  async resetFeedback(userID: string): Promise<void> {
    if (this.userID !== userID) return;
    const token = this.token;
    this.stores().exposure.resetFeedback(userID, Date.now());
    await Promise.resolve();
    if (!this.isCurrent(userID, token)) return;
    this.exposureRevision += 1;
    this.exposure = { ...this.exposure, feedback: [] };
    clearRankingCache();
    this.refreshedAt = null;
    this.notify();
  }

  /** Sign-out: drop this account's counters and receipts from the browser and the tab. */
  clear(userID: string): void {
    const { exposure, activity } = this.stores();
    activity.clear(userID);
    exposure.clear(userID);
    if (this.userID === userID) this.reset();
  }

  /** Account deletion: as sign-out, and later writes for the account are ignored. */
  remove(userID: string): void {
    const { exposure, activity } = this.stores();
    activity.clear(userID);
    exposure.remove(userID);
    if (this.userID === userID) this.reset();
  }
}

export const personalisationSession = new PersonalisationSession();

/** Sign-out hook: clears the account's personalisation (its storage keys also carry the account prefix). */
export function clearPersonalisation(userID: string | null): void {
  if (userID) personalisationSession.clear(userID);
  else personalisationSession.reset();
}

export const PERSONALISATION_STORAGE_PREFIXES = [PERSONALISATION_PREFIX, EXPOSURE_PREFIX] as const;
