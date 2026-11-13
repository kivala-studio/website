import type Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import type { CalendarException, MarketCalendar } from "../market/calendar";
import type { PriceObservation } from "../market/history-validation";
import { DEFAULT_FRESHNESS, InsightEngine } from "./engine";
import type { Insight, WatchlistPublication, WatchlistPublicationInput } from "./models";
import { receiptKeys, watchlistInsightCandidates } from "../personalisation/insight-personalization";
import { isPubliclyShareable } from "./privacy";
import { d, fixtureCalendar, observation, septemberDay as day } from "./test-support";

// Port of iOS WatchlistIntelligenceTests. Receipt persistence is covered with the exposure store and the Home
// assertions with the context resolver.

const now = day(26) + 9 * 3_600_000;
const close = (number: number) => day(number) + 15.5 * 3_600_000;

const calendar = (exceptions: [number, CalendarException][] = []): MarketCalendar =>
  fixtureCalendar({ version: "verified-fixture-v1", coverage: { start: day(1), endExclusive: day(30) }, verifiedAt: day(18), validUntil: day(29), exceptions });

const rows = (id: string, prices: readonly (number | string | Decimal)[]): PriceObservation[] =>
  [18, 21, 22, 23, 24, 25].map((number, index) =>
    observation({
      recordID: `price_history:${id}:${number}`,
      assetID: id,
      price: d(prices[index] as never),
      observedAt: close(number),
      ingestionRunID: `verified-run-${number}`,
      parserVersion: "fixture-v1",
    }),
  );

function evaluate(
  options: { rows?: PriceObservation[]; watched?: string[]; calendar?: MarketCalendar | null; publications?: WatchlistPublicationInput } = {},
): readonly Insight[] {
  return new InsightEngine().evaluate({
    period: { start: day(18), endExclusive: day(26) },
    generatedAt: now,
    fetchedAt: now - 60_000,
    calendar: options.calendar === undefined ? calendar() : options.calendar,
    observations: options.rows ?? rows("A", [100, 100, 100, 100, 100, 102]),
    watchlistIDs: new Set(options.watched ?? ["A"]),
    portfolioIDs: new Set(),
    activityAssetIDs: [],
    freshness: DEFAULT_FRESHNESS,
    publications: options.publications,
  });
}

const publication = (fields: Partial<WatchlistPublication> = {}): WatchlistPublication => ({
  articleID: "501b6d36-8e23-4ed8-a3c9-ae2d8f232a83",
  title: "Resultados publicados",
  publishedAt: now - 3_600_000,
  assetIDs: ["A"],
  primarySourceURL: "https://example.ao/report",
  sourceName: "Emitente",
  ...fields,
});

const publications = (articles: WatchlistPublication[]): WatchlistPublicationInput => ({
  period: { start: now - 7 * 86_400_000, endExclusive: now },
  fetchedAt: now - 60_000,
  articles,
});

const candidates = (facts: readonly Insight[], watched = ["A"], consumed: Iterable<string> = []) =>
  watchlistInsightCandidates(facts, { watchedIDs: new Set(watched), consumedKeys: new Set(consumed), now });

const ofType = (insights: readonly Insight[], type: Insight["type"]) => insights.find((insight) => insight.type === type);

