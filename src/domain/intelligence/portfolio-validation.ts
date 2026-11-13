import Decimal from "decimal.js";

import type { DataQualityReport } from "../market/quality";
import { VALID_QUALITY, qualityFailure } from "../market/quality";
import { type EpochMs, DAY_MS, dayStart, parseInstant, startOfDay } from "../market/zone";
import type { PortfolioTransaction } from "../portfolio/models";
import { Dec } from "./math";
import type { PortfolioInsightInput } from "./models";

/*
 * iOS `PortfolioPriceChangeCalculator` and `PortfolioInputValidator` (DataQuality.swift), with the
 * `PortfolioTransaction` helpers they use (`tradingDay`, `isEarlierInLedger`, `isValid`).
 */

/** Exact intermediate arithmetic; `foundation` then decides whether Foundation `Decimal` could hold the result. */
const Exact = Decimal.clone({ precision: 200, rounding: Decimal.ROUND_HALF_UP, minE: -9e15, maxE: 9e15 });
/** Foundation `Decimal`: a 128-bit mantissa with a base-10 exponent in -128...127. */
const MANTISSA_LIMIT = new Exact(2).pow(128);

function foundation(value: Decimal): Decimal | null {
  if (!value.isFinite()) return null;
  if (value.isZero()) return new Dec(0);
  const digits = value.sd();
  const exponent = value.e - (digits - 1);
  const mantissa = value.abs().div(new Exact(10).pow(exponent));
  if (mantissa.greaterThanOrEqualTo(MANTISSA_LIMIT) || exponent < -128 || exponent > 127) return null;
  return value;
}

/** Checked operations: a result Foundation would have to round or could not represent fails closed. */
export function add(lhs: Decimal, rhs: Decimal): Decimal | null {
  if (lhs.isNaN() || rhs.isNaN()) return null;
  return foundation(new Exact(lhs).plus(new Exact(rhs)));
}

export function subtract(lhs: Decimal, rhs: Decimal): Decimal | null {
  if (lhs.isNaN() || rhs.isNaN()) return null;
  return foundation(new Exact(lhs).minus(new Exact(rhs)));
}

export function multiply(lhs: Decimal, rhs: Decimal): Decimal | null {
  if (lhs.isNaN() || rhs.isNaN()) return null;
  return foundation(new Exact(lhs).times(new Exact(rhs)));
}

/** Division may round (Foundation reports loss of precision, which is accepted). */
export function divide(lhs: Decimal, rhs: Decimal): Decimal | null {
  if (lhs.isNaN() || rhs.isNaN() || !rhs.greaterThan(0)) return null;
  const result = new Dec(lhs).div(new Dec(rhs));
  return result.isFinite() ? result : null;
}

/** Luanda midnight of the trade day, or NaN when the civil date is malformed. */
export const tradingDay = (transaction: PortfolioTransaction): EpochMs => dayStart(transaction.tradedOn) ?? Number.NaN;
/** The trade day at noon, as iOS stores `tradedOn`. */
export const tradedOnNoon = (transaction: PortfolioTransaction): EpochMs => tradingDay(transaction) + DAY_MS / 2;
export const createdAtInstant = (transaction: PortfolioTransaction): EpochMs => parseInstant(transaction.createdAt) ?? Number.NaN;

export function isEarlierInLedger(a: PortfolioTransaction, b: PortfolioTransaction): boolean {
  const dayA = tradingDay(a);
  const dayB = tradingDay(b);
  if (dayA !== dayB) return dayA < dayB;
  const createdA = createdAtInstant(a);
  const createdB = createdAtInstant(b);
  if (createdA !== createdB) return createdA < createdB;
  return a.id < b.id;
}

const ledgerComparator = (a: PortfolioTransaction, b: PortfolioTransaction) => (isEarlierInLedger(a, b) ? -1 : isEarlierInLedger(b, a) ? 1 : 0);

export function isValidTransaction(transaction: PortfolioTransaction, asOf: EpochMs): boolean {
  const { quantity, unitPrice, fees, kind } = transaction;
  const day = tradingDay(transaction);
  return (
    !quantity.isNaN() &&
    !unitPrice.isNaN() &&
    quantity.greaterThan(0) &&
    unitPrice.greaterThan(0) &&
    !fees.isNaN() &&
    fees.greaterThanOrEqualTo(0) &&
    (kind !== "income" || (quantity.equals(1) && fees.lessThanOrEqualTo(unitPrice))) &&
    Number.isFinite(day) &&
    Number.isFinite(createdAtInstant(transaction)) &&
    Number.isFinite(asOf) &&
    day <= startOfDay(asOf)
  );
}

