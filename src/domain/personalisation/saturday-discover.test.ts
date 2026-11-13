import { describe, expect, it } from "vitest";

import { Dec } from "../intelligence/math";
import type { Insight, InsightPriceObservation, WatchlistPublication } from "../intelligence/models";
import type { MarketState } from "../market/calendar";
import {
  STANDARD_CONFIGURATION,
  type SaturdayDiscoverContext,
  exposureSnapshot,
  interestProfile,
  isDiscoverSaturday,
  receiptKeys,
  selectDiscover,
  topicKeys,
} from ".";

/*
 * Ports `SaturdayDiscoverTests`. The iOS fixture runs the insight engine; these insights are the shapes that engine
 * emits for the same evidence (one price change per asset, session runs for watched assets, the portfolio performance
 * and one publication per article), so the ranking assertions are unchanged. Engine-side rejections (stale articles,
 * non-HTTPS sources, partial sessions) belong to the engine's own tests.
 */

const HOUR = 3_600_000;
const day = (n: number) => Date.parse(`2026-09-${String(n).padStart(2, "0")}T00:00:00+01:00`);
const now = day(26) + 11 * HOUR;
const fetchedAt = now - 60_000;
const SESSIONS = [18, 21, 22, 23, 24, 25];

function observations(id: string, change: number): InsightPriceObservation[] {
  return SESSIONS.map((n, index) => {
    const close = day(n) + 15.5 * HOUR;
    return {
      recordID: `${id}-${n}`,
      assetID: id,
      currencyCode: "AOA",
      price: new Dec(100).plus(new Dec(change).times(index).div(5)),
      observedAt: close,
      collectedAt: close + 60_000,
      source: { dataset: "price_history.close", ingestionRunID: `run-${n}`, contentHash: "a".repeat(64), parserVersion: "fixture-v1" },
      isFinal: true,
      dataQuality: { status: "valid", reasons: [] },
    };
  });
}

const provenance = (rows: InsightPriceObservation[]) => ({
  calculationID: "fixture",
  calculationVersion: 1,
  calendarVersion: "verified-fixture-v1",
  observations: rows,
  fetchedAt,
  completeness: "completeExpectedSessions" as const,
});

const base = { generatedAt: now, period: { start: day(18), endExclusive: day(26) }, expiresAt: now + 600_000 };

function price(id: string, change: number, watched: boolean, held: boolean): Insight {
  const rows = observations(id, change);
  return {
    ...base,
    id: `price:${id}`,
    type: "assetPriceChange",
    category: watched ? "watchlist" : "market",
    fact: {
      kind: "priceChange",
      value: {
        assetID: id,
        currencyCode: "AOA",
        startPrice: rows[0].price,
        endPrice: rows[5].price,
        percentageChange: new Dec(change),
        firstObservedAt: rows[0].observedAt,
        lastObservedAt: rows[5].observedAt,
      },
    },
    relatedAssetIDs: [id],
    relevance: { isHeld: held, isWatched: watched, activityRank: null },
    destination: { kind: "asset", assetID: id },
    provenance: provenance(rows),
  };
}

function run(id: string, change: number, held: boolean): Insight {
  const rows = observations(id, change);
  return {
    ...base,
    id: `run:${id}`,
    type: "watchlistSessionRun",
    category: "watchlist",
    fact: {
      kind: "watchlistSessionRun",
      value: {
        assetID: id,
        direction: 1,
        sessions: 5,
        startPrice: rows[0].price,
        endPrice: rows[5].price,
        percentage: new Dec(change),
        firstObservedAt: rows[0].observedAt,
        lastObservedAt: rows[5].observedAt,
      },
    },
    relatedAssetIDs: [id],
    relevance: { isHeld: held, isWatched: true, activityRank: null },
    destination: { kind: "asset", assetID: id },
    provenance: provenance(rows),
  };
}

