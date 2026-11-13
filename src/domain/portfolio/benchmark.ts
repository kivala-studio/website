import Decimal from "decimal.js";

import { type CivilDate, civilDaysBetween } from "../format/date";
import type { PortfolioTransaction, PriceScales, ValuePoint } from "./models";
import { netAmount } from "./records";

/*
 * iOS `PortfolioBenchmark`: what the same money would be worth at a reference rate. From the first chart
 * point, the value compounds continuously at ln(1 + rate) / 365 per day; buys after that point add their
 * cost, sales and income take their net amount out; the value never goes below zero.
 */

/** `market_rates.rate_name` per benchmark, in picker order. */
export const BENCHMARK_RATES = [
  { key: "inflation", name: "Inflação Homóloga" },
  { key: "policyRate", name: "Taxa Básica do BNA" },
  { key: "luibor", name: "Taxa LUIBOR Overnight" },
  { key: "treasuryBill", name: "BTs - 364 Dias" },
] as const;

export type BenchmarkRate = (typeof BENCHMARK_RATES)[number]["key"];

export type BenchmarkQuote = { rate: BenchmarkRate; /** Annual percent. */ value: Decimal; tradingDate: CivilDate };

/** A quote between the server page and the browser: the value as an exact decimal string. */
export type BenchmarkQuoteWire = Omit<BenchmarkQuote, "value"> & { value: string };
export const toQuoteWire = (quote: BenchmarkQuote): BenchmarkQuoteWire => ({ ...quote, value: quote.value.toFixed() });
export const fromQuoteWire = (wire: BenchmarkQuoteWire): BenchmarkQuote => ({ ...wire, value: new Decimal(wire.value) });

/** The latest finite value of each rate, from `market_rates` rows of any order. */
export function latestBenchmarkQuotes(rows: readonly unknown[]): BenchmarkQuote[] {
  const latest = new Map<BenchmarkRate, BenchmarkQuote>();
  for (const value of rows) {
    const row = (value ?? {}) as Record<string, unknown>;
    const rate = BENCHMARK_RATES.find((item) => item.name === row.rate_name)?.key;
    const number = typeof row.value === "number" || (typeof row.value === "string" && /^-?\d+(\.\d+)?$/.test(row.value)) ? new Decimal(row.value) : null;
    const day = typeof row.trading_date === "string" ? row.trading_date.slice(0, 10) : "";
    if (!rate || !number?.isFinite() || !/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const current = latest.get(rate);
    if (!current || day > current.tradingDate) latest.set(rate, { rate, value: number, tradingDate: day });
  }
  return BENCHMARK_RATES.flatMap((item) => latest.get(item.key) ?? []);
}

/** The benchmark line on the same days as `values`; empty when the rate cannot compound (≤ −100 %). */
export function benchmarkSeries(values: readonly ValuePoint[], transactions: readonly PortfolioTransaction[], priceScales: PriceScales, annualRate: Decimal): ValuePoint[] {
  const first = values[0];
  if (!first || !annualRate.isFinite() || annualRate.lte(-100)) return [];
  const daily = annualRate.div(100).plus(1).ln().div(365);
  const grow = (value: Decimal, from: CivilDate, to: CivilDate) => value.times(daily.times(civilDaysBetween(from, to)).exp());
  const flows = transactions
    .filter((transaction) => transaction.tradedOn > first.day)
    .map((transaction) => {
      const net = netAmount(transaction, new Decimal(priceScales[transaction.securityId] ?? 1));
      return { day: transaction.tradedOn, amount: transaction.kind === "buy" ? net : net.neg() };
    })
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));

  let balance = first.value;
  let day = first.day;
  let next = 0;
  return values.map((point) => {
    while (next < flows.length && flows[next].day <= point.day) {
      balance = grow(balance, day, flows[next].day).plus(flows[next].amount);
      day = flows[next].day;
      next += 1;
    }
    balance = grow(balance, day, point.day);
    day = point.day;
    return { day: point.day, value: Decimal.max(0, balance) };
  });
}
