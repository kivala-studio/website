import { describe, expect, it } from "vitest";

import type { InsightPeriod } from "../intelligence/models";
import { DAY_MS, startOfDay } from "../market/zone";
import { ContentExposureStore, type PersonalisationAggregate, type PersonalisationRepository, PersonalisationStore, memoryStorage } from ".";

// Ports `PersonalisationTests`.

const fixedNow = Date.parse("2026-09-27T12:00:00Z");
/** The latest completed trading week as of `fixedNow` (Monday to Monday, Luanda). */
const latest: InsightPeriod = { start: Date.parse("2026-09-21T00:00:00+01:00"), endExclusive: Date.parse("2026-09-28T00:00:00+01:00") };
const HOUR = 3_600_000;

const makeStore = (now = fixedNow) => {
  const storage = memoryStorage();
  return new PersonalisationStore(storage, new ContentExposureStore(storage), () => now);
};

class RepositoryStub implements PersonalisationRepository {
  private readonly rows = new Map<string, PersonalisationAggregate>();
  async upsert(values: readonly PersonalisationAggregate[]) {
    for (const row of values)
      this.rows.set([row.userID, row.installationID, row.activityDay, row.kind, row.securityID, row.relatedSecurityID, row.variant].join("|"), row);
  }
  async fetch(userID: string, sinceDay: string) {
    return [...this.rows.values()].filter((row) => row.userID === userID && row.activityDay >= sinceDay);
  }
}

describe("PersonalisationStore", () => {
  it("excludes days outside the week and debounces repeated views", () => {
    const store = makeStore();
    const period = { start: latest.start - 7 * DAY_MS, endExclusive: latest.endExclusive - 7 * DAY_MS };
    const first = period.start + 10 * HOUR;
    const second = first + DAY_MS;
    const outside = period.endExclusive + DAY_MS;
    const user = "user-1";
    store.record({ type: "assetViewed", securityID: "AAA", at: first }, user);
    store.record({ type: "assetViewed", securityID: "AAA", at: first + 5 * 60_000 }, user);
    store.record({ type: "assetViewed", securityID: "AAA", at: first + 31 * 60_000 }, user);
    store.record({ type: "assetViewed", securityID: "AAA", at: second }, user);
    store.record({ type: "assetViewed", securityID: "BBB", at: first }, user);
    store.record({ type: "assetViewed", securityID: "CCC", at: outside }, user);
    const result = store.snapshot(user, period, new Set(["BBB"]), new Set(["CCC"]));
    expect(result.uniqueAssetsViewed).toBe(2);
    expect(result.mostViewedAssetID).toBe("AAA");
    expect(result.mostViewedCount).toBe(3);
    expect(result.mostViewedDays).toBe(2);
    expect(result.relevantAssetIDs.slice(0, 3)).toEqual(["CCC", "BBB", "AAA"]);
  });

  it("reconciles daily counters across installations without double counting", async () => {
    const first = makeStore();
    const second = makeStore();
    const repository = new RepositoryStub();
    const user = "user-1";
    const assetID = crypto.randomUUID().toUpperCase();
    const relatedID = crypto.randomUUID().toUpperCase();
    const viewedAt = latest.start + 10 * HOUR;
    first.record({ type: "assetViewed", securityID: assetID, at: viewedAt }, user);
    first.record({ type: "assetViewed", securityID: assetID, at: viewedAt + 31 * 60_000 }, user);
    second.record({ type: "assetViewed", securityID: assetID, at: viewedAt }, user);
    second.record({ type: "searchSelected", securityID: assetID, at: viewedAt }, user);
    second.record({ type: "comparisonCreated", primaryID: assetID, relatedID, at: viewedAt }, user);
    await first.sync(user, repository);
    await second.sync(user, repository);
    await first.sync(user, repository);
    const result = first.snapshot(user, latest, new Set(), new Set());
    expect(result.uniqueAssetsViewed).toBe(1);
    expect(result.mostViewedCount).toBe(3);
    expect(result.mostViewedDays).toBe(1);
    expect(result.searchSelections).toBe(1);
    expect(result.comparisons).toBe(1);
    expect(result.relevantAssetIDs[0]).toBe(assetID.toLowerCase());
  });

  it("stops a sync pass when the account is no longer current", async () => {
    const store = makeStore();
    const repository = new RepositoryStub();
    const id = crypto.randomUUID();
    store.record({ type: "assetViewed", securityID: id, at: fixedNow }, "user-1");
    await store.sync("user-1", repository, () => false);
    expect(await repository.fetch("user-1", "2000-01-01")).toHaveLength(1);
    const day: InsightPeriod = { start: startOfDay(fixedNow), endExclusive: startOfDay(fixedNow) + DAY_MS };
    expect(store.snapshot("user-1", day, new Set(), new Set()).mostViewedCount).toBe(1);
  });

  it("rejects future, expired and malformed events, isolates accounts and clears", () => {
    const store = makeStore();
    const user = "user-1";
    const period: InsightPeriod = { start: startOfDay(fixedNow), endExclusive: startOfDay(fixedNow) + DAY_MS };
    store.record({ type: "assetViewed", securityID: "future", at: fixedNow + 1000 }, user);
    store.record({ type: "assetViewed", securityID: "expired", at: fixedNow - 113 * DAY_MS }, user);
    store.record({ type: "assetViewed", securityID: "malformed", at: Number.NaN }, user);
    store.record({ type: "assetViewed", securityID: "valid", at: fixedNow }, user);
    const result = store.snapshot(user, period, new Set(), new Set(), fixedNow);
    expect(result.mostViewedCount).toBe(1);
    expect(result.relevantAssetIDs).toEqual(["valid"]);
    expect(store.snapshot("user-2", period, new Set(), new Set(), fixedNow).relevantAssetIDs).toEqual([]);
    store.clear(user);
    expect(store.snapshot(user, period, new Set(), new Set(), fixedNow).relevantAssetIDs).toEqual([]);
  });

  it("prunes inactive local history", () => {
    const store = makeStore();
    const user = "user-1";
    store.record({ type: "assetViewed", securityID: "asset", at: fixedNow }, user);
    const period: InsightPeriod = { start: startOfDay(fixedNow), endExclusive: startOfDay(fixedNow) + DAY_MS };
    const result = store.snapshot(user, period, new Set(), new Set(), fixedNow + 113 * DAY_MS);
    expect(result.uniqueAssetsViewed).toBe(0);
    expect(result.relevantAssetIDs).toEqual([]);
  });

  it("drops Wrap lifecycle events whose period key is not a Luanda Monday", async () => {
    const store = makeStore();
    const repository = new RepositoryStub();
    const user = "user-1";
    store.record({ type: "weeklyWrap", event: "wrap_completed", periodKey: "weekly-2026-09-22", at: fixedNow }, user);
    store.record({ type: "weeklyWrap", event: "wrap_completed", periodKey: "weekly-2026-09-21", at: fixedNow }, user);
    store.record({ type: "wrapOpened", at: fixedNow }, user);
    await store.sync(user, repository);
    expect((await repository.fetch(user, "2000-01-01")).map((row) => `${row.kind}:${row.variant}`).sort()).toEqual([
      "wrap_completed:weekly-2026-09-21",
      "wrap_open:",
    ]);
  });
});