/** Open quantities from trades before `boundary` (exclusive), in ledger order; any impossible step fails the ledger. */
export function quantities(transactions: readonly PortfolioTransaction[], before: EpochMs): Map<string, Decimal> | null {
  const result = new Map<string, Decimal>();
  const ordered = transactions.filter((transaction) => tradingDay(transaction) < before).sort(ledgerComparator);
  const seen = new Set<string>();
  for (const transaction of ordered) {
    if (seen.has(transaction.id)) return null;
    seen.add(transaction.id);
    const amount = transaction.quantity;
    if (amount.isNaN() || !amount.greaterThan(0)) return null;
    const current = result.get(transaction.securityId) ?? new Dec(0);
    let next: Decimal | null;
    switch (transaction.kind) {
      case "buy":
        next = add(current, amount);
        break;
      case "sell":
        if (amount.greaterThan(current)) return null;
        next = subtract(current, amount);
        break;
      case "income":
        next = current;
        break;
    }
    if (next === null) return null;
    result.set(transaction.securityId, next);
  }
  return new Map([...result].filter(([, value]) => value.greaterThan(0)));
}

export function validateRecords(transactions: readonly PortfolioTransaction[], asOf: EpochMs): DataQualityReport {
  if (
    !Number.isFinite(asOf) ||
    !transactions.every(
      (transaction) =>
        transaction.id !== "" &&
        transaction.securityId !== "" &&
        isValidTransaction(transaction, asOf) &&
        multiply(transaction.quantity, transaction.unitPrice) !== null,
    )
  ) {
    return qualityFailure("invalid", "invalidLedger");
  }
  if (new Set(transactions.map((transaction) => transaction.id)).size !== transactions.length) return qualityFailure("invalid", "duplicateObservation");
  return VALID_QUALITY;
}

export function validateLedger(transactions: readonly PortfolioTransaction[], asOf: EpochMs): DataQualityReport {
  const records = validateRecords(transactions, asOf);
  if (records.status !== "valid" || records.reasons.length > 0) return records;
  if (quantities(transactions, Number.POSITIVE_INFINITY) === null) return qualityFailure("invalid", "invalidLedger");
  return VALID_QUALITY;
}

const isValidInterval = (start: EpochMs, endExclusive: EpochMs) => Number.isFinite(start) && Number.isFinite(endExclusive) && start < endExclusive;

export function validatePortfolioInput(input: PortfolioInsightInput, asOf: EpochMs, maximumAgeMs: number): DataQualityReport {
  const ledger = validateLedger(input.transactions, asOf);
  if (ledger.status !== "valid" || ledger.reasons.length > 0) return ledger;
  if (!input.transactions.every((transaction) => createdAtInstant(transaction) <= asOf)) return qualityFailure("invalid", "invalidTimestamp");
  const fetches = [input.ledgerFetchedAt, input.metadataFetchedAt];
  if (
    !(Number.isFinite(maximumAgeMs) && maximumAgeMs > 0) ||
    !isValidInterval(input.week.start, input.week.endExclusive) ||
    !fetches.every((fetched) => Number.isFinite(fetched) && fetched <= asOf)
  ) {
    return qualityFailure("invalid", "invalidTimestamp");
  }
  if (!fetches.every((fetched) => asOf - fetched < maximumAgeMs)) return qualityFailure("stale", "staleFetch");
  if (new Set(input.securities.map((security) => security.assetID)).size !== input.securities.length) return qualityFailure("invalid", "duplicateObservation");
  const held = quantities(input.transactions, input.week.endExclusive) ?? new Map<string, Decimal>();
  const metadata = new Map(input.securities.map((security) => [security.assetID, security]));
  const supported = [...held.keys()].every((id) => {
    const item = metadata.get(id);
    return item !== undefined && item.symbol !== "" && item.assetID !== "" && item.currencyCode === "AOA" && item.supportsUnitValuation;
  });
  if (!supported) return qualityFailure("incomplete", "missingMetadata");
  for (const trade of input.transactions) {
    if (!held.has(trade.securityId)) continue;
    const item = metadata.get(trade.securityId);
    if (!item) return qualityFailure("incomplete", "missingMetadata");
    if (!(item.allowsFractionalQuantity ?? false) && !trade.quantity.isInteger()) return qualityFailure("invalid", "invalidLedger");
  }
  return VALID_QUALITY;
}
