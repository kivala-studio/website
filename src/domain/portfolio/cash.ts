import Decimal from "decimal.js";

import { luandaCivilDate } from "../format/date";
import type { CivilDate, Instant } from "../format";
import type { PortfolioTransaction, PriceScales } from "./models";
import { netAmount } from "./records";

/*
 * Cash movements (contract §5.3, iOS `PortfolioCash`). The server stores movements only; the balance is
 * computed here from the movements and the ledger of the same portfolio selection.
 */

export const CASH_KINDS = ["deposit", "withdrawal", "fee"] as const;
export type CashKind = (typeof CASH_KINDS)[number];

export type CashMovement = {
  id: string;
  kind: CashKind;
  amount: Decimal;
  occurredOn: CivilDate;
  /** null is the main portfolio. */
  portfolioId: string | null;
};

/** One movement between the server and the browser: the amount as an exact decimal string. */
export type CashMovementWire = { id: string; kind: CashKind; amount: string; occurredOn: CivilDate; portfolioId: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CIVIL = /^\d{4}-\d{2}-\d{2}$/;
const DECIMAL = /^\d+(\.\d+)?$/;

/** A `portfolio_cash_movements` row (snake case) or a wire movement (camel case); null when malformed. */
export function decodeCashMovement(value: unknown): CashMovementWire | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  const amount = typeof row.amount === "number" && Number.isFinite(row.amount) ? String(row.amount) : row.amount;
  const occurredOn = row.occurred_on ?? row.occurredOn;
  const portfolioId = row.portfolio_id ?? row.portfolioId ?? null;
  if (typeof row.id !== "string" || !UUID.test(row.id) || !(CASH_KINDS as readonly unknown[]).includes(row.kind)) return null;
  if (typeof amount !== "string" || !DECIMAL.test(amount) || typeof occurredOn !== "string" || !CIVIL.test(occurredOn)) return null;
  if (portfolioId !== null && (typeof portfolioId !== "string" || !UUID.test(portfolioId))) return null;
  return { id: row.id.toLowerCase(), kind: row.kind as CashKind, amount: new Decimal(amount).toFixed(), occurredOn, portfolioId: portfolioId?.toLowerCase() ?? null };
}

export const fromCashWire = (wire: CashMovementWire): CashMovement => ({ ...wire, amount: new Decimal(wire.amount) });
export const toCashWire = (movement: CashMovement): CashMovementWire => ({ ...movement, amount: movement.amount.toFixed() });

/** Newest first, then id: the movements list. */
export const newestCashFirst = (a: CashMovement, b: CashMovement) =>
  a.occurredOn !== b.occurredOn ? (a.occurredOn < b.occurredOn ? 1 : -1) : a.id < b.id ? 1 : a.id > b.id ? -1 : 0;

export type CashIssue = "amount" | "futureDate";

/** Why the server would refuse this movement: an amount that is not positive or does not fit numeric(24,8), or a future day. */
export function cashIssues(movement: Pick<CashMovement, "amount" | "occurredOn">, now: Instant): CashIssue[] {
  const issues: CashIssue[] = [];
  const { amount } = movement;
  if (!(amount.isFinite() && amount.gt(0) && amount.lt("1e16") && amount.decimalPlaces() <= 8)) issues.push("amount");
  if (!CIVIL.test(movement.occurredOn) || movement.occurredOn > luandaCivilDate(now)) issues.push("futureDate");
  return issues;
}

/** Deposits add to the balance; withdrawals and fees take from it. */
export const signedCashAmount = (movement: CashMovement) => (movement.kind === "deposit" ? movement.amount : movement.amount.neg());

export type CashSummary = {
  /** Deposits minus withdrawals. */
  netDeposited: Decimal;
  /** Net deposited, minus fees, minus purchases (price and fees), plus sales and income net of fees. */
  balance: Decimal;
  fees: Decimal;
};

export function cashSummary(movements: readonly CashMovement[], transactions: readonly PortfolioTransaction[], priceScales: PriceScales = {}): CashSummary {
  const total = (kind: CashKind) => movements.filter((movement) => movement.kind === kind).reduce((sum, movement) => sum.plus(movement.amount), new Decimal(0));
  const netDeposited = total("deposit").minus(total("withdrawal"));
  const fees = total("fee");
  const trades = transactions.reduce((sum, transaction) => {
    const net = netAmount(transaction, new Decimal(priceScales[transaction.securityId] ?? 1));
    return transaction.kind === "buy" ? sum.minus(net) : sum.plus(net);
  }, new Decimal(0));
  return { netDeposited, balance: netDeposited.minus(fees).plus(trades), fees };
}