function performance(change: number, watched: boolean): Insight {
  const rows = observations("A", change);
  const start = new Dec(200);
  const end = new Dec(200).plus(new Dec(change).times(2));
  return {
    ...base,
    id: "portfolio:performance",
    type: "portfolioPricePerformance",
    category: "portfolio",
    period: { start: day(21), endExclusive: day(26) },
    fact: {
      kind: "portfolioPerformance",
      value: {
        startValue: start,
        endValue: end,
        change: end.minus(start),
        percentage: new Dec(change),
        firstObservedAt: rows[1].observedAt,
        lastObservedAt: rows[5].observedAt,
        positions: [
          {
            assetID: "A",
            symbol: "A",
            quantity: new Dec(2),
            startValue: start,
            endValue: end,
            contribution: end.minus(start),
            percentagePoints: new Dec(change),
          },
        ],
        advancing: change > 0 ? 1 : 0,
        declining: change < 0 ? 1 : 0,
        unchanged: change === 0 ? 1 : 0,
      },
    },
    relatedAssetIDs: ["A"],
    relevance: { isHeld: true, isWatched: watched, activityRank: null },
    destination: { kind: "portfolio" },
    provenance: {
      ...provenance(rows),
      portfolio: {
        week: { start: day(21), endExclusive: day(26) },
        transactions: [],
        securities: [],
        ledgerFetchedAt: fetchedAt,
        metadataFetchedAt: fetchedAt,
      },
    },
  };
}

function publication(article: WatchlistPublication, watched: ReadonlySet<string>, held: ReadonlySet<string>): Insight {
  const isWatched = article.assetIDs.some((id) => watched.has(id));
  return {
    generatedAt: now,
    expiresAt: now + 600_000,
    period: { start: now - 7 * 86_400_000, endExclusive: now },
    id: `publication:${article.articleID}`,
    type: isWatched ? "watchlistInformation" : "marketInformation",
    category: isWatched ? "watchlist" : "market",
    fact: { kind: "watchlistInformation", value: article },
    relatedAssetIDs: [...article.assetIDs],
    relevance: { isHeld: article.assetIDs.some((id) => held.has(id)), isWatched, activityRank: null },
    destination: { kind: "information", articleID: article.articleID },
    provenance: { ...provenance([]), completeness: "verifiedPublicationLinks", publication: { publication: article, fetchedAt } },
  };
}

function article(number: number, options: { assets?: string[]; publishedAt?: number; title?: string; url?: string } = {}): WatchlistPublication {
  return {
    articleID: `00000000-0000-0000-0000-${String(number).padStart(12, "0")}`,
    title: options.title ?? `Publicação ${number}`,
    publishedAt: options.publishedAt ?? now - HOUR,
    assetIDs: options.assets ?? [],
    primarySourceURL: options.url ?? `https://source.ao/${number}`,
    sourceName: "Fonte primária",
  };
}

function evaluate(changes: Record<string, number>, options: { watched?: string[]; portfolio?: boolean; articles?: WatchlistPublication[] } = {}): Insight[] {
  const watched = new Set(options.watched ?? []);
  const held = new Set(options.portfolio ? ["A"] : []);
  const result: Insight[] = [];
  for (const [id, change] of Object.entries(changes)) {
    result.push(price(id, change, watched.has(id), held.has(id)));
    if (watched.has(id)) result.push(run(id, change, held.has(id)));
  }
  if (options.portfolio) result.push(performance(changes.A ?? 0, watched.has("A")));
  for (const value of options.articles ?? []) result.push(publication(value, watched, held));
  return result;
}

const context = (assets: string[] = [], changes: Partial<SaturdayDiscoverContext> = {}): SaturdayDiscoverContext => ({
  now,
  marketState: "weekend",
  calendarValidUntil: now + 600_000,
  availableAssetIDs: new Set(assets),
  ...changes,
});
const select = (facts: Insight[]) => selectDiscover(facts, context(facts.flatMap((f) => f.relatedAssetIDs)));
const set = (...values: string[]) => new Set(values);

