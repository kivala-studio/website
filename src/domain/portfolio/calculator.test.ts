import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import {
  type HistoryPoint,
  type PortfolioTransaction,
  type PortfolioTransactionKind,
  type ValuePoint,
  ledgerPositions,
  ledgerResults,
  portfolioAllocations,
  portfolioPeriodChange,
  portfolioPriceScale,
  portfolioSummary,
  portfolioValueSeries,
  valuePositions,
} from "./index";

const asOf = Date.UTC(2026, 10, 10, 11);
const options = { asOf };

const day = (year: number, month: number, date: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
/** Noon in Luanda, like the iOS test dates. */
const noon = (year: number, month: number, date: number) => Date.UTC(year, month - 1, date, 11);

let sequence = 0;
function purchase(
  securityId: string,
  quantity: Decimal.Value,
  unitPrice: Decimal.Value,
  { kind = "buy", fees = 0, tradedOn = day(2026, 1, 1) }: { kind?: PortfolioTransactionKind; fees?: Decimal.Value; tradedOn?: string } = {},
): PortfolioTransaction {
  sequence += 1;
  return {
    id: `t${String(sequence).padStart(6, "0")}`,
    securityId,
    kind,
    quantity: new Decimal(quantity),
    unitPrice: new Decimal(unitPrice),
    fees: new Decimal(fees),
    tradedOn,
    createdAt: new Date(Date.UTC(2026, 0, 1) + sequence).toISOString(),
  };
}

const closes = (values: [number, Decimal.Value][]): HistoryPoint[] => values.map(([date, value]) => ({ date, value }));
const points = (values: [string, Decimal.Value][]): ValuePoint[] =>
  values.map(([date, value]) => ({ day: date, value: new Decimal(value) }));

const text = (value: Decimal | null | undefined) => value?.toString();
const expectDecimal = (actual: Decimal | null | undefined, expected: Decimal.Value) =>
  expect(text(actual)).toBe(new Decimal(expected).toString());
const expectClose = (actual: Decimal | null | undefined, expected: Decimal.Value) =>
  expect(actual?.minus(expected).abs().lte("0.000001")).toBe(true);

function valuation(purchasePrice: Decimal.Value, currentPrice: Decimal.Value) {
  const [position] = ledgerPositions([purchase("BAI", 10, purchasePrice)], options);
  return valuePositions([position], { BAI: currentPrice })[0];
}

describe("PortfolioCalculator", () => {
  it("one position calculates invested value and average", () => {
    const positions = ledgerPositions([purchase("BAI", 10, 50)], options);

    expect(positions).toHaveLength(1);
    expectDecimal(positions[0].quantity, 10);
    expectDecimal(positions[0].investedAmount, 500);
    expectDecimal(positions[0].averagePurchasePrice, 50);
  });

  it("multiple positions remain independent", () => {
    const positions = ledgerPositions([purchase("BAI", 10, 50), purchase("UNITEL", 3, 100)], options);

    expect(positions).toHaveLength(2);
    expectDecimal(positions[0].investedAmount.plus(positions[1].investedAmount), 800);
  });

  it("multiple purchases use weighted average price", () => {
    const positions = ledgerPositions(
      [purchase("BAI", 50, 45_000), purchase("BAI", 30, 55_000), purchase("BAI", 20, 61_000)],
      options,
    );

    expectDecimal(positions[0].quantity, 100);
    expectDecimal(positions[0].investedAmount, 5_120_000);
    expectDecimal(positions[0].averagePurchasePrice, 51_200);
  });

  it("partial sale reduces quantity and cost basis at weighted average", () => {
    const positions = ledgerPositions([purchase("BAI", 10, 50), purchase("BAI", 4, 60, { kind: "sell" })], options);
    const valuations = valuePositions(positions, { BAI: 60 });

    expectDecimal(positions[0].quantity, 6);
    expectDecimal(positions[0].investedAmount, 300);
    expectDecimal(positions[0].averagePurchasePrice, 50);
    expectDecimal(valuations[0].currentValue, 360);
    expectDecimal(valuations[0].unrealizedProfitLoss, 60);
    expectDecimal(valuations[0].returnPercentage, 20);
  });

  it("fees raise cost basis and reduce realized gain", () => {
    const ledger = [
      purchase("BAI", 10, 50, { fees: 20 }),
      purchase("BAI", 4, 60, { kind: "sell", fees: 8, tradedOn: day(2026, 2, 1) }),
    ];
    const position = ledgerPositions(ledger, options)[0];
    const results = ledgerResults(ledger, options);

    expectDecimal(position.investedAmount, 312);
    expectDecimal(position.averagePurchasePrice, 52);
    // 4 × 60 − 8 proceeds against 4 × 52 cost.
    expectDecimal(position.realizedProfitLoss, 24);
    expectDecimal(results.realizedProfitLoss, 24);
  });

  it("income is net of withheld tax and keeps quantity", () => {
    const ledger = [
      purchase("BAI", 10, 50),
      purchase("BAI", 1, 1_000, { kind: "income", fees: 100, tradedOn: day(2025, 6, 1) }),
      purchase("BAI", 1, 500, { kind: "income", fees: 50, tradedOn: day(2026, 6, 1) }),
    ];
    const position = ledgerPositions(ledger, options)[0];
    const results = ledgerResults(ledger, options);

    expectDecimal(position.quantity, 10);
    expectDecimal(position.netIncome, 1_350);
    expect(results.years.map((year) => year.year)).toEqual([2026, 2025]);
    expect(results.years.map((year) => text(year.netIncome))).toEqual(["450", "900"]);
  });

  it("closed position keeps realized result", () => {
    const ledger = [purchase("BAI", 10, 50), purchase("BAI", 10, 40, { kind: "sell", tradedOn: day(2026, 3, 1) })];

    expect(ledgerPositions(ledger, options)).toEqual([]);
    expectDecimal(ledgerResults(ledger, options).realizedProfitLoss, -100);
  });

  it("bond nominal is valued at percent of par", () => {
    const priceScales = { OT: portfolioPriceScale("treasury_bond") };
    const positions = ledgerPositions([purchase("OT", 1_000_000, 98, { fees: 500 })], { asOf, priceScales });
    const valuation = valuePositions(positions, { OT: 101 })[0];

    expectDecimal(positions[0].investedAmount, 980_500);
    expectClose(positions[0].averagePurchasePrice, "98.05");
    expectDecimal(valuation.currentValue, 1_010_000);
  });

  it("full sale removes position", () => {
    const positions = ledgerPositions([purchase("BAI", 10, 50), purchase("BAI", 10, 60, { kind: "sell" })], options);

    expect(positions).toEqual([]);
  });

  it("positive return", () => {
    const result = valuation(50, 60);

    expectDecimal(result.unrealizedProfitLoss, 100);
    expectDecimal(result.returnPercentage, 20);
  });

  it("negative return", () => {
    const result = valuation(50, 40);

    expectDecimal(result.unrealizedProfitLoss, -100);
    expectDecimal(result.returnPercentage, -20);
  });

  it("zero return", () => {
    const result = valuation(50, 50);

    expectDecimal(result.unrealizedProfitLoss, 0);
    expectDecimal(result.returnPercentage, 0);
  });

  it("allocation uses current values", () => {
    const positions = ledgerPositions([purchase("BAI", 1, 10), purchase("UNITEL", 1, 10)], options);
    const allocations = portfolioAllocations(valuePositions(positions, { BAI: 25, UNITEL: 75 }));

    expect(allocations.map((allocation) => allocation.securityId)).toEqual(["UNITEL", "BAI"]);
    expect(allocations.map((allocation) => text(allocation.percentage))).toEqual(["75", "25"]);
  });

  it("historical value respects different purchase dates", () => {
    const transactions = [
      purchase("BAI", 1, 10, { tradedOn: day(2026, 1, 1) }),
      purchase("UNITEL", 2, 20, { tradedOn: day(2026, 1, 3) }),
    ];
    const histories = {
      BAI: closes([[noon(2026, 1, 1), 10], [noon(2026, 1, 2), 11], [noon(2026, 1, 3), 12], [noon(2026, 1, 4), 13]]),
      UNITEL: closes([[noon(2026, 1, 1), 20], [noon(2026, 1, 2), 21], [noon(2026, 1, 3), 22], [noon(2026, 1, 4), 23]]),
    };

    const result = portfolioValueSeries(transactions, histories, { asOf: noon(2026, 1, 4), rangeDays: null });

    expect(result.map((point) => text(point.value))).toEqual(["10", "11", "56", "59"]);
  });

  it("missing historical price omits incomplete portfolio points", () => {
    const transactions = [purchase("BAI", 1, 10), purchase("UNITEL", 1, 20)];

    const result = portfolioValueSeries(transactions, { BAI: closes([[noon(2026, 1, 1), 10]]) }, {
      asOf: noon(2026, 1, 1),
      rangeDays: null,
    });

    expect(result).toEqual([]);
  });

  it("historical value reflects sale from trade date", () => {
    const transactions = [
      purchase("BAI", 10, 10, { tradedOn: day(2026, 1, 1) }),
      purchase("BAI", 4, 12, { kind: "sell", tradedOn: day(2026, 1, 3) }),
    ];

    const result = portfolioValueSeries(
      transactions,
      { BAI: closes([[noon(2026, 1, 1), 10], [noon(2026, 1, 2), 11], [noon(2026, 1, 3), 12], [noon(2026, 1, 4), 13]]) },
      { asOf: noon(2026, 1, 4), rangeDays: null },
    );

    expect(result.map((point) => text(point.value))).toEqual(["100", "110", "72", "78"]);
  });

  it("history starting after selected period does not fabricate values", () => {
    const result = portfolioValueSeries(
      [purchase("BAI", 1, 10, { tradedOn: day(2026, 1, 1) })],
      { BAI: closes([[noon(2026, 1, 20), 15]]) },
      { asOf: noon(2026, 1, 8), rangeDays: 7 },
    );

    expect(result).toEqual([]);
  });

  it("missing latest price produces finite partial summary", () => {
    const positions = ledgerPositions([purchase("BAI", 1, 50), purchase("UNITEL", 1, 100)], options);
    const summary = portfolioSummary(valuePositions(positions, { BAI: 60 }));

    expectDecimal(summary.investedAmount, 150);
    expectDecimal(summary.currentValue, 60);
    expectDecimal(summary.unrealizedProfitLoss, 10);
    expectDecimal(summary.returnPercentage, 20);
    expect(summary.missingPriceCount).toBe(1);
    expect(summary.currentValue.isFinite()).toBe(true);
    expect(summary.returnPercentage.isFinite()).toBe(true);
  });

  it("malformed legacy transactions are excluded safely", () => {
    const transactions = [
      purchase("BAI", 0, 50),
      purchase("BAI", 1, NaN),
      purchase("BAI", 1, 50, { tradedOn: day(2099, 1, 1) }),
    ];

    expect(ledgerPositions(transactions, options)).toEqual([]);
  });

  it("period change follows selected history instead of lifetime profit", () => {
    const transactions = [purchase("BAI", 1, 1_281_200, { tradedOn: day(2026, 1, 1) })];
    const histories = {
      BAI: closes([[noon(2026, 1, 1), 3_110_000], [noon(2026, 1, 25), 2_500_000], [noon(2026, 1, 31), 2_541_000]]),
    };
    const end = noon(2026, 1, 31);
    const month = portfolioPeriodChange(portfolioValueSeries(transactions, histories, { asOf: end, rangeDays: 30 }));
    const week = portfolioPeriodChange(portfolioValueSeries(transactions, histories, { asOf: end, rangeDays: 7 }));
    const summary = portfolioSummary(
      valuePositions(ledgerPositions(transactions, { asOf: end }), { BAI: 2_541_000 }),
    );

    expectDecimal(month?.amount, -569_000);
    expectClose(month?.percentage, "-18.2958199357");
    expectDecimal(week?.amount, 41_000);
    expectClose(week?.percentage, "1.64");
    expectDecimal(summary.unrealizedProfitLoss, 1_259_800);
  });

  it("period change handles flat and zero balances", () => {
    const start = day(2026, 1, 1);
    const end = day(2026, 1, 2);
    const flat = portfolioPeriodChange(points([[start, 100], [end, 100]]));
    const sold = portfolioPeriodChange(points([[start, 100], [end, 0]]));
    const reopened = portfolioPeriodChange(points([[start, 0], [end, 100]]));

    expectDecimal(flat?.amount, 0);
    expectDecimal(flat?.percentage, 0);
    expectDecimal(sold?.amount, -100);
    expectDecimal(sold?.percentage, -100);
    expectDecimal(reopened?.amount, 100);
    expect(reopened).not.toBeNull();
    expect(reopened?.percentage).toBeNull();
  });

  it("period change requires usable endpoints", () => {
    const start = day(2026, 1, 1);
    const end = day(2026, 1, 2);

    expect(portfolioPeriodChange([])).toBeNull();
    expect(portfolioPeriodChange(points([[start, 100]]))).toBeNull();
    expect(portfolioPeriodChange(points([[start, 100], [start, 120]]))).toBeNull();
    expect(portfolioPeriodChange(points([[start, NaN], [end, 120]]))).toBeNull();
    expect(portfolioPeriodChange(points([[start, 100], [end, Infinity]]))).toBeNull();
  });
});
