import { describe, expect, it } from "vitest";

import type { PortfolioTransaction } from "../portfolio/models";
import {
  EMPTY_ARCHIVE,
  type InsightItemDependencies,
  LOCAL_ACTIVITY_MAXIMUM_ITEMS,
  LOCAL_ACTIVITY_RETENTION,
  type LocalActivityArchive,
  decodeArchive,
  encodeArchive,
  insightItems,
  isLocalVisible,
  localActivityRows,
  markArchiveRead,
  mergeActivityCentre,
  mergeArchive,
  pruneArchive,
  reconcileArchive,
} from "./activity";
import { Dec } from "./math";
import type { FinancialFact, Insight, InsightType } from "./models";

/* The insight cases of Tests/MarketDiscoveryTests/ActivityCenterTests.swift. Ranking and receipt keys belong to
 * personalisation; these cases inject a pass-through ranking and asset-level price receipts. */

const now = 1_790_415_000_000;
const asset = "d49c260e-999d-4470-a7e1-041ba6618749";
const watched = new Set([asset]);
const dependencies: InsightItemDependencies = {
  rank: (insights, _profile, _now, limit) => insights.slice(0, limit),
  receiptKeys: (insight) => (insight.category === "watchlist" ? insight.relatedAssetIDs.map((id) => `price:${id}`) : []),
};
const transaction: PortfolioTransaction = {
  id: "purchase",
  securityId: asset,
  kind: "buy",
  quantity: new Dec(1),
  unitPrice: new Dec(100),
  fees: new Dec(0),
  tradedOn: "2026-09-07",
  createdAt: "2026-09-07T10:00:00+01:00",
};

function insight(
  id: string,
  type: InsightType,
  fact: FinancialFact,
  options: { version?: number; fetchedAt?: number; expiresAt?: number; generatedAt?: number } = {},
): Insight {
  const portfolio = fact.kind === "portfolioPerformance";
  return {
    id,
    type,
    category: portfolio || fact.kind === "portfolioAllocation" ? "portfolio" : "watchlist",
    fact,
    generatedAt: options.generatedAt ?? now,
    period: { start: now - 5 * 86_400_000, endExclusive: now },
    expiresAt: options.expiresAt ?? now + 900_000,
    relatedAssetIDs: [asset],
    relevance: { isHeld: portfolio, isWatched: !portfolio, activityRank: null },
    destination: portfolio ? { kind: "portfolio" } : { kind: "asset", assetID: asset },
    provenance: {
      calculationID: "fixture",
      calculationVersion: options.version ?? 1,
      calendarVersion: "v1",
      observations: [
        {
          recordID: "verified-close",
          assetID: asset,
          currencyCode: "AOA",
          price: new Dec(100),
          observedAt: now - 3_600_000,
          collectedAt: now - 3_500_000,
          source: { dataset: "daily_market_data", ingestionRunID: "fixture" },
          isFinal: true,
        },
      ],
      fetchedAt: options.fetchedAt ?? now,
      completeness: "completeExpectedSessions",
      portfolio: portfolio
        ? {
            week: { start: now - 5 * 86_400_000, endExclusive: now },
            transactions: [transaction],
            securities: [],
            ledgerFetchedAt: now,
            metadataFetchedAt: now,
          }
        : null,
    },
  };
}

const movement = (id = "movement", percentage = 5, options: Parameters<typeof insight>[3] = {}) =>
  insight(
    id,
    "watchlistMovement",
    {
      kind: "watchlistMovement",
      value: {
        movement: {
          assetID: asset,
          currencyCode: "AOA",
          startPrice: new Dec(100),
          endPrice: new Dec(100 + percentage),
          percentageChange: new Dec(percentage),
          firstObservedAt: now - 6 * 86_400_000,
          lastObservedAt: now - 3_600_000,
        },
        comparedAssetIDs: [asset],
      },
    },
    options,
  );

const portfolio = () =>
  insight("portfolio", "portfolioPricePerformance", {
    kind: "portfolioPerformance",
    value: {
      startValue: new Dec(999999),
      endValue: new Dec("1049998.95"),
      change: new Dec("49999.95"),
      percentage: new Dec(5),
      firstObservedAt: now - 6 * 86_400_000,
      lastObservedAt: now - 3_600_000,
      positions: [],
      advancing: 1,
      declining: 0,
      unchanged: 0,
    },
  });

const items = (source: Insight) => insightItems([source], watched, now, dependencies);
const context = { watchedIDs: watched, portfolioTransactions: null };

