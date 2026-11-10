import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import {
  type PortfolioTransaction,
  type PortfolioTransactionKind,
  ledgerPositions,
  portfolioAllocations,
  portfolioValueSeries,
  validateLedger,
  valuePositions,
} from "./index";

// Portfolio cases of iOS DataQualityTests. The metadata-freshness case belongs to the intelligence inputs (W14).
const asOf = Date.UTC(2026, 8, 25, 11);
const periodStart = "2026-09-21";

function trade(id: string, quantity: Decimal.Value, kind: PortfolioTransactionKind = "buy", securityId = "A"): PortfolioTransaction {
  return {
    id,
    securityId,
    kind,
    quantity: new Decimal(quantity),
    unitPrice: new Decimal(100),
    fees: new Decimal(0),
    tradedOn: "2026-09-01",
    createdAt: "2026-09-01T01:00:00Z",
  };
}

describe("portfolio data quality", () => {
  it("does not clamp oversells or drop malformed transactions", () => {
    const buy = trade("buy", 10);
    expect(validateLedger([buy, trade("sell", 11, "sell")], { asOf })).not.toBe("valid");
    expect(validateLedger([buy, trade("bad", 0)], { asOf })).not.toBe("valid");
    expect(validateLedger([buy, buy], { asOf })).not.toBe("valid");
    expect(ledgerPositions([buy, trade("bad", 0)], { asOf })).toEqual([]);
  });

  it("does not carry prices across missing sessions", () => {
    const transactions = [trade("A", 1), trade("B", 1, "buy", "B")];
    const series = portfolioValueSeries(
      transactions,
      { A: [{ date: periodStart, value: 100 }, { date: "2026-09-22", value: 110 }], B: [{ date: periodStart, value: 200 }] },
      { asOf, rangeDays: null },
    );
    expect(series).toHaveLength(1);
    const valuations = valuePositions(ledgerPositions(transactions, { asOf }), { A: 100 });
    expect(portfolioAllocations(valuations)).toEqual([]);
  });

  it("keeps a small holding exact after a large sale", () => {
    const large = "9007199254740992";
    const transactions = [trade("a", large), trade("b", 1), trade("c", large, "sell")];
    const [position] = ledgerPositions(transactions, { asOf });
    expect(position.quantity.toString()).toBe("1");
    expect(position.investedAmount.toString()).toBe("100");
    expect(position.averagePurchasePrice.toString()).toBe("100");
  });
});