describe("SaturdayDiscoverRanking", () => {
  it("explains relationship and bounded interest", () => {
    const facts = evaluate({ A: 2, B: 12, C: 4 });
    const ctx = context(["A", "B", "C"], { heldIDs: set("A"), watchedIDs: set("C"), profile: interestProfile({ behavior: new Map([["B", 5]]) }) });
    const ranked = selectDiscover(facts, ctx);
    expect(ranked.map((s) => s.insight.relatedAssetIDs[0])).toEqual(["A", "B"]);
    expect(ranked[0].score.relationship).toBe(80);
    // One significant market exploration slot.
    expect(ranked.at(-1)?.score.relationship).toBe(0);
    const interested = selectDiscover(
      facts.filter((f) => f.relatedAssetIDs.join() === "B"),
      ctx,
    );
    expect(interested[0].score.interest).toBe(5);
    // One security is not the whole market.
    expect(interested[0].score.marketImportance).toBe(0);
  });

  it("breaks equal scores by observation date, then a stable id, whatever the input order", () => {
    const facts = evaluate({ A: 4, B: 4 });
    const expected = facts.map((f) => f.id).sort();
    expect(select(facts).map((s) => s.id)).toEqual(expected);
    expect(select([...facts].reverse()).map((s) => s.id)).toEqual(expected);
    expect(select([...facts, ...facts]).map((s) => s.id)).toEqual(expected);
  });

  it("keeps assets, types and categories diverse among many similar facts", () => {
    const facts = evaluate(
      { A: 10, B: 9, C: 8, D: 7, E: 6, F: 5 },
      { watched: ["A", "B"], portfolio: true, articles: [article(1, { assets: ["A"] }), article(2, { assets: ["C"] })] },
    );
    const ctx = context(["A", "B", "C", "D", "E", "F"], { heldIDs: set("A"), watchedIDs: set("A", "B") });
    const result = selectDiscover(facts, ctx);
    expect(result[0].insight.type).toBe("portfolioPricePerformance");
    expect(result.length).toBeLessThanOrEqual(5);
    expect(new Set(result.map((s) => s.category)).size).toBeGreaterThanOrEqual(3);
    const countBy = (key: (s: (typeof result)[number]) => string) => {
      const counts = new Map<string, number>();
      for (const s of result) counts.set(key(s), (counts.get(key(s)) ?? 0) + 1);
      return [...counts.values()];
    };
    expect(countBy((s) => s.category).every((n) => n <= 2)).toBe(true);
    expect(countBy((s) => s.insight.type).every((n) => n <= 2)).toBe(true);
    for (const id of ctx.availableAssetIDs!) expect(result.filter((s) => s.focalAssets.has(id)).length).toBeLessThanOrEqual(2);
    const priceFamilies = result.flatMap((s) => [...receiptKeys(s.insight)].filter((key) => key.startsWith("price:")));
    expect(priceFamilies.length).toBe(new Set(priceFamilies).size);
  });

  it("leads with a material portfolio fact even when another holding moves more", () => {
    const facts = evaluate({ A: 2, B: 90 }, { portfolio: true });
    const ctx = context(["A", "B"], { heldIDs: set("A", "B"), profile: interestProfile({ behavior: new Map([["B", 8]]) }) });
    expect(selectDiscover(facts, ctx)[0].insight.type).toBe("portfolioPricePerformance");
  });

  it("excludes a stale fetch and a future generation", () => {
    const facts = evaluate({ A: 10 });
    expect(selectDiscover(facts, context(["A"], { now: now + 900_000, calendarValidUntil: now + 3_600_000 }))).toEqual([]);
    expect(selectDiscover(facts, context(["A"], { now: now - 120_000 }))).toEqual([]);
  });

  it("lets a consumed observation suppress other price variations and publication aliases", () => {
    const facts = evaluate({ A: 10 }, { watched: ["A"], articles: [article(1, { assets: ["A"] })] });
    const priceFact = facts.find((f) => f.type === "assetPriceChange")!;
    let ctx = context(["A"], { watchedIDs: set("A"), consumedKeys: receiptKeys(priceFact) });
    const result = selectDiscover(facts, ctx);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((s) => s.insight.fact.kind === "watchlistInformation")).toBe(true);
    ctx = { ...ctx, consumedKeys: new Set([...ctx.consumedKeys!, ...receiptKeys(result[0].insight)]) };
    expect(selectDiscover(facts, ctx)).toEqual([]);
  });

  it("gives new users without a portfolio or watchlist public market facts", () => {
    const result = select(evaluate({ A: 5, B: 4 }, { articles: [article(1)] }));
    expect(result).toHaveLength(3);
    expect(result.every((s) => s.score.relationship === 0 && s.score.interest === 0)).toBe(true);
    expect(selectDiscover([], context())).toEqual([]);
  });

  it("does not pad one extremely relevant item", () => {
    const result = selectDiscover(evaluate({ A: 35, B: 0 }), context(["A", "B"], { heldIDs: set("A") }));
    expect(result).toHaveLength(1);
    expect(result[0].insight.relatedAssetIDs).toEqual(["A"]);
    expect(result[0].score.significance).toBe(30);
  });

  it("gives a similar, previously read family a novelty penalty", () => {
    const facts = evaluate({ A: 4, B: 4 });
    const a = facts.find((f) => f.relatedAssetIDs.join() === "A")!;
    const result = selectDiscover(facts, context(["A", "B"], { exposure: exposureSnapshot({ topics: topicKeys(a) }) }));
    expect(result.at(-1)?.id).toBe(a.id);
    expect(result.at(-1)?.score.novelty).toBe(-STANDARD_CONFIGURATION.relatedTopicPenalty);
  });

  it("keeps news attribution and deduplicates sources and normalised headlines", () => {
    const articles = [
      article(1, { title: "Resultados BAI", url: "https://source.ao/results" }),
      article(2, { title: "Outro título", url: "https://source.ao/results#section" }),
      article(3, { title: "Resultados BAI!", url: "https://other.ao/results" }),
    ];
    const facts = evaluate({}, { articles });
    const result = select(facts);
    expect(result).toHaveLength(1);
    const fact = result[0].insight.fact;
    expect(fact.kind).toBe("watchlistInformation");
    if (fact.kind !== "watchlistInformation") return;
    expect(fact.value.sourceName).toBe("Fonte primária");
    expect(fact.value.publishedAt).toBe(now - HOUR);
    expect(selectDiscover(facts, context([], { consumedKeys: receiptKeys(result[0].insight) }))).toEqual([]);
  });

  it("personalises news for held assets without a watchlist", () => {
    const result = selectDiscover(evaluate({}, { articles: [article(1, { assets: ["A"] })] }), context(["A"], { heldIDs: set("A") }));
    expect(result).toHaveLength(1);
    expect(result[0].score.relationship).toBe(80);
    expect(result[0].category).toBe("news");
  });

  it("requires a verified closed state and uses the Luanda date", () => {
    const facts = evaluate({ A: 5 });
    for (const state of ["open", "preMarket", "postClose", "unknown"] as MarketState[]) {
      expect(selectDiscover(facts, context(["A"], { marketState: state }))).toEqual([]);
    }
    for (const state of ["weekend", "closed", "holiday"] as MarketState[]) {
      expect(selectDiscover(facts, context(["A"], { marketState: state }))).toHaveLength(1);
    }
    for (const n of [25, 27, 28]) {
      expect(isDiscoverSaturday(context(["A"], { now: day(n) + 12 * HOUR, calendarValidUntil: day(30) }))).toBe(false);
    }
    const boundary = context([], { now: Date.parse("2026-09-25T23:30:00Z") });
    expect(isDiscoverSaturday(boundary)).toBe(true);
    expect(isDiscoverSaturday({ ...boundary, calendarValidUntil: boundary.now })).toBe(false);
  });

  it("withdraws personal candidates in privacy mode and after membership is removed", () => {
    const facts = evaluate({ A: 4, B: 5 }, { watched: ["A"], portfolio: true });
    const ctx = context(["A", "B"], { heldIDs: set("A"), watchedIDs: set("A"), hidesPersonalValues: true });
    const result = selectDiscover(facts, ctx);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((s) => s.insight.relatedAssetIDs.join() === "B")).toBe(true);
    const removed = selectDiscover(facts, { ...ctx, hidesPersonalValues: false, heldIDs: set(), watchedIDs: set() });
    expect(removed.every((s) => s.insight.category === "market")).toBe(true);
  });
});
