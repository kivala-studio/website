import Decimal from "decimal.js";

import { luandaCivilDate } from "../format/date";
import type { CivilDate, Instant } from "../format";
import { isBondKind } from "../market/classification";
import type { MarketSecurity, SecurityKind } from "../market/models";
import { validateLedger } from "./calculator";
import type { PortfolioTransaction, PortfolioTransactionKind, PriceScales } from "./models";

/*
 * Ledger records as they travel (contract §5.1): amounts as exact decimal strings, dates as Luanda civil
 * days. The checks below mirror the server's, so the editor and the import review refuse what the
 * server would refuse, with the same reasons.
 */

export const TRANSACTION_KINDS: readonly PortfolioTransactionKind[] = ["buy", "sell", "income"];

/** One record on the wire, between the server and the browser. */
export type TransactionWire = {
  id: string;
  securityId: string;
  kind: PortfolioTransactionKind;
  quantity: string;
  unitPrice: string;
  fees: string;
  tradedOn: CivilDate;
  createdAt: string;
  /** null is the main portfolio. */
  portfolioId: string | null;
};

const CIVIL = /^\d{4}-\d{2}-\d{2}$/;
const DECIMAL = /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const text = (value: unknown) => (typeof value === "string" && value !== "" ? value : undefined);
const decimalText = (value: unknown) =>
  (typeof value === "number" && Number.isFinite(value)) || (typeof value === "string" && DECIMAL.test(value)) ? new Decimal(value).toFixed() : undefined;