describe("local insights in the Activity centre", () => {
  it("requires fresh, current, verified facts", () => {
    expect(items(movement())).toHaveLength(1);
    expect(items(movement("m", 5, { fetchedAt: now - 901_000 }))).toEqual([]);
    expect(items(movement("m", 5, { expiresAt: now }))).toEqual([]);
    expect(items(movement("m", 5, { generatedAt: now + 1000 }))).toEqual([]);
  });

  it("publishes weekly performance but never allocation", () => {
    expect(insightItems([portfolio()], new Set(), now, dependencies)).toHaveLength(1);
    const allocation = insight("allocation", "portfolioAllocation", {
      kind: "portfolioAllocation",
      value: { totalValue: new Dec(100), observedAt: now, holdingsCutoff: now, positions: [], issuers: null, sectors: null },
    });
    expect(insightItems([allocation], new Set(), now, dependencies)).toEqual([]);
  });

  it("keeps identity, first-seen time and read state across a corrected version", () => {
    const old = movement("v1", 4);
    const revised = movement("v2", 5, { version: 2 });
    let archive = mergeArchive(EMPTY_ARCHIVE, items(old), [old], now);
    const first = archive.items[0];
    archive = markArchiveRead(archive, new Set([first.id]), now);
    archive = mergeArchive(archive, items(revised), [revised], now + 10_000);
    expect(archive.items).toHaveLength(1);
    expect(archive.items[0]).toMatchObject({ id: first.id, createdAt: first.createdAt, readAt: now, corrected: true });
    expect(Object.keys(archive.insights)).toEqual(["v2"]);
  });

  it("does not create near-identical rows for one price family", () => {
    const run = insight("run", "watchlistSessionRun", {
      kind: "watchlistSessionRun",
      value: {
        assetID: asset,
        direction: 1,
        sessions: 3,
        startPrice: new Dec(100),
        endPrice: new Dec(105),
        percentage: new Dec(5),
        firstObservedAt: now - 6 * 86_400_000,
        lastObservedAt: now - 3_600_000,
      },
    });
    let archive = mergeArchive(EMPTY_ARCHIVE, items(movement()), [movement()], now);
    archive = mergeArchive(archive, items(run), [run], now);
    expect(archive.items).toHaveLength(1);
  });

  it("hides expired and withdrawn facts but keeps their tombstone", () => {
    const source = movement();
    let archive = mergeArchive(EMPTY_ARCHIVE, items(source), [source], now);
    const sources = () => new Map(Object.entries(archive.insights));
    const item = archive.items[0];
    expect(isLocalVisible(item, sources(), context, item.expiresAt)).toBe(false);
    archive = reconcileArchive(archive, "watchlist", source.period, []);
    expect(archive.items[0].unavailable).toBe(true);
    expect(isLocalVisible(archive.items[0], sources(), context, now)).toBe(false);
    archive = markArchiveRead(archive, new Set([item.id]), now);
    archive = mergeArchive(archive, items(source), [source], now);
    expect(archive.items).toHaveLength(1);
    expect(archive.items[0].unavailable).toBe(false);
    expect(archive.items[0].readAt).toBe(now);
  });

  it("suppresses old facts after the watchlist or its comparison universe changes", () => {
    const source = movement();
    const item = items(source)[0];
    const sources = new Map([[source.id, source]]);
    expect(isLocalVisible(item, sources, { ...context, watchedIDs: new Set() }, now)).toBe(false);
    expect(isLocalVisible(item, sources, { ...context, watchedIDs: new Set([asset, "new-asset"]) }, now)).toBe(false);
    expect(isLocalVisible(item, sources, { ...context, watchedIDs: null }, now)).toBe(false);
    expect(isLocalVisible(item, sources, context, now)).toBe(true);
  });

  it("suppresses the portfolio reading after the ledger changes", () => {
    const source = portfolio();
    const item = insightItems([source], new Set(), now, dependencies)[0];
    const sources = new Map([[source.id, source]]);
    expect(isLocalVisible(item, sources, { watchedIDs: null, portfolioTransactions: [] }, now)).toBe(false);
    expect(isLocalVisible(item, sources, { watchedIDs: null, portfolioTransactions: [transaction] }, now)).toBe(true);
    expect(isLocalVisible(item, sources, { watchedIDs: null, portfolioTransactions: [{ ...transaction, quantity: new Dec(2) }] }, now)).toBe(false);
  });

  it("bounds history and the source registry", () => {
    let archive: LocalActivityArchive = EMPTY_ARCHIVE;
    for (let index = 0; index < 205; index++) {
      const source = { ...movement(`m${index}`), relatedAssetIDs: [`asset-${index}`], period: { start: now - index * 1000 - 1000, endExclusive: now } };
      archive = mergeArchive(archive, insightItems([source], new Set([`asset-${index}`]), now, dependencies), [source], now);
    }
    expect(archive.items).toHaveLength(LOCAL_ACTIVITY_MAXIMUM_ITEMS);
    archive = pruneArchive(archive, now + LOCAL_ACTIVITY_RETENTION + 1);
    expect(archive.items).toEqual([]);
    expect(archive.insights).toEqual({});
  });

  it("round-trips the archive and becomes W9 rows with privacy classes", () => {
    const sources = [movement(), portfolio()];
    const archive = decodeArchive(encodeArchive(mergeArchive(EMPTY_ARCHIVE, insightItems(sources, watched, now, dependencies), sources, now)), now);
    const rows = localActivityRows(archive, { watchedIDs: watched, portfolioTransactions: [transaction] }, now, (source) => ({
      title: source.type,
      body: "fixture",
    }));
    expect(rows.map((row) => [row.category, row.privacy, row.destination.kind]).sort()).toEqual([
      ["portfolio", "private_financial", "portfolio"],
      ["watchlist", "personal_context", "instrument"],
    ]);
    expect(JSON.stringify(rows)).not.toContain("1049998.95");
    expect(mergeActivityCentre([], rows)).toHaveLength(2);
  });
});
