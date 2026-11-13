import Decimal from "decimal.js";

import { type EpochMs, type MarketSecurity, isVisibleOutsideSearch } from "@/domain/market";
import type { PortfolioTransaction } from "@/domain/portfolio/models";
import { type EventBatch, REPLAY_AGE, isReplayableBatch } from "@/domain/week-ahead/week-ahead";

import { type IntelligenceAvailability, permitsInsightType } from "./feature-controls";
import { Dec } from "./math";
import type { Insight } from "./models";

/*
 * Completed readings kept per account (iOS `CachedIntelligence.swift`, `IntelligenceCache.swift`). A reading is
 * not a replacement for an active fact's fifteen-minute expiry: it is shown as "saved", replays only while the
 * ledger, watchlist and market fingerprints still match, and never outlives seven days (one for the week ahead).
 */

export const CACHED_KINDS = ["portfolio", "watchlist", "weekAhead"] as const;
export type CachedKind = (typeof CACHED_KINDS)[number];

const DAY = 86_400_000;
export const READING_MAXIMUM_AGE = 7 * DAY;
export const WEEK_AHEAD_MAXIMUM_AGE = DAY;
export const CACHE_MAXIMUM_BYTES = 2 * 1024 * 1024;

export interface CachedAsset {
  readonly id: string;
  readonly symbol: string;
  readonly name: string;
  readonly issuerID: string | null;
  readonly isEquity: boolean;
}

export interface CachedIntelligence {
  readonly kind: CachedKind;
  readonly insights: readonly Insight[];
  readonly events: EventBatch | null;
  readonly assets: readonly CachedAsset[];
  readonly watchedIDs: readonly string[];
  readonly ledgerFingerprint: string | null;
  readonly marketFingerprint: string | null;
  readonly savedAt: EpochMs;
  readonly expiresAt: EpochMs;
}

/** iOS `InsightPersonalization.observedAt`: the evidence instant a reader would quote. */
export function insightObservedAt(insight: Insight): EpochMs {
  switch (insight.fact.kind) {
    case "watchlistInformation":
      return insight.fact.value.publishedAt;
    case "portfolioPerformance":
      return insight.fact.value.lastObservedAt;
    case "portfolioAllocation":
      return insight.fact.value.observedAt;
    default:
      return insight.provenance.observations.length ? Math.max(...insight.provenance.observations.map((row) => row.observedAt)) : -Infinity;
  }
}

const max = (values: readonly number[]) => (values.length ? Math.max(...values) : undefined);
const min = (values: readonly number[]) => (values.length ? Math.min(...values) : undefined);

export const readingGeneratedAt = (reading: CachedIntelligence): EpochMs =>
  max(reading.insights.map((insight) => insight.generatedAt)) ?? reading.events?.fetchedAt ?? reading.savedAt;

export const readingObservedAt = (reading: CachedIntelligence): EpochMs =>
  max(reading.insights.map(insightObservedAt)) ?? max(reading.events?.events.map((event) => event.updatedAt) ?? []) ?? readingGeneratedAt(reading);

export const readingFetchedAt = (reading: CachedIntelligence): EpochMs =>
  min(reading.insights.map((insight) => insight.provenance.fetchedAt)) ?? reading.events?.fetchedAt ?? reading.savedAt;

// MARK: Fingerprints

/** Sorted-key JSON; decimals by their exact text. */
function canonical(value: unknown): string {
  if (Decimal.isDecimal(value)) return JSON.stringify((value as Decimal).toString());
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74,
  0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d,
  0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e,
  0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** Synchronous SHA-256 (hex), so a render can compare fingerprints without awaiting Web Crypto. */
export function sha256Hex(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const length = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(length);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(length - 8, Math.floor((bytes.length * 8) / 2 ** 32));
  view.setUint32(length - 4, (bytes.length * 8) >>> 0);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let offset = 0; offset < length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      [hh, g, f, e, d, c, b, a] = [g, f, e, (d + t1) >>> 0, c, b, a, (t1 + t2) >>> 0];
    }
    [a, b, c, d, e, f, g, hh].forEach((value, i) => (h[i] = (h[i] + value) >>> 0));
  }
  return [...h].map((value) => value.toString(16).padStart(8, "0")).join("");
}

