import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { ledgerPositions, validateLedger } from "./calculator";
import type { PortfolioTransaction } from "./models";
import { decodeTransaction, ledgerOrder, ledgerRefusal, recordIssues } from "./records";

// Ported from iOS `PortfolioCivilDateTests`: trade days are Luanda civil dates, ordered before creation time.
const BUY = "00000000-0000-4000-8000-000000000001";
const SALE = "00000000-0000-4000-8000-000000000002";
const asOf = Date.parse("2026-04-02T12:00:00+01:00");

const trade = (id: string, kind: PortfolioTransaction["kind"], quantity: number, tradedOn: string, createdAt: string): PortfolioTransaction => ({
  id,
  securityId: "bai",
  kind,
  quantity: new Decimal(quantity),
  unitPrice: new Decimal(50),
  fees: new Decimal(0),
  tradedOn,
  createdAt,
});

describe("portfolio civil dates", () => {
  it("lets a sale created later on the same day follow the purchase", () => {
    const buy = trade(BUY, "buy", 10, "2026-04-01", "2026-04-01T08:00:00Z");
    const sale = trade(SALE, "sell", 1, "2026-04-01", "2026-04-01T09:00:00Z");
    expect(validateLedger([sale, buy], { asOf })).toBe("valid");
    expect(ledgerPositions([sale, buy], { asOf })[0].quantity.toFixed()).toBe("9");
    expect(ledgerPositions([sale, buy], { asOf })[0].investedAmount.toFixed()).toBe("450");
  });

  it("keeps earlier sales and oversells invalid", () => {
    const buy = trade(BUY, "buy", 10, "2026-04-01", "2026-04-01T09:00:00Z");
    for (const sale of [trade(SALE, "sell", 1, "2026-04-01", "2026-04-01T07:00:00Z"), trade(SALE, "sell", 11, "2026-04-01", "2026-04-01T10:00:00Z")]) {
      expect(validateLedger([buy, sale], { asOf })).toBe("invalidLedger");
    }
  });

  it("orders by trade day, then creation time, then id", () => {
    const buy = trade(BUY, "buy", 10, "2026-04-01", "2026-04-01T09:00:00Z");
    const sameTime = trade(SALE, "sell", 1, "2026-04-01", "2026-04-01T09:00:00Z");
    const nextDay = trade(SALE, "sell", 1, "2026-04-02", "2026-04-01T08:00:00Z");
    expect([sameTime, buy].sort(ledgerOrder).map((row) => row.id)).toEqual([BUY, SALE]);
    expect([nextDay, buy].sort(ledgerOrder).map((row) => row.id)).toEqual([BUY, SALE]);
    expect(validateLedger([nextDay, buy], { asOf })).toBe("valid");
  });
});

describe("portfolio records", () => {
  const equity = { kind: "equity" as const };
  const record = (change: Partial<PortfolioTransaction>) => ({ ...trade(BUY, "buy", 1, "2026-04-01", "2026-04-01T09:00:00Z"), ...change });

  it("mirrors the server's checks", () => {
    expect(recordIssues(record({}), equity, asOf)).toEqual([]);
    expect(recordIssues(record({ quantity: new Decimal("1.5") }), equity, asOf)).toEqual(["wholeQuantity"]);
    expect(recordIssues(record({ quantity: new Decimal("1.5") }), { kind: "fund" }, asOf)).toEqual([]);
    expect(recordIssues(record({ tradedOn: "2026-04-03" }), equity, asOf)).toEqual(["futureDate"]);
    expect(recordIssues(record({ kind: "income", fees: new Decimal(51) }), equity, asOf)).toEqual(["taxExceedsGross"]);
    expect(recordIssues(record({ unitPrice: new Decimal(0), fees: new Decimal(-1) }), equity, asOf)).toEqual(["price", "fees"]);
    expect(recordIssues(record({ quantity: new Decimal("1e16") }), equity, asOf)).toEqual(["overflow"]);
    expect(recordIssues(record({}), { kind: "equity", currency: "USD" }, asOf)).toEqual(["unsupported"]);
  });

  it("maps every ledger rule the server enforces", () => {
    const error = (code: string, message: string) => ({ code, message });
    expect(ledgerRefusal(error("23514", "Portfolio sale exceeds holdings"))).toBe("oversell");
    expect(ledgerRefusal(error("23514", "Portfolio transaction identity cannot change"))).toBe("identity");
    expect(ledgerRefusal(error("23514", "Unsupported portfolio instrument or quantity"))).toBe("unsupported");
    expect(ledgerRefusal(error("22007", "portfolio transaction date cannot be in the future"))).toBe("futureDate");
    expect(ledgerRefusal(error("23514", 'new row violates check constraint "portfolio_transactions_income_shape"'))).toBe("income");
    expect(ledgerRefusal(error("23514", 'new row violates check constraint "portfolio_transactions_quantity_check"'))).toBeNull();
    expect(ledgerRefusal(error("42501", "denied"))).toBeNull();
  });

  it("decodes ledger rows exactly and rejects malformed ones", () => {
    const row = { id: BUY.toUpperCase(), security_id: "BAI", transaction_kind: "buy", quantity: "9999999999999999.12345678", unit_price: 50, fees: null, traded_on: "2026-04-01", created_at: "2026-04-01T09:00:00.123456+00:00" };
    expect(decodeTransaction(row)).toMatchObject({ id: BUY, securityId: "bai", quantity: "9999999999999999.12345678", unitPrice: "50", fees: "0" });
    expect(decodeTransaction({ ...row, traded_on: "2026-02-30" })).toBeNull();
    expect(decodeTransaction({ ...row, transaction_kind: "split" })).toBeNull();
  });
});
