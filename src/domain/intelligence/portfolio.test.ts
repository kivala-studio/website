import type Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import type { CalendarException } from "../market/calendar";
import { validateHistoricalSeries } from "../market/history-validation";
import { civilDate, startOfDay } from "../market/zone";
import type { PortfolioTransaction, PortfolioTransactionKind } from "../portfolio/models";
import { type InsightInput, InsightEngine } from "./engine";
import { priceChanges } from "./facts";
import type { Insight, PortfolioAllocationFact, PortfolioPricePerformanceFact, PortfolioSecurityMetadata } from "./models";
import { calculatePortfolioFacts } from "./portfolio-facts";
import { isPubliclyShareable } from "./privacy";
import { d, fixtureCalendar, observation, septemberDay as day } from "./test-support";

// Port of iOS PortfolioIntelligenceTests.

function transaction(
  id: string,
  quantity: Decimal | number | string,
  options: { day?: number; kind?: PortfolioTransactionKind; id?: string } = {},
): PortfolioTransaction {
  const number = options.day ?? 16;
  return {
    id: options.id ?? `purchase-${id}`,
    securityId: id,
    kind: options.kind ?? "buy",
    quantity: d(quantity as never),
    unitPrice: d(100),
    fees: d(0),
    tradedOn: civilDate(day(number)),
    createdAt: new Date(day(number) + 12 * 3_600_000).toISOString(),
  };
}

const ledger = () => [transaction("A", 2), transaction("B", 1)];
const securities = (): PortfolioSecurityMetadata[] =>
  ["A", "B"].map((id) => ({
    assetID: id,
    symbol: id,
    currencyCode: "AOA",
    supportsUnitValuation: true,
    issuerID: `issuer-${id}`,
    issuerName: `Emitente ${id}`,
    sector: id === "A" ? "Banca" : "Fundos",
  }));

function observations(ids = ["A", "B"], first: string | number = 100, finalA: string | number = 110) {
  return ids.flatMap((id) =>
    [18, 21, 22, 23, 24, 25].map((number) => {
      const closeAt = day(number) + 15.5 * 3_600_000;
      return observation({
        recordID: `${id}-${number}`,
        assetID: id,
        price: d(number === 25 ? (id === "A" ? finalA : 80) : first),
        observedAt: closeAt,
        dataset: "price_history.trades",
        ingestionRunID: `run-${id}-${number}`,
      });
    }),
  );
}

interface Options {
  transactions?: PortfolioTransaction[];
  rows?: ReturnType<typeof observations>;
  securities?: PortfolioSecurityMetadata[];
  now?: number;
  ledgerFetchedAt?: number;
  metadataFetchedAt?: number;
  exceptions?: [number, CalendarException][];
}

function makeInput(options: Options = {}): InsightInput {
  const now = options.now ?? day(26) + 9 * 3_600_000;
  const fetched = now - 30_000;
  return {
    period: { start: day(18), endExclusive: day(26) },
    generatedAt: now,
    fetchedAt: fetched,
    calendar: fixtureCalendar({
      version: "fixture-v1",
      coverage: { start: day(18), endExclusive: day(28) },
      verifiedAt: fetched,
      validUntil: fetched + 900_000,
      exceptions: options.exceptions,
    }),
    observations: options.rows ?? observations(),
    watchlistIDs: new Set(),
    portfolioIDs: new Set(["A", "B"]),
    activityAssetIDs: [],
    portfolio: {
      week: { start: day(21), endExclusive: day(26) },
      transactions: options.transactions ?? ledger(),
      securities: options.securities ?? securities(),
      ledgerFetchedAt: options.ledgerFetchedAt ?? fetched,
      metadataFetchedAt: options.metadataFetchedAt ?? fetched,
    },
  };
}

const evaluate = (options: Options = {}) => new InsightEngine().evaluate(makeInput(options)).filter((insight) => insight.category === "portfolio");