export const fingerprint = (value: unknown) => sha256Hex(canonical(value));

export const ledgerFingerprint = (transactions: readonly PortfolioTransaction[]) =>
  fingerprint([...transactions].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)));

/** Public quote revision metadata only: no watchlist flags, alert settings or chart arrays. */
export function marketFingerprint(securities: readonly MarketSecurity[]): string {
  const quotes = [...securities]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((security) => ({
      id: security.id,
      price: security.price,
      observedAt: security.quoteQuality?.observedAt ?? null,
      quality: security.quoteQuality?.status ?? null,
    }));
  return fingerprint(quotes);
}

// MARK: Readings

export interface ReadingInput {
  readonly kind: Exclude<CachedKind, "weekAhead">;
  readonly insights: readonly Insight[];
  readonly securities: readonly MarketSecurity[];
  readonly watchedIDs?: Iterable<string>;
  readonly transactions?: readonly PortfolioTransaction[] | null;
  readonly now: EpochMs;
}

export function makeReading({ kind, insights, securities, watchedIDs = [], transactions = null, now }: ReadingInput): CachedIntelligence {
  const fetchedAt = min(insights.map((insight) => insight.provenance.fetchedAt)) ?? now;
  return {
    kind,
    insights,
    events: null,
    assets: securities
      .filter((security) => isVisibleOutsideSearch(security, now))
      .map((security) => ({
        id: security.id,
        symbol: security.symbol,
        name: security.name,
        issuerID: security.issuerID ?? null,
        isEquity: security.kind === "equity",
      })),
    watchedIDs: [...new Set(watchedIDs)].sort(),
    ledgerFingerprint: transactions ? ledgerFingerprint(transactions) : null,
    marketFingerprint: marketFingerprint(securities),
    savedAt: now,
    expiresAt: fetchedAt + READING_MAXIMUM_AGE,
  };
}

export function weekAheadReading(batch: EventBatch, now: EpochMs): CachedIntelligence {
  return {
    kind: "weekAhead",
    insights: [],
    events: { events: batch.events, fetchedAt: batch.fetchedAt },
    assets: [],
    watchedIDs: [],
    ledgerFingerprint: null,
    marketFingerprint: null,
    savedAt: Math.max(now, batch.fetchedAt),
    expiresAt: batch.fetchedAt + REPLAY_AGE,
  };
}

export interface ReadingFingerprints {
  readonly ledger?: string | null;
  readonly watchlist?: Iterable<string> | null;
  readonly market?: string | null;
}

const sameSet = (a: readonly string[], b: Iterable<string>) => {
  const other = new Set(b);
  return other.size === new Set(a).size && a.every((id) => other.has(id));
};

export function isUsable(reading: CachedIntelligence, now: EpochMs, { ledger, watchlist, market }: ReadingFingerprints = {}): boolean {
  const maximumAge = reading.kind === "weekAhead" ? WEEK_AHEAD_MAXIMUM_AGE : READING_MAXIMUM_AGE;
  const generatedAt = readingGeneratedAt(reading);
  const observedAt = readingObservedAt(reading);
  const fetchedAt = readingFetchedAt(reading);
  return (
    [now, reading.savedAt, generatedAt, observedAt, fetchedAt, reading.expiresAt].every(Number.isFinite) &&
    generatedAt <= reading.savedAt &&
    fetchedAt <= reading.savedAt &&
    observedAt <= reading.savedAt &&
    reading.savedAt <= now &&
    now < reading.expiresAt &&
    reading.expiresAt <= fetchedAt + maximumAge &&
    (ledger == null || ledger === reading.ledgerFingerprint) &&
    (watchlist == null || sameSet(reading.watchedIDs, watchlist)) &&
    (market == null || market === reading.marketFingerprint)
  );
}

export type ReplaySurface = "portfolio" | "watchlist";

/** iOS `InsightPersonalization.Context` as replay needs it. */
export interface ReplayEligibilityContext {
  readonly now: EpochMs;
  readonly heldIDs: ReadonlySet<string>;
  readonly watchedIDs: ReadonlySet<string>;
  readonly availableAssetIDs: ReadonlySet<string>;
}

