import type Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { type CalendarException, MarketCalendar } from "../market/calendar";
import { type PriceObservation, validateHistoricalSeries } from "../market/history-validation";
import { startOfDay } from "../market/zone";
import {
  type InsightFreshnessPolicy,
  type InsightInput,
  DEFAULT_FRESHNESS,
  InsightEngine,
  InsightStore,
  assetPriceChangeGenerator,
  watchlistBreadthGenerator,
} from "./engine";
import { closingExtreme, priceChanges, sessionRun } from "./facts";
import { interpret, marketSummary, percentageChange } from "./math";
import type { InsightPeriod } from "./models";
import { isValidPeriod, periodContains } from "./models";
import { isPubliclyShareable } from "./privacy";
import { d, fixtureCalendar, iso, observation } from "./test-support";

// Port of iOS InsightFoundationTests.

const now = iso("2026-09-26T09:00:00Z");
const period: InsightPeriod = { start: iso("2026-09-20T23:00:00Z"), endExclusive: iso("2026-09-25T23:00:00Z") };

const calendar = (exceptions: [number, CalendarException][] = [], validUntil?: number): MarketCalendar =>
  fixtureCalendar({
    version: "fixture-v1",
    coverage: { start: iso("2026-09-01T23:00:00Z"), endExclusive: iso("2026-10-01T23:00:00Z") },
    verifiedAt: iso("2026-09-20T00:00:00Z"),
    validUntil: validUntil ?? iso("2026-09-29T00:00:00Z"),
    exceptions,
  });

interface RowOptions {
  price?: Decimal | number | string;
  assetID?: string;
  currency?: string;
  runID?: string;
  isFinal?: boolean;
  collectedAt?: number;
  recordID?: string;
}

function row(day: number, options: RowOptions = {}): PriceObservation {
  const assetID = options.assetID ?? "asset";
  const observedAt = iso(`2026-09-${day}T14:30:00Z`);
  return observation({
    recordID: options.recordID ?? `price_history:${assetID}:${day}`,
    assetID,
    currencyCode: options.currency ?? "AOA",
    price: d((options.price ?? 100) as never),
    observedAt,
    collectedAt: options.collectedAt ?? observedAt + 60_000,
    ingestionRunID: options.runID ?? "source-run",
  });
}

const observations = (assetID = "asset", endPrice: string | number = "104.3") =>
  [21, 22, 23, 24, 25].map((day) => row(day, { price: day === 25 ? endPrice : 100, assetID }));

function input(
  options: {
    rows?: PriceObservation[];
    fetchedAt?: number;
    generatedAt?: number;
    requestedPeriod?: InsightPeriod;
    watched?: string[];
    held?: string[];
    ranked?: string[];
    marketCalendar?: MarketCalendar;
    policy?: Partial<InsightFreshnessPolicy>;
  } = {},
): InsightInput {
  return {
    period: options.requestedPeriod ?? period,
    generatedAt: options.generatedAt ?? now,
    fetchedAt: options.fetchedAt ?? now - 60_000,
    calendar: options.marketCalendar ?? calendar(),
    observations: options.rows ?? observations(),
    watchlistIDs: new Set(options.watched ?? []),
    portfolioIDs: new Set(options.held ?? []),
    activityAssetIDs: options.ranked ?? [],
    freshness: { ...DEFAULT_FRESHNESS, ...options.policy },
  };
}

const historyOf = (value: InsightInput) =>
  validateHistoricalSeries({ ...value, calendar: value.calendar ?? undefined, watchlistIDs: [...value.watchlistIDs], portfolioIDs: [...value.portfolioIDs] });

const evaluate = (value: InsightInput) => new InsightEngine().evaluate(value);