function performance(insights: readonly Insight[]): PortfolioPricePerformanceFact {
  const fact = insights.find((insight) => insight.type === "portfolioPricePerformance")?.fact;
  if (fact?.kind !== "portfolioPerformance") throw new Error("fixture.performance");
  return fact.value;
}

function allocation(insights: readonly Insight[]): PortfolioAllocationFact {
  const fact = insights.find((insight) => insight.type === "portfolioAllocation")?.fact;
  if (fact?.kind !== "portfolioAllocation") throw new Error("fixture.allocation");
  return fact.value;
}

const text = (values: readonly Decimal[]) => values.map((value) => value.toString());

describe("portfolio intelligence", () => {
  it("separates contributions of fixed holdings and allocates the whole portfolio", () => {
    const insights = evaluate();
    const fact = performance(insights);
    expect(text([fact.startValue, fact.endValue, fact.change, fact.percentage])).toEqual(["300", "300", "0", "0"]);
    expect(fact.positions.map((position) => position.assetID)).toEqual(["A", "B"]);
    expect(text(fact.positions.map((position) => position.contribution))).toEqual(["20", "-20"]);
    expect([fact.advancing, fact.declining]).toEqual([1, 1]);
    const weights = allocation(insights);
    expect(weights.totalValue.toString()).toBe("300");
    expect(text(weights.positions.map((position) => position.value))).toEqual(["220", "80"]);
    expect(weights.issuers).toHaveLength(2);
    expect(weights.sectors).toHaveLength(2);
    const portfolio = insights.find((insight) => insight.type === "portfolioPricePerformance")!;
    expect(isPubliclyShareable(portfolio)).toBe(false);
    expect(portfolio.provenance.observations).toHaveLength(12);
    expect(portfolio.provenance.portfolio?.transactions).toHaveLength(2);
  });

  it("keeps fractional quantities and sub-cent prices exact", () => {
    const metadata = securities();
    metadata[0] = { ...metadata[0], allowsFractionalQuantity: true };
    const fact = performance(
      evaluate({ transactions: [transaction("A", "0.10000001")], rows: observations(["A"], "100.00000001", "110.00000002"), securities: metadata }),
    );
    expect(fact.startValue.toString()).toBe("10.0000010010000001");
    expect(fact.endValue.toString()).toBe("11.0000011020000002");
    expect(fact.change.toString()).toBe("1.0000001010000001");
  });

  it("suppresses the return for a buy or sell inside the week but keeps the closing allocation", () => {
    for (const kind of ["buy", "sell"] as const) {
      const insights = evaluate({ transactions: [...ledger(), transaction("A", 1, { day: 23, kind, id: "flow" })] });
      expect(insights.some((insight) => insight.type === "portfolioPricePerformance")).toBe(false);
      expect(allocation(insights).totalValue.toString()).toBe(kind === "buy" ? "410" : "190");
    }
  });

  it("does not turn a weekend change between the baseline and Monday into performance", () => {
    const insights = evaluate({ transactions: [...ledger(), transaction("A", 1, { day: 19, id: "weekend" })] });
    expect(insights.some((insight) => insight.type === "portfolioPricePerformance")).toBe(false);
  });

  it("does not let later trades alter the previous week's closing quantities", () => {
    const insights = evaluate({ transactions: [...ledger(), transaction("A", 100, { day: 28, id: "next-week" })], now: day(28) + 12 * 3_600_000 });
    expect(allocation(insights).totalValue.toString()).toBe("300");
    expect(performance(insights).positions[0].quantity.toString()).toBe("2");
  });

  it("never produces partial facts for a missing baseline or session", () => {
    for (const missingDay of [18, 23, 25]) {
      const rows = observations().filter((row) => !(row.assetID === "B" && startOfDay(row.observedAt) === day(missingDay)));
      expect(evaluate({ rows })).toEqual([]);
    }
  });

  it("does not require a non-trading holiday nor carry a price forward", () => {
    const rows = observations().filter((row) => startOfDay(row.observedAt) !== day(23));
    expect(performance(evaluate({ rows, exceptions: [[day(23), { kind: "closed" }]] })).change.toString()).toBe("0");
  });

  it("fails closed on oversells, duplicate ids and unsupported held securities", () => {
    expect(evaluate({ transactions: [...ledger(), transaction("A", 3, { day: 17, kind: "sell", id: "oversell" })] })).toEqual([]);
    expect(evaluate({ transactions: [...ledger(), ledger()[0]] })).toEqual([]);
    const metadata = securities();
    metadata[1] = { assetID: "B", symbol: "B", currencyCode: "AOA", supportsUnitValuation: false, issuerID: "ib", issuerName: "Banco B", sector: "Banca" };
    expect(evaluate({ securities: metadata })).toEqual([]);
    metadata[1] = { assetID: "B", symbol: "B", currencyCode: "USD", supportsUnitValuation: true, issuerID: "ib", issuerName: "Banco B", sector: "Banca" };
    expect(evaluate({ securities: metadata })).toEqual([]);
  });

  it("suppresses only the grouping with incomplete classification", () => {
    const metadata = securities();
    metadata[1] = { assetID: "B", symbol: "B", currencyCode: "AOA", supportsUnitValuation: true, issuerID: null, issuerName: "Banco B", sector: null };
    const fact = allocation(evaluate({ securities: metadata }));
    expect(fact.positions).toHaveLength(2);
    expect(fact.issuers).toBeNull();
    expect(fact.sectors).toBeNull();
  });

  it("applies freshness to the ledger, the metadata and the expiry", () => {
    const now = day(26) + 9 * 3_600_000;
    expect(evaluate({ ledgerFetchedAt: now - 900_000 })).toEqual([]);
    expect(evaluate({ metadataFetchedAt: now + 1000 })).toEqual([]);
    expect(evaluate({ ledgerFetchedAt: now - 899_000 })[0].expiresAt).toBe(now + 1000);
  });

  it("fails closed on invalid and overflowing quantities", () => {
    expect(evaluate({ transactions: [transaction("A", Number.NaN)] })).toEqual([]);
    expect(evaluate({ transactions: [transaction("A", "340282366920938463463374607431768211455e127")] })).toEqual([]);
  });

  it("does not invent facts for sold-out and empty portfolios", () => {
    expect(evaluate({ transactions: [] })).toEqual([]);
    const exits = [transaction("A", 2, { day: 25, kind: "sell", id: "exit-a" }), transaction("B", 1, { day: 25, kind: "sell", id: "exit-b" })];
    expect(evaluate({ transactions: [...ledger(), ...exits] })).toEqual([]);
  });

  it("produces weekly facts after the final Friday close, before midnight", () => {
    expect(performance(evaluate({ now: day(25) + 18 * 3_600_000 })).endValue.toString()).toBe("300");
  });

  it("does not accept a fractional equity quantity as a whole-unit holding", () => {
    expect(evaluate({ transactions: [transaction("A", "0.1")] })).toEqual([]);
  });

  it("calculates measurements without an insight or copy", () => {
    const source = makeInput();
    const quality = validateHistoricalSeries({ ...source, calendar: source.calendar ?? undefined, watchlistIDs: [], portfolioIDs: [...source.portfolioIDs] });
    const facts = calculatePortfolioFacts(source.portfolio!, priceChanges(quality), {
      comparisonPeriod: source.period,
      calendar: source.calendar,
      asOf: source.generatedAt,
      maximumAgeMs: 15 * 60_000,
    })!;
    expect(text([facts.performance!.startValue, facts.performance!.endValue, facts.performance!.percentage])).toEqual(["300", "300", "0"]);
    expect(text(facts.performance!.positions.map((position) => position.contribution))).toEqual(["20", "-20"]);
    expect(facts.allocation?.totalValue.toString()).toBe("300");
  });
});