/** Personalisation's `eligible(insight, context, surface)` (iOS `InsightPersonalization.eligible`). */
export type InsightEligibility = (insight: Insight, context: ReplayEligibilityContext, surface: ReplaySurface) => boolean;

export interface ReplayOptions extends ReadingFingerprints {
  readonly availability: IntelligenceAvailability;
  readonly eligible: InsightEligibility;
}

/** A completed reading inspected at its original generation time. No fact timestamps change. */
export function replay(reading: CachedIntelligence, now: EpochMs, { availability, eligible, ...fingerprints }: ReplayOptions): Insight[] {
  if (!isUsable(reading, now, fingerprints)) return [];
  const portfolio = reading.kind === "portfolio";
  const available = new Set(reading.assets.map((asset) => asset.id));
  const watched = new Set(reading.watchedIDs);
  return reading.insights.filter(
    (insight) =>
      permitsInsightType(availability, insight.type) &&
      insight.category === (portfolio ? "portfolio" : "watchlist") &&
      insight.period.endExclusive <= reading.savedAt &&
      eligible(
        insight,
        { now: insight.generatedAt, heldIDs: new Set(portfolio ? insight.relatedAssetIDs : []), watchedIDs: watched, availableAssetIDs: available },
        portfolio ? "portfolio" : "watchlist",
      ),
  );
}

// MARK: Encoding

const DECIMAL_TAG = "$decimal";

/** Decimals become `{ "$decimal": "4.8" }`, so they round-trip exactly through JSON and IndexedDB. */
export function encodeExact(value: unknown): unknown {
  if (Decimal.isDecimal(value)) return { [DECIMAL_TAG]: (value as Decimal).toString() };
  if (Array.isArray(value)) return value.map(encodeExact);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, encodeExact(entry)]),
    );
  }
  return value;
}

export function decodeExact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeExact);
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record);
    if (keys.length === 1 && keys[0] === DECIMAL_TAG && typeof record[DECIMAL_TAG] === "string") return new Dec(record[DECIMAL_TAG]);
    return Object.fromEntries(keys.map((key) => [key, decodeExact(record[key])]));
  }
  return value;
}

const isReading = (value: unknown): value is CachedIntelligence => {
  if (typeof value !== "object" || value === null) return false;
  const reading = value as Record<string, unknown>;
  return (
    (CACHED_KINDS as readonly unknown[]).includes(reading.kind) &&
    Array.isArray(reading.insights) &&
    Array.isArray(reading.assets) &&
    Array.isArray(reading.watchedIDs) &&
    typeof reading.savedAt === "number" &&
    typeof reading.expiresAt === "number"
  );
};

// MARK: Account-scoped cache

/** Where envelopes live: IndexedDB in the browser, a map in tests. Every method may fail. */
export interface CacheBackend {
  get(key: string): Promise<string | undefined>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  /** Removes every key starting with the prefix (an account), or everything without one. */
  clear(prefix?: string): Promise<void>;
}

export interface CacheLease {
  readonly generation: number;
  readonly scopes: ReadonlyMap<string, number>;
}

const scope = (userID: string, kind: CachedKind) => `${userID.toLowerCase()}:${kind}`;

/**
 * Small account-scoped completed readings. Sign-out and mutations revoke in-flight saves through leases; a
 * `currentUser` check after every await drops results that belong to an account no longer signed in.
 */
export class IntelligenceCache {
  private generation = 0;
  private counter = 0;
  private readonly scopes = new Map<string, number>();
  private readonly deleted = new Set<string>();
  private readonly backend: CacheBackend;
  private readonly currentUser: () => string | null;

  constructor(backend: CacheBackend, currentUser: () => string | null = () => null) {
    this.backend = backend;
    this.currentUser = currentUser;
  }

  lease(): CacheLease {
    return { generation: this.generation, scopes: new Map(this.scopes) };
  }

  private stillCurrent(userID: string): boolean {
    const current = this.currentUser();
    return current === null || current.toLowerCase() === userID.toLowerCase();
  }