function isCivilDate(value: string): boolean {
  if (!CIVIL.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** A row of `get_portfolio_ledger_page` (snake case) or a wire record (camel case); null when malformed. */
export function decodeTransaction(value: unknown): TransactionWire | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  const id = text(row.id);
  const securityId = text(row.security_id ?? row.securityId);
  const kind = text(row.transaction_kind ?? row.kind);
  const quantity = decimalText(row.quantity);
  const unitPrice = decimalText(row.unit_price ?? row.unitPrice);
  const fees = decimalText(row.fees ?? 0);
  const tradedOn = text(row.traded_on ?? row.tradedOn);
  const createdAt = text(row.created_at ?? row.createdAt);
  const portfolioId = row.portfolio_id ?? row.portfolioId ?? null;
  if (portfolioId !== null && (typeof portfolioId !== "string" || !UUID.test(portfolioId))) return null;
  if (!id || !UUID.test(id) || !securityId || !kind || !(TRANSACTION_KINDS as readonly string[]).includes(kind)) return null;
  if (!quantity || !unitPrice || !fees || !tradedOn || !isCivilDate(tradedOn) || !createdAt || Number.isNaN(Date.parse(createdAt))) return null;
  return { id: id.toLowerCase(), securityId: securityId.toLowerCase(), kind: kind as PortfolioTransactionKind, quantity, unitPrice, fees, tradedOn, createdAt, portfolioId: portfolioId?.toLowerCase() ?? null };
}

export const fromWire = (wire: TransactionWire): PortfolioTransaction => ({
  id: wire.id,
  securityId: wire.securityId,
  kind: wire.kind,
  quantity: new Decimal(wire.quantity),
  unitPrice: new Decimal(wire.unitPrice),
  fees: new Decimal(wire.fees),
  tradedOn: wire.tradedOn,
  createdAt: wire.createdAt,
  portfolioId: wire.portfolioId,
});

export const toWire = (transaction: PortfolioTransaction): TransactionWire => ({
  id: transaction.id,
  securityId: transaction.securityId,
  kind: transaction.kind,
  quantity: transaction.quantity.toFixed(),
  unitPrice: transaction.unitPrice.toFixed(),
  fees: transaction.fees.toFixed(),
  tradedOn: transaction.tradedOn,
  createdAt: transaction.createdAt,
  portfolioId: transaction.portfolioId ?? null,
});

/** Ledger order: trade day, then creation time, then id (contract §5.1). */
export function ledgerOrder(a: PortfolioTransaction, b: PortfolioTransaction): number {
  if (a.tradedOn !== b.tradedOn) return a.tradedOn < b.tradedOn ? -1 : 1;
  const created = Date.parse(a.createdAt) - Date.parse(b.createdAt);
  if (created !== 0 && Number.isFinite(created)) return created;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export const newestFirst = (a: PortfolioTransaction, b: PortfolioTransaction) => ledgerOrder(b, a);

// MARK: Instruments

/** Instruments a ledger may hold: equities, funds and bonds in AOA. */
export const supportsLedger = (security: Pick<MarketSecurity, "kind" | "currency">) =>
  (security.kind === "equity" || security.kind === "fund" || isBondKind(security.kind)) && (security.currency ?? "AOA") === "AOA";

export const allowsFractionalQuantity = (kind: SecurityKind) => kind !== "equity";

/** Bonds quote as a percentage of nominal. */
export const priceScaleOf = (kind: SecurityKind) => new Decimal(isBondKind(kind) ? "0.01" : 1);

export const priceScalesOf = (securities: readonly Pick<MarketSecurity, "id" | "kind">[]): PriceScales =>
  Object.fromEntries(securities.map((security) => [security.id, priceScaleOf(security.kind)]));

// MARK: Checks

/** numeric(24,8): at most 16 integer digits and 8 decimals. */
const fitsColumn = (value: Decimal) => value.isFinite() && value.abs().lt("1e16") && value.decimalPlaces() <= 8;

/**
 * Why the server would refuse a record, by contract §5.1 rule, or by field for the editor:
 * `quantity`, `wholeQuantity`, `price`, `fees`, `taxExceedsGross`, `overflow`, `futureDate`, `unsupported`.
 */
export type RecordIssue = "quantity" | "wholeQuantity" | "price" | "fees" | "taxExceedsGross" | "overflow" | "futureDate" | "unsupported";

/** Every issue of one record for that instrument, as of `now`; empty when the server would accept it. */
export function recordIssues(transaction: PortfolioTransaction, security: Pick<MarketSecurity, "kind" | "currency"> | undefined, now: Instant): RecordIssue[] {
  const issues: RecordIssue[] = [];
  const { quantity, unitPrice, fees, kind } = transaction;
  if (!security || !supportsLedger(security)) issues.push("unsupported");
  if (!(quantity.isFinite() && quantity.gt(0))) issues.push("quantity");
  else if (security && !allowsFractionalQuantity(security.kind) && !quantity.isInteger()) issues.push("wholeQuantity");
  if (!(unitPrice.isFinite() && unitPrice.gt(0))) issues.push("price");
  if (!(fees.isFinite() && fees.gte(0))) issues.push("fees");
  else if (kind === "income" && unitPrice.isFinite() && fees.gt(unitPrice)) issues.push("taxExceedsGross");
  if (kind === "income" && !quantity.eq(1)) issues.push("quantity");
  const cost = quantity.times(unitPrice).plus(fees);
  if (![quantity, unitPrice, fees, cost].every(fitsColumn)) issues.push("overflow");
  if (!isCivilDate(transaction.tradedOn) || transaction.tradedOn > luandaCivilDate(now)) issues.push("futureDate");
  return [...new Set(issues)];
}

/**
 * Whether the ledger stays valid with this change (`PortfolioStore.permitsMutation`): a change that would
 * oversell is refused before it is sent. A ledger that is already invalid accepts any change.
 */
export function permitsChange(ledger: readonly PortfolioTransaction[], next: readonly PortfolioTransaction[], now: Instant): boolean {
  return validateLedger(ledger, { asOf: now }) !== "valid" || validateLedger(next, { asOf: now }) === "valid";
}

/** Cash effect in AOA: buys cost price plus fees, sales and income pay out net of fees. */
export function netAmount(transaction: PortfolioTransaction, priceScale: Decimal): Decimal {
  const gross = transaction.quantity.times(transaction.unitPrice);
  switch (transaction.kind) {
    case "buy":
      return gross.times(priceScale).plus(transaction.fees);
    case "sell":
      return gross.times(priceScale).minus(transaction.fees);
    case "income":
      return gross.minus(transaction.fees);
  }
}

// MARK: Server answers

/** A ledger write the server refused for a rule the editor shows inline (contract §5.1). */
export type LedgerRefusal = "unsupported" | "identity" | "oversell" | "futureDate" | "income";

/** The rule behind a `23514`/`22007` error, or null for any other error. */
export function ledgerRefusal(error: unknown): LedgerRefusal | null {
  if (typeof error !== "object" || error === null) return null;
  const { code, message } = error as { code?: unknown; message?: unknown };
  const text = typeof message === "string" ? message.toLowerCase() : "";
  if (code === "22007") return "futureDate";
  if (code !== "23514") return null;
  if (text.includes("exceeds holdings")) return "oversell";
  if (text.includes("identity")) return "identity";
  if (text.includes("unsupported portfolio instrument")) return "unsupported";
  if (text.includes("future")) return "futureDate";
  // `portfolio_transactions_income_shape`: quantity 1 and tax no larger than the gross amount.
  return text.includes("income") ? "income" : null;
}
