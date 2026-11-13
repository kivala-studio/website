import { describe, expect, it } from "vitest";

import { parseInstant } from "../market/zone";
import type { PortfolioTransaction } from "../portfolio/models";
import { type EventBatch, type MarketEvent, nextWeek, selectWeek } from "../week-ahead/week-ahead";
import {
  type CacheBackend,
  type CachedIntelligence,
  type CachedKind,
  type InsightEligibility,
  IntelligenceCache,
  decodeExact,
  encodeExact,
  fingerprint,
  isUsable,
  ledgerFingerprint,
  loadWeekAhead,
  readingFetchedAt,
  readingGeneratedAt,
  replay,
  sha256Hex,
} from "./cache";
import { DEFAULT_AVAILABILITY } from "./feature-controls";
import { Dec } from "./math";
import type { FinancialFact, Insight, InsightPriceObservation } from "./models";

/* Port of Tests/MarketDiscoveryTests/IntelligenceCacheTests.swift. Files on disk become a backend map. */

const now = parseInstant("2026-09-27T11:00:00+01:00")!;
const user = "6f9619ff-8b86-4011-b42d-00c04fc964ff";
const other = "1b4e28ba-2fa1-11d2-883f-0016d3cca427";

class MemoryBackend implements CacheBackend {
  values = new Map<string, string>();
  get = async (key: string) => this.values.get(key);
  put = async (key: string, value: string) => void this.values.set(key, value);
  delete = async (key: string) => void this.values.delete(key);
  clear = async (prefix?: string) => {
    for (const key of [...this.values.keys()]) if (!prefix || key.startsWith(prefix)) this.values.delete(key);
  };
}

/** The personalisation gate replay defers to, reduced to what these cases exercise. */
const eligible: InsightEligibility = (insight, context) =>
  insight.generatedAt <= context.now &&
  context.now < insight.expiresAt &&
  insight.relatedAssetIDs.every((id) => context.availableAssetIDs.has(id)) &&
  (insight.category !== "watchlist" || insight.relatedAssetIDs.every((id) => context.watchedIDs.has(id))) &&
  (insight.category !== "portfolio" || insight.relatedAssetIDs.some((id) => context.heldIDs.has(id)));
const options = { availability: DEFAULT_AVAILABILITY, eligible };

const trade = (quantity: number): PortfolioTransaction => ({
  id: "trade",
  securityId: "BAI",
  kind: "buy",
  quantity: new Dec(quantity),
  unitPrice: new Dec(100),
  fees: new Dec(0),
  tradedOn: "2026-09-19",
  createdAt: "2026-09-19T10:00:00+01:00",
});

function reading(kind: Exclude<CachedKind, "weekAhead"> = "watchlist", percentage = "4.8", insights?: Insight[]): CachedIntelligence {
  const pct = new Dec(percentage);
  const observation: InsightPriceObservation = {
    recordID: "row",
    assetID: "BAI",
    currencyCode: "AOA",
    price: pct.plus(100),
    observedAt: now - 3_600_000,
    collectedAt: now - 3_500_000,
    source: { dataset: "price_history.close", ingestionRunID: "run", contentHash: fingerprint(pct), parserVersion: "v1" },
    isFinal: true,
    dataQuality: { status: "valid", reasons: [] },
  };
  const period = { start: now - 7 * 86_400_000, endExclusive: now - 60_000 };
  const fact: FinancialFact =
    kind === "portfolio"
      ? {
          kind: "portfolioPerformance",
          value: {
            startValue: new Dec(200),
            endValue: pct.times(2).plus(200),
            change: pct.times(2),
            percentage: pct,
            firstObservedAt: period.start,
            lastObservedAt: observation.observedAt,
            positions: [],
            advancing: 1,
            declining: 0,
            unchanged: 0,
          },
        }
      : {
          kind: "priceChange",
          value: {
            assetID: "BAI",
            currencyCode: "AOA",
            startPrice: new Dec(100),
            endPrice: pct.plus(100),
            percentageChange: pct,
            firstObservedAt: period.start,
            lastObservedAt: observation.observedAt,
          },
        };
  const insight: Insight = {
    id: "same-period-BAI",
    type: kind === "portfolio" ? "portfolioPricePerformance" : "assetPriceChange",
    category: kind,
    fact,
    generatedAt: now,
    period,
    expiresAt: now + 900_000,
    relatedAssetIDs: ["BAI"],
    relevance: { isHeld: kind === "portfolio", isWatched: kind === "watchlist", activityRank: null },
    destination: { kind: "portfolio" },
    provenance: {
      calculationID: "weekly-performance",
      calculationVersion: 2,
      calendarVersion: "v1",
      observations: [observation],
      fetchedAt: now,
      completeness: "completeExpectedSessions",
      portfolio: kind === "portfolio" ? { week: period, transactions: [trade(2)], securities: [], ledgerFetchedAt: now, metadataFetchedAt: now } : null,
    },
  };
  return {
    kind,
    insights: insights ?? [insight],
    events: null,
    assets: [{ id: "BAI", symbol: "BAI", name: "BAI", issuerID: "issuer", isEquity: true }],
    watchedIDs: ["BAI"],
    ledgerFingerprint: kind === "portfolio" ? ledgerFingerprint([trade(2)]) : null,
    marketFingerprint: "original-market-revision",
    savedAt: now,
    expiresAt: now + 7 * 86_400_000,
  };
}