  async load(userID: string, kind: CachedKind, now: EpochMs): Promise<CachedIntelligence | null> {
    const owner = userID.toLowerCase();
    if (this.deleted.has(owner)) return null;
    const key = scope(owner, kind);
    let text: string | undefined;
    try {
      text = await this.backend.get(key);
    } catch {
      return null;
    }
    if (!this.stillCurrent(owner) || this.deleted.has(owner) || text === undefined) return null;
    let reading: CachedIntelligence | null = null;
    try {
      if (text.length <= CACHE_MAXIMUM_BYTES) {
        const envelope = decodeExact(JSON.parse(text)) as { ownerID?: unknown; reading?: unknown };
        if (envelope.ownerID === owner && isReading(envelope.reading) && envelope.reading.kind === kind) reading = envelope.reading;
      }
    } catch {
      reading = null;
    }
    if (!reading || !isUsable(reading, now)) {
      await this.backend.delete(key).catch(() => undefined);
      return null;
    }
    return reading;
  }

  async save(reading: CachedIntelligence, userID: string, lease: CacheLease): Promise<boolean> {
    const owner = userID.toLowerCase();
    const key = scope(owner, reading.kind);
    if (
      lease.generation !== this.generation ||
      lease.scopes.get(key) !== this.scopes.get(key) ||
      this.deleted.has(owner) ||
      !isUsable(reading, reading.savedAt)
    ) {
      return false;
    }
    const text = JSON.stringify(encodeExact({ ownerID: owner, reading }));
    if (text.length > CACHE_MAXIMUM_BYTES || !this.stillCurrent(owner)) return false;
    try {
      await this.backend.put(key, text);
    } catch {
      return false;
    }
    // A revocation that raced the write wins: the row it would have kept is removed again.
    if (lease.generation !== this.generation || lease.scopes.get(key) !== this.scopes.get(key) || this.deleted.has(owner) || !this.stillCurrent(owner)) {
      await this.backend.delete(key).catch(() => undefined);
      return false;
    }
    return true;
  }

  async invalidate(userID: string, kind: CachedKind): Promise<void> {
    const key = scope(userID, kind);
    this.scopes.set(key, ++this.counter);
    await this.backend.delete(key).catch(() => undefined);
  }

  /** Sign-out: every account's readings go, and every outstanding lease is void. */
  async clear(): Promise<void> {
    this.generation = ++this.counter;
    this.scopes.clear();
    await this.backend.clear().catch(() => undefined);
  }

  async reconcileLedger(transactions: readonly PortfolioTransaction[], userID: string, now: EpochMs): Promise<void> {
    const reading = await this.load(userID, "portfolio", now);
    if (reading && !isUsable(reading, now, { ledger: ledgerFingerprint(transactions) })) await this.invalidate(userID, "portfolio");
  }

  async reconcileMarket(revision: string | null, watchedIDs: Iterable<string>, userID: string, now: EpochMs): Promise<void> {
    const watched = [...watchedIDs];
    for (const kind of ["portfolio", "watchlist"] as const) {
      const reading = await this.load(userID, kind, now);
      if (reading && !isUsable(reading, now, { watchlist: kind === "watchlist" ? watched : null, market: revision })) await this.invalidate(userID, kind);
    }
  }

  async deleteAccount(userID: string): Promise<void> {
    const owner = userID.toLowerCase();
    this.deleted.add(owner);
    await this.backend.clear(`${owner}:`).catch(() => undefined);
  }
}

/**
 * The week ahead through the cache (iOS `MarketEventStore.load(userID:)`): a fresh read is saved for a day; a
 * failed read replays the saved batch, marked cached, while it is still replayable.
 */
export async function loadWeekAhead(cache: IntelligenceCache, userID: string, now: EpochMs, fetch: () => Promise<EventBatch>): Promise<EventBatch> {
  const lease = cache.lease();
  try {
    const batch = await fetch();
    await cache.save(weekAheadReading(batch, now), userID, lease);
    return batch;
  } catch (error) {
    const reading = await cache.load(userID, "weekAhead", now);
    const batch = reading?.events;
    if (!batch || !isReplayableBatch(batch, now)) throw error;
    return { events: batch.events, fetchedAt: batch.fetchedAt, isCached: true };
  }
}
