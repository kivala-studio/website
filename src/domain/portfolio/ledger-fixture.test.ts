import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import contract from "../../../tests/fixtures/portfolio-ledger.v1.json";
import {
  type PortfolioTransaction,
  type PortfolioTransactionKind,
  ledgerPositions,
  ledgerResults,
  portfolioPriceScale,
  validateLedger,
  valuePositions,
} from "./index";

// Noon on 2026-11-01 in Luanda, as in the iOS contract test.
const asOf = Date.UTC(2026, 10, 1, 11);

const transaction = (row: (typeof contract.cases)[number]["transactions"][number]): PortfolioTransaction => ({
  id: row.id,
  securityId: row.security,
  kind: row.kind as PortfolioTransactionKind,
  quantity: new Decimal(row.quantity),
  unitPrice: new Decimal(row.unit_price),
  fees: new Decimal(row.fees),
  tradedOn: row.traded_on,
  createdAt: row.created_at,
});

describe("portfolio-ledger.v1.json", () => {
  it("has the eight golden cases", () => {
    expect(contract.cases).toHaveLength(8);
  });

  it.each(contract.cases)("$name", (item) => {
    const transactions = item.transactions.map(transaction);
    const priceScales = Object.fromEntries(
      Object.entries(item.instruments).map(([security, type]) => [security, portfolioPriceScale(type)]),
    );
    const options = { asOf, priceScales };
    const positions = ledgerPositions(transactions, options);
    const results = ledgerResults(transactions, options);
    const valuations = valuePositions(positions, item.prices as Record<string, string>);

    expect(validateLedger(transactions, options) === "valid").toBe(item.expected.valid);
    expect(
      valuations.map(({ position, currentValue }) => ({
        security: position.securityId,
        quantity: position.quantity.toString(),
        invested: position.investedAmount.toString(),
        average_price: position.averagePurchasePrice.toString(),
        realized: position.realizedProfitLoss.toString(),
        net_income: position.netIncome.toString(),
        current_value: currentValue?.toString() ?? null,
      })),
    ).toEqual(item.expected.positions);
    expect(
      results.years.map((year) => ({
        year: year.year,
        realized: year.realizedProfitLoss.toString(),
        net_income: year.netIncome.toString(),
        fees: year.fees.toString(),
      })),
    ).toEqual(item.expected.years);
  });
});