const percentOf = (value: Insight | undefined) =>
  value?.fact.kind === "priceChange"
    ? value.fact.value.percentageChange.toString()
    : value?.fact.kind === "portfolioPerformance"
      ? value.fact.value.percentage.toString()
      : null;

describe("intelligence cache", () => {
  it("restores evidence and versions on a cold start, for the owner only", async () => {
    const backend = new MemoryBackend();
    const cache = new IntelligenceCache(backend);
    const saved = reading();
    expect(await cache.save(saved, user, cache.lease())).toBe(true);
    const restarted = new IntelligenceCache(backend);
    const restored = (await restarted.load(user, "watchlist", now + 3_600_000))!;
    expect(restored).not.toBeNull();
    expect(encodeExact(restored.insights)).toEqual(encodeExact(saved.insights));
    expect(readingGeneratedAt(restored)).toBe(now);
    expect(readingFetchedAt(restored)).toBe(now);
    expect(restored.insights[0].provenance.calculationVersion).toBe(2);
    expect(restored.insights[0].expiresAt).toBe(now + 900_000);
    expect(replay(restored, now + 3_600_000, options)).toHaveLength(1);
    expect(await restarted.load(other, "watchlist", now)).toBeNull();
  });

  it("never turns a stale reading into an active insight and rejects an expired cache", async () => {
    const cache = new IntelligenceCache(new MemoryBackend());
    const saved = reading();
    await cache.save(saved, user, cache.lease());
    const stale = now + 3_600_000;
    const fact = saved.insights[0];
    expect(eligible(fact, { now: stale, heldIDs: new Set(), watchedIDs: new Set(["BAI"]), availableAssetIDs: new Set(["BAI"]) }, "watchlist")).toBe(false);
    expect(replay(saved, stale, options)).toHaveLength(1);
    expect(replay(saved, saved.expiresAt, options)).toEqual([]);
    expect(await cache.load(user, "watchlist", saved.expiresAt)).toBeNull();
    expect(isUsable(saved, now - 1)).toBe(false);
  });

  it("withdraws saved facts after a ledger change, a removed watchlist or a market revision", async () => {
    const cache = new IntelligenceCache(new MemoryBackend());
    const portfolio = reading("portfolio");
    await cache.save(portfolio, user, cache.lease());
    expect(replay(portfolio, now, { ...options, ledger: ledgerFingerprint([trade(2)]) })).toHaveLength(1);
    expect(replay(portfolio, now, { ...options, ledger: ledgerFingerprint([trade(3)]) })).toEqual([]);
    await cache.reconcileLedger([trade(3)], user, now);
    expect(await cache.load(user, "portfolio", now)).toBeNull();
    expect(replay(reading(), now, { ...options, watchlist: [] })).toEqual([]);
    expect(replay(reading(), now, { ...options, market: "new-market-revision" })).toEqual([]);
    const lease = cache.lease();
    await cache.save(reading(), user, lease);
    await cache.reconcileMarket("new-market-revision", ["BAI"], user, now);
    expect(await cache.load(user, "watchlist", now)).toBeNull();
    expect(await cache.save(reading(), user, lease)).toBe(false);
  });

  it("does not let an unrelated watchlist invalidation block a portfolio correction", async () => {
    const cache = new IntelligenceCache(new MemoryBackend());
    const lease = cache.lease();
    await cache.save(reading("portfolio", "4.8"), user, lease);
    await cache.invalidate(user, "watchlist");
    expect(await cache.save(reading("portfolio", "4.2"), user, lease)).toBe(true);
    const value = await cache.load(user, "portfolio", now);
    expect(percentOf(value?.insights[0])).toBe("4.2");
  });

  it("revokes in-flight writes on sign-out and account deletion", async () => {
    const cache = new IntelligenceCache(new MemoryBackend());
    const lease = cache.lease();
    await cache.save(reading(), user, lease);
    await cache.clear();
    expect(await cache.save(reading(), user, lease)).toBe(false);
    expect(await cache.load(user, "watchlist", now)).toBeNull();
    await cache.deleteAccount(user);
    expect(await cache.save(reading(), user, cache.lease())).toBe(false);
  });

  it("replaces the same fact after a correction and lets an authoritative withdrawal win", async () => {
    const cache = new IntelligenceCache(new MemoryBackend());
    await cache.save(reading("watchlist", "4.8"), user, cache.lease());
    await cache.save(reading("watchlist", "4.2"), user, cache.lease());
    const latest = replay((await cache.load(user, "watchlist", now))!, now, options);
    expect(latest.map((insight) => insight.id)).toEqual(["same-period-BAI"]);
    expect(percentOf(latest[0])).toBe("4.2");
    await cache.save(reading("watchlist", "4.8", []), user, cache.lease());
    expect(replay((await cache.load(user, "watchlist", now))!, now, options)).toEqual([]);
  });

  it("drops results for an account that signed out while a read was pending", async () => {
    const backend = new MemoryBackend();
    let current: string | null = user;
    const cache = new IntelligenceCache(backend, () => current);
    await cache.save(reading(), user, cache.lease());
    const pending = cache.load(user, "watchlist", now);
    current = other;
    expect(await pending).toBeNull();
  });

  it("replays the week ahead offline, expires it after a day and takes a correction on reconnect", async () => {
    const backend = new MemoryBackend();
    const cache = new IntelligenceCache(backend);
    const event: MarketEvent = {
      id: "event",
      kind: "dividend",
      title: "Pagamento anunciado",
      timing: { kind: "day", day: "2026-09-28" },
      issuer: { id: "issuer", name: "Emitente" },
      relatedSecurityIDs: [],
      status: "confirmed",
      importance: "issuerSpecific",
      updatedAt: now - 60_000,
      sources: [{ dataset: "issuer_dividends", recordID: "event", name: "Emitente", url: "https://issuer.ao/notice", retrievedAt: now }],
      metadata: { kind: "dividend", fiscalYear: 2025, milestone: "payment" },
    };
    const remote = { batch: { events: [event], fetchedAt: now } as EventBatch, offline: false };
    const fetch = async () => {
      if (remote.offline) throw new Error("offline");
      return remote.batch;
    };
    const first = await loadWeekAhead(cache, user, now, fetch);
    expect(first.isCached).toBeFalsy();
    remote.offline = true;
    const later = now + 3_600_000;
    const offline = await loadWeekAhead(cache, user, later, fetch);
    expect(offline.isCached).toBe(true);
    expect(offline.fetchedAt).toBe(now);
    const restored = await loadWeekAhead(new IntelligenceCache(backend), user, later, fetch);
    const period = nextWeek(now)!;
    const selected = selectWeek(restored, { now: later, period, heldIDs: new Set(), watchedIDs: new Set(), securities: [], hidesPersonalValues: false });
    expect(selected.ranked).toHaveLength(1);
    await expect(loadWeekAhead(new IntelligenceCache(backend), user, now + 86_400_000, fetch)).rejects.toThrow();
    remote.batch = { events: [], fetchedAt: later };
    remote.offline = false;
    const corrected = await loadWeekAhead(cache, user, later, fetch);
    expect(corrected.isCached).toBeFalsy();
    expect(corrected.events).toEqual([]);
    remote.offline = true;
    expect((await loadWeekAhead(cache, user, later + 600_000, fetch)).events).toEqual([]);
  });

  it("keeps decimals exact through the encoding and hashes like SHA-256", () => {
    const value = { a: new Dec("0.1000000000000000000000000000000000001"), b: [new Dec("-3")] };
    const decoded = decodeExact(JSON.parse(JSON.stringify(encodeExact(value)))) as typeof value;
    expect(decoded.a.toString()).toBe("0.1000000000000000000000000000000000001");
    expect(decoded.a.equals(value.a)).toBe(true);
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256Hex("a".repeat(1000))).toBe("41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3");
  });
});