describe("watchlist intelligence", () => {
  it("does not label a Monday opening range as full weekly performance", () => {
    const mondayRows = [...rows("A", [100, 100, 100, 100, 100, 102]), ...rows("B", [100, 100, 100, 100, 100, 97])].filter((row) => row.observedAt >= day(21));
    const facts = new InsightEngine().evaluate({
      period: { start: day(21), endExclusive: day(26) },
      generatedAt: now,
      fetchedAt: now - 60_000,
      calendar: calendar(),
      observations: mondayRows,
      watchlistIDs: new Set(["A", "B"]),
      portfolioIDs: new Set(),
      activityAssetIDs: [],
    });
    expect(ofType(facts, "watchlistMovement")).toBeUndefined();
    const breadth = ofType(facts, "watchlistBreadth")!;
    expect(breadth.fact).toEqual({ kind: "breadth", value: { rising: 1, falling: 1, unchanged: 0, assetCount: 2, significantAssetIDs: [] } });
    expect(candidates(facts, ["A", "B"]).some((insight) => insight.type === "watchlistBreadth")).toBe(false);
  });

  it("keeps exact signs in breadth for small moves", () => {
    const facts = evaluate({ rows: [...rows("A", [100, 100, 100, 100, 100, "100.1"]), ...rows("B", [100, 100, 100, 100, 100, "99.9"])], watched: ["A", "B"] });
    expect(candidates(facts, ["A", "B"])).toEqual([]);
    expect(ofType(facts, "watchlistBreadth")!.fact).toMatchObject({ value: { rising: 1, falling: 1, unchanged: 0 } });
  });

  it("uses decimal precision at the one percent boundary", () => {
    expect(candidates(evaluate({ rows: rows("A", [100, 100, 100, 100, 100, "100.999999"]) }))).toEqual([]);
    const movement = candidates(evaluate({ rows: rows("A", [100, 100, 100, 100, 100, 101]) }))[0];
    expect(movement.type).toBe("watchlistMovement");
    expect(movement.fact.kind === "watchlistMovement" && movement.fact.value.movement.percentageChange.toString()).toBe("1");
    expect(movement.provenance.observations).toHaveLength(6);
  });

  it("ranks the strongest by absolute movement over the complete current membership", () => {
    const full = evaluate({ rows: [...rows("A", [100, 100, 100, 100, 100, 102]), ...rows("B", [100, 100, 100, 100, 100, 97])], watched: ["A", "B"] });
    const strongest = ofType(full, "watchlistMovement")!;
    expect(strongest.fact.kind === "watchlistMovement" && strongest.fact.value.movement.assetID).toBe("B");
    expect(strongest.fact.kind === "watchlistMovement" && strongest.fact.value.movement.percentageChange.toString()).toBe("-3");
    const incomplete = evaluate({ rows: rows("A", [100, 100, 100, 100, 100, 102]), watched: ["A", "B"] });
    expect(incomplete.some((insight) => insight.type === "watchlistMovement" || insight.type === "watchlistBreadth")).toBe(false);
    expect(candidates(full, ["A"]).some((insight) => insight.type === "watchlistMovement" || insight.type === "watchlistBreadth")).toBe(false);
  });

  it("requires three strict steps and one percent for an ending run", () => {
    for (const [prices, direction] of [
      [[100, 100, 100, 101, 102, 103], 1],
      [[100, 100, 100, 99, 98, 97], -1],
    ] as const) {
      const insight = ofType(evaluate({ rows: rows("A", prices) }), "watchlistSessionRun")!;
      expect(insight.fact.kind).toBe("watchlistSessionRun");
      if (insight.fact.kind !== "watchlistSessionRun") return;
      expect(insight.fact.value.sessions).toBe(3);
      expect(insight.fact.value.direction).toBe(direction);
      expect(insight.fact.value.percentage.toString()).toBe(direction > 0 ? "3" : "-3");
    }
    expect(ofType(evaluate({ rows: rows("A", [100, 100, 101, 102, 102, 103]) }), "watchlistSessionRun")).toBeUndefined();
    expect(ofType(evaluate({ rows: rows("A", [100, 100, 100, "100.1", "100.2", "100.3"]) }), "watchlistSessionRun")).toBeUndefined();
  });

  it("skips holidays but suppresses price facts for missing open sessions", () => {
    const holiday = calendar([[day(22), { kind: "closed" }]]);
    const complete = rows("A", [100, 100, 100, 101, 102, 103]).filter((row) => row.observedAt !== close(22));
    expect(ofType(evaluate({ rows: complete, calendar: holiday }), "watchlistSessionRun")).toBeDefined();
    expect(evaluate({ rows: complete.filter((row) => row.observedAt !== close(24)), calendar: holiday })).toEqual([]);
  });

  it("needs enough observations and a meaningful gap for a closing extreme", () => {
    const prices = [100, 101, 99, 102, 101, 104];
    const high = ofType(evaluate({ rows: rows("A", prices) }), "watchlistClosingExtreme")!;
    expect(high.fact.kind).toBe("watchlistClosingExtreme");
    if (high.fact.kind !== "watchlistClosingExtreme") return;
    expect(high.fact.value.isHigh).toBe(true);
    expect(high.fact.value.previousExtreme.toString()).toBe("102");
    expect(high.fact.value.observationCount).toBe(6);
    const low = ofType(evaluate({ rows: rows("A", [100, 101, 99, 98, 99, 96]) }), "watchlistClosingExtreme")!;
    expect(low.fact.kind === "watchlistClosingExtreme" && low.fact.value.isHigh).toBe(false);
    expect(low.fact.kind === "watchlistClosingExtreme" && low.fact.value.previousExtreme.toString()).toBe("98");
    expect(ofType(evaluate({ rows: rows("A", [100, 101, 99, 102, 101, "102.1"]) }), "watchlistClosingExtreme")).toBeUndefined();
    expect(ofType(evaluate({ rows: rows("A", [100, 101, 99, 102, 101, 102]) }), "watchlistClosingExtreme")).toBeUndefined();
    const shortCalendar = calendar([
      [day(22), { kind: "closed" }],
      [day(23), { kind: "closed" }],
    ]);
    const short = rows("A", prices).filter((row) => row.observedAt !== close(22) && row.observedAt !== close(23));
    expect(ofType(evaluate({ rows: short, calendar: shortCalendar }), "watchlistClosingExtreme")).toBeUndefined();
  });

  it("keeps publications independent of unavailable or stale price data", () => {
    const article = publication();
    const facts = new InsightEngine().evaluate({
      period: { start: day(18), endExclusive: day(26) },
      generatedAt: now,
      fetchedAt: now - 1_000_000,
      calendar: null,
      observations: [],
      watchlistIDs: new Set(["A"]),
      portfolioIDs: new Set(),
      activityAssetIDs: [],
      publications: publications([article]),
    });
    expect(facts).toHaveLength(1);
    const fact = facts[0];
    expect(fact.provenance.completeness).toBe("verifiedPublicationLinks");
    expect(fact.provenance.publication?.publication.primarySourceURL).toBe(article.primarySourceURL);
    expect(fact.provenance.observations).toEqual([]);
    expect(isPubliclyShareable(fact)).toBe(false);
  });

  it("rejects future, old, unlinked, unsafe and ambiguous sources", () => {
    const invalid = [
      publication({ publishedAt: now + 1000 }),
      publication({ publishedAt: now - 8 * 86_400_000 }),
      publication({ assetIDs: ["B"] }),
      publication({ primarySourceURL: "http://example.ao/report" }),
      publication({ primarySourceURL: "https://name:password@example.ao/report" }),
    ];
    for (const article of invalid) expect(ofType(evaluate({ publications: publications([article]) }), "watchlistInformation")).toBeUndefined();
    expect(ofType(evaluate({ publications: publications([publication(), publication()]) }), "watchlistInformation")).toBeUndefined();
  });

  it("keeps article identity across refresh windows and lets price families share receipts", () => {
    const first = ofType(evaluate({ publications: publications([publication()]) }), "watchlistInformation")!;
    const shifted: WatchlistPublicationInput = { period: { start: now - 6 * 86_400_000, endExclusive: now }, fetchedAt: now, articles: [publication()] };
    const second = ofType(evaluate({ publications: shifted }), "watchlistInformation")!;
    expect(second.id).toBe(first.id);
    const facts = evaluate({ rows: rows("A", [100, 100, 100, 101, 102, 104]) });
    const selected = candidates(facts);
    expect(selected).toHaveLength(1);
    const movement = selected[0];
    expect(movement.type).toBe("watchlistMovement");
    expect(candidates(facts, ["A"], receiptKeys(movement))).toEqual([]);
    expect(candidates([first], ["A"], receiptKeys(second))).toEqual([]);
    const alternate = publication({ articleID: "508b6d36-8e23-4ed8-a3c9-ae2d8f232a83", primarySourceURL: "https://example.ao/report#section" });
    const related = evaluate({ publications: publications([publication(), alternate]) }).filter((insight) => insight.type === "watchlistInformation");
    expect(candidates(related)).toHaveLength(1);
    expect(candidates(related, ["A"], receiptKeys(first))).toEqual([]);
    const initial = evaluate({ rows: [...rows("A", [100, 100, 100, 100, 100, 103]), ...rows("B", [100, 100, 100, 100, 100, 102])], watched: ["A", "B"] });
    const corrected = evaluate({ rows: [...rows("A", [100, 100, 100, 100, 100, 103]), ...rows("B", [100, 100, 100, 100, 100, 104])], watched: ["A", "B"] });
    const initialWinner = ofType(initial, "watchlistMovement")!;
    const correctedWinner = ofType(corrected, "watchlistMovement")!;
    expect(initialWinner.id).toBe(correctedWinner.id);
    expect(candidates([correctedWinner], ["A", "B"], receiptKeys(initialWinner))).toEqual([]);
  });

  it("drops candidates once they leave the freshness window", () => {
    const facts = evaluate({ publications: publications([publication()]) });
    expect(watchlistInsightCandidates(facts, { watchedIDs: new Set(["A"]), consumedKeys: new Set(), now: now + 1_000_000 })).toEqual([]);
  });
});