describe("insight foundation", () => {
  it("computes percentage changes and fails closed on zero, negative and NaN", () => {
    expect(percentageChange(100, "104.3")?.toString()).toBe("4.3");
    expect(percentageChange(100, 80)?.toString()).toBe("-20");
    expect(percentageChange(100, 100)?.toString()).toBe("0");
    expect(percentageChange(100, 0)?.toString()).toBe("-100");
    expect(percentageChange(0, 100)).toBeNull();
    expect(percentageChange(-10, 100)).toBeNull();
    expect(percentageChange(10, -1)).toBeNull();
    expect(percentageChange(Number.NaN, 10)).toBeNull();
    expect(percentageChange(10, Number.NaN)).toBeNull();
  });

  it("keeps repeating decimals within Foundation precision", () => {
    const change = percentageChange(3, 4)!;
    expect(change.minus("33.333333333333333333333333333333333333").abs().lessThan("0.000000000000000000000000000000001")).toBe(true);
  });

  it("does not produce a value on overflow", () => {
    expect(percentageChange("1e-120", "1e120")).toBeNull();
  });

  it("uses half-open periods", () => {
    expect(periodContains(period, period.start)).toBe(true);
    expect(periodContains(period, period.endExclusive)).toBe(false);
    expect(isValidPeriod({ start: now, endExclusive: now })).toBe(false);
    expect(isValidPeriod({ start: now, endExclusive: period.start })).toBe(false);
  });

  it("keeps the exact period and reproducible evidence", () => {
    const source = input();
    const insight = evaluate(source)[0];
    expect(insight.fact.kind).toBe("priceChange");
    if (insight.fact.kind !== "priceChange") return;
    const fact = insight.fact.value;
    expect(fact.startPrice.toString()).toBe("100");
    expect(fact.endPrice.toString()).toBe("104.3");
    expect(fact.percentageChange.toString()).toBe("4.3");
    expect(fact.firstObservedAt).toBe(iso("2026-09-21T14:30:00Z"));
    expect(fact.lastObservedAt).toBe(iso("2026-09-25T14:30:00Z"));
    expect(insight.period).toEqual(period);
    expect(insight.generatedAt).toBe(now);
    expect(insight.provenance.observations).toEqual(source.observations);
    expect(insight.provenance.calendarVersion).toBe("fixture-v1");
    expect(insight.provenance.calculationVersion).toBe(1);
    expect(insight.expiresAt).toBe(now + 14 * 60_000);
    expect(percentageChange(fact.startPrice, fact.endPrice)?.equals(fact.percentageChange)).toBe(true);
  });

  it("rejects missing history and a missing middle session", () => {
    expect(evaluate(input({ rows: [] }))).toEqual([]);
    expect(evaluate(input({ rows: [observations()[0]] }))).toEqual([]);
    const rows = observations();
    rows.splice(2, 1);
    expect(evaluate(input({ rows }))).toEqual([]);
  });

  it("does not relabel missing endpoints as a full period", () => {
    expect(evaluate(input({ rows: observations().slice(1) }))).toEqual([]);
    expect(evaluate(input({ rows: observations().slice(0, -1) }))).toEqual([]);
  });

  it("rejects a stale fetch and an expired period", () => {
    expect(evaluate(input({ fetchedAt: now - 15 * 60_000 }))).toEqual([]);
    expect(evaluate(input({ generatedAt: period.endExclusive + 7 * 86_400_000 }))).toEqual([]);
    expect(evaluate(input({ fetchedAt: now + 1000 }))).toEqual([]);
    expect(evaluate(input({ policy: { maximumFetchAgeMs: Number.POSITIVE_INFINITY } }))).toEqual([]);
  });

  it("rejects incomplete and non-midnight periods", () => {
    expect(evaluate(input({ requestedPeriod: { start: period.start, endExclusive: now + 1000 } }))).toEqual([]);
    expect(evaluate(input({ requestedPeriod: { start: period.start + 3_600_000, endExclusive: period.endExclusive } }))).toEqual([]);
  });

  it("accepts historical collection times after the close", () => {
    expect(evaluate(input())).toHaveLength(1);
  });

  it("generates a completed week after the Friday close, before midnight", () => {
    const afterClose = iso("2026-09-25T14:32:00Z");
    expect(period.endExclusive).toBeGreaterThan(afterClose);
    expect(evaluate(input({ fetchedAt: afterClose - 60_000, generatedAt: afterClose }))).toHaveLength(1);
    const beforeClose = iso("2026-09-25T14:29:00Z");
    expect(evaluate(input({ fetchedAt: beforeClose - 60_000, generatedAt: beforeClose }))).toEqual([]);
    expect(evaluate(input({ policy: { maximumPeriodAgeMs: 60_000 } }))).toEqual([]);
  });

  it("rejects malformed prices and provenance", () => {
    for (const bad of [0, -1, Number.NaN]) {
      const rows = observations();
      rows[2] = row(23, { price: bad });
      expect(evaluate(input({ rows }))).toEqual([]);
    }
    const rows = observations();
    for (const replacement of [
      row(23, { currency: "USD" }),
      row(23, { runID: "" }),
      { ...row(23), isFinal: false },
      row(23, { collectedAt: now + 1000 }),
      row(23, { collectedAt: iso("2026-09-23T14:29:00Z") }),
    ]) {
      rows[2] = replacement;
      expect(evaluate(input({ rows }))).toEqual([]);
    }
  });

  it("rejects duplicate observations instead of choosing one", () => {
    const rows = observations();
    rows.push(rows[0]);
    expect(evaluate(input({ rows }))).toEqual([]);
  });

  it("rejects duplicate record identifiers", () => {
    const rows = observations();
    rows[1] = row(22, { recordID: rows[0].recordID });
    expect(evaluate(input({ rows }))).toEqual([]);
  });

  it("keeps a stable identity across input order and regeneration", () => {
    const first = evaluate(input())[0];
    const second = evaluate(input({ rows: observations().reverse(), generatedAt: now + 1000 }))[0];
    expect(first.id).toBe(second.id);
    expect(first.fact).toEqual(second.fact);
    expect(new InsightEngine({ generators: [assetPriceChangeGenerator, assetPriceChangeGenerator] }).evaluate(input())).toHaveLength(1);
  });

  it("replaces a corrected fact under the same semantic identity", () => {
    const original = evaluate(input())[0];
    const corrected = observations();
    corrected[4] = row(25, { price: 110, runID: "correction-run" });
    const revision = evaluate(input({ rows: corrected }))[0];
    expect(original.id).toBe(revision.id);
    expect(original.fact).not.toEqual(revision.fact);
  });

  it("does not invent personal facts for an empty watchlist and portfolio", () => {
    const insights = evaluate(input());
    expect(insights.some((insight) => insight.type === "watchlistBreadth")).toBe(false);
    const insight = insights[0];
    expect(insight.relevance).toEqual({ isHeld: false, isWatched: false, activityRank: null });
    expect(isPubliclyShareable(insight)).toBe(true);
  });

  it("reuses validated facts for watchlist breadth and keeps personal sharing restricted", () => {
    const rows = [...observations(), ...observations("second", 90)];
    const insights = evaluate(input({ rows, watched: ["asset", "second"], held: ["asset"], ranked: ["second", "asset"] }));
    const breadth = insights.find((insight) => insight.type === "watchlistBreadth")!;
    expect(breadth.fact).toEqual({ kind: "breadth", value: { rising: 1, falling: 1, unchanged: 0, assetCount: 2, significantAssetIDs: [] } });
    expect(breadth.provenance.observations).toHaveLength(10);
    expect(isPubliclyShareable(breadth)).toBe(false);
    const held = insights.find((insight) => insight.relatedAssetIDs.length === 1 && insight.relatedAssetIDs[0] === "asset")!;
    expect(held.relevance).toEqual({ isHeld: true, isWatched: true, activityRank: 1 });
    expect(isPubliclyShareable(held)).toBe(false);
  });

  it("suppresses breadth for an incomplete watchlist but keeps the valid asset fact", () => {
    const insights = evaluate(input({ watched: ["asset", "missing"] }));
    expect(insights.filter((insight) => insight.type === "assetPriceChange")).toHaveLength(1);
    expect(insights.some((insight) => insight.type === "watchlistBreadth" || insight.type === "watchlistMovement")).toBe(false);
  });

  it("uses Luanda time and the exact closing boundary", () => {
    const value = calendar();
    expect(value.state(iso("2026-09-25T07:59:59Z"))).toBe("preMarket");
    expect(value.state(iso("2026-09-25T08:00:00Z"))).toBe("open");
    expect(value.state(iso("2026-09-25T14:29:59Z"))).toBe("open");
    expect(value.state(iso("2026-09-25T14:30:00Z"))).toBe("postClose");
    // Friday UTC is already Saturday in Luanda.
    expect(value.state(iso("2026-09-25T23:00:00Z"))).toBe("weekend");
    expect(value.state(iso("2026-09-27T22:59:59Z"))).toBe("weekend");
    expect(value.state(iso("2026-09-27T23:00:00Z"))).toBe("preMarket");
  });

  it("lets holidays, closures and weekend sessions override normal hours", () => {
    const saturday = startOfDay(now);
    const value = calendar([
      [period.start, { kind: "holiday" }],
      [iso("2026-09-21T23:00:00Z"), { kind: "closed" }],
      [saturday, { kind: "session", hours: { openingMinute: 10 * 60, closingMinute: 12 * 60 } }],
    ]);
    expect(value.state(iso("2026-09-21T10:00:00Z"))).toBe("holiday");
    expect(value.state(iso("2026-09-22T10:00:00Z"))).toBe("closed");
    expect(value.state(iso("2026-09-26T09:00:00Z"))).toBe("open");
    expect(value.state(iso("2026-09-26T11:00:00Z"))).toBe("postClose");
    expect(value.sessions(period, now)).toHaveLength(3);
  });

  it("accepts the remaining complete sessions around a verified holiday", () => {
    const holiday = iso("2026-09-22T23:00:00Z");
    const rows = observations().filter((item) => startOfDay(item.observedAt) !== holiday);
    expect(evaluate(input({ rows, marketCalendar: calendar([[holiday, { kind: "holiday" }]]) }))).toHaveLength(1);
  });

  it("fails closed on an unknown, expired or malformed calendar", () => {
    expect(calendar([], now).state(now)).toBe("unknown");
    expect(evaluate(input({ marketCalendar: calendar([], now) }))).toEqual([]);
    expect(calendar().state(iso("2026-10-05T10:00:00Z"))).toBe("unknown");
    const malformed = calendar([[period.start, { kind: "session", hours: { openingMinute: 1000, closingMinute: 900 } }]]);
    expect(malformed.state(now)).toBe("unknown");
    expect(evaluate(input({ marketCalendar: malformed }))).toEqual([]);
  });

  it("declares generator requirements", () => {
    expect([...assetPriceChangeGenerator.requirements].sort()).toEqual(["finalizedPriceHistory", "verifiedMarketCalendar"]);
    expect(watchlistBreadthGenerator.requirements.has("watchlistMembership")).toBe(true);
  });

  it("expires, replaces and clears facts in the shared store", () => {
    const store = new InsightStore();
    store.refresh(input());
    expect(store.current(now)).toHaveLength(1);
    expect(store.current(now + 14 * 60_000)).toEqual([]);
    store.refresh(input({ rows: [] }));
    expect(store.current(now)).toEqual([]);
    store.refresh(input());
    store.clear();
    expect(store.current(now)).toEqual([]);
  });

  it("makes facts available independently of the semantic generators", () => {
    const source = input({ rows: observations("asset", "104.32123456789") });
    const facts = priceChanges(historyOf(source));
    const fact = facts.get("asset")!;
    expect(fact.startPrice.toString()).toBe("100");
    expect(fact.endPrice.toString()).toBe("104.32123456789");
    expect(fact.percentageChange.toString()).toBe("4.32123456789");
    const evaluation = new InsightEngine({ generators: [] }).assess(source);
    expect(evaluation.insights).toEqual([]);
    expect(evaluation.facts).toEqual(facts);
  });

  it("cannot promote an incomplete series", () => {
    expect(priceChanges(historyOf(input({ rows: observations().slice(1) }))).size).toBe(0);
  });

  it("summarises the market from exact facts and requires the whole declared universe", () => {
    const rows = [...observations("rise", "100.004"), ...observations("fall", "99.999"), ...observations("flat", 100)];
    const facts = priceChanges(historyOf(input({ rows })));
    const summary = marketSummary(new Set(["rise", "fall", "flat"]), facts)!;
    expect(summary.breadth).toMatchObject({ rising: 1, falling: 1, unchanged: 1 });
    expect(summary.strongestRisingAssetID).toBe("rise");
    expect(summary.strongestFallingAssetID).toBe("fall");
    expect(marketSummary(new Set(["rise", "missing"]), facts)).toBeNull();
  });

  it("interprets without rounding or replacing the fact", () => {
    const fact = priceChanges(historyOf(input({ rows: observations("asset", "100.9999") }))).get("asset")!;
    const interpretation = interpret({ kind: "priceChange", value: fact });
    expect(interpretation.direction).toBe("rising");
    expect(interpretation.significance).toBe("routine");
    expect(interpretation.movementPercentage?.toString()).toBe("0.9999");
  });

  it("measures sessions before the insight significance gate", () => {
    const source = input({ rows: [21, 22, 23, 24, 25].map((day) => row(day, { price: d(100).plus(d(day - 21).div(100)) })), watched: ["asset"] });
    const series = historyOf(source).verified.get("asset")!;
    const run = sessionRun(series)!;
    expect(run.sessions).toBe(4);
    expect(run.percentage.toString()).toBe("0.04");
    expect(closingExtreme(series)).not.toBeNull();
    expect(evaluate(source).some((insight) => insight.type === "watchlistSessionRun" || insight.type === "watchlistClosingExtreme")).toBe(false);
  });
});
