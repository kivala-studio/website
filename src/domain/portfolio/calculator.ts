import Decimal from "decimal.js";

import type { CivilDate, Instant, Numeric } from "../format";
import { civilDaysBetween, luandaCivilDate, parseCivilDate } from "../format/date";
import type {
  HistoryPoint,
  LedgerOptions,
  LedgerValidity,
  PortfolioAllocation,
  PortfolioInstrumentYear,
  PortfolioPeriodChange,
  PortfolioPosition,
  PortfolioResults,
  PortfolioResultsYear,
  PortfolioSummary,
  PortfolioTransaction,
  PortfolioValuation,
  PriceScales,
  ValuePoint,
  ValueSeriesOptions,
} from "./models";

const PLAIN = { toExpNeg: -9e15, toExpPos: 9e15 } as const;

// Contract §5.1: exact decimals; iOS also drops the ledger when a sum or product exceeds its 38-digit mantissa.
const Exact = Decimal.clone({ ...PLAIN, precision: 1000, rounding: Decimal.ROUND_HALF_UP });
/** Quotients round like NSDecimalDivide with `.plain`: 38 significant digits, half away from zero. */
const Quotient = Decimal.clone({ ...PLAIN, precision: 38, rounding: Decimal.ROUND_HALF_UP });

const ZERO = new Exact(0);
const HUNDRED = new Exact(100);
const BOND_SCALE = new Exact("0.01");

const exact = (value: Numeric) => new Exact(value);

function divide(lhs: Decimal, rhs: Decimal): Decimal | null {
  if (!lhs.isFinite() || !rhs.isFinite() || !rhs.gt(0)) return null;
  return exact(new Quotient(lhs).div(rhs));
}

/** Bonds quote as a percentage of nominal. Takes the backend security type. */
export function portfolioPriceScale(securityType: string): Decimal {
  return securityType === "bond" || securityType === "treasury_bond" ? BOND_SCALE : exact(1);
}

// MARK: Ordering

type CreatedKey = { seconds: number; nanos: number };

const ISO_INSTANT = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}(?::?\d{2})?)$/i;

/** Keeps sub-millisecond precision so same-day ties sort like the server's `created_at`. */
function createdKey(value: string): CreatedKey | null {
  const match = ISO_INSTANT.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day
    || utc.getUTCHours() !== hour || utc.getUTCMinutes() !== minute || utc.getUTCSeconds() !== second
  ) {
    return null;
  }
  const zone = match[8].toUpperCase();
  let offset = 0;
  if (zone !== "Z") {
    const digits = zone.slice(1).replace(":", "");
    offset = (zone[0] === "-" ? -1 : 1) * (Number(digits.slice(0, 2)) * 3600 + Number(digits.slice(2) || "0") * 60);
  }
  return { seconds: utc.getTime() / 1000 - offset, nanos: Number((match[7] ?? "").padEnd(9, "0")) };
}

type Row = PortfolioTransaction & { created: CreatedKey };

/** Ledger order: trading day, then `createdAt`, then `id`. */
function compareRows(a: Row, b: Row): number {
  if (a.tradedOn !== b.tradedOn) return a.tradedOn < b.tradedOn ? -1 : 1;
  if (a.created.seconds !== b.created.seconds) return a.created.seconds - b.created.seconds;
  if (a.created.nanos !== b.created.nanos) return a.created.nanos - b.created.nanos;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

const bookKey = (row: PortfolioTransaction) => `${row.portfolioId ?? ""}\u0000${row.securityId}`;

function isCivilDate(value: string): boolean {
  try {
    parseCivilDate(value);
    return true;
  } catch {
    return false;
  }
}

function luandaDay(instant: Instant): CivilDate | null {
  try {
    return luandaCivilDate(instant);
  } catch {
    return null;
  }
}

/** Rows with exact decimals and parsed timestamps, in ledger order; null if any record is malformed. */
function orderedRows(transactions: readonly PortfolioTransaction[], today: CivilDate): Row[] | null {
  const rows: Row[] = [];
  for (const transaction of transactions) {
    const created = createdKey(transaction.createdAt);
    const quantity = exact(transaction.quantity);
    const unitPrice = exact(transaction.unitPrice);
    const fees = exact(transaction.fees);
    const valid = created !== null
      && transaction.id !== "" && transaction.securityId !== ""
      && quantity.isFinite() && unitPrice.isFinite() && fees.isFinite()
      && quantity.gt(0) && unitPrice.gt(0) && fees.gte(0)
      && (transaction.kind !== "income" || (quantity.eq(1) && fees.lte(unitPrice)))
      && isCivilDate(transaction.tradedOn) && transaction.tradedOn <= today;
    if (!valid) return null;
    rows.push({ ...transaction, quantity, unitPrice, fees, created });
  }
  return rows.sort(compareRows);
}

// MARK: Validation

type Inspection = { validity: LedgerValidity; rows: Row[] };

function inspect(transactions: readonly PortfolioTransaction[], asOf: Instant): Inspection {
  const today = luandaDay(asOf);
  const rows = today === null ? null : orderedRows(transactions, today);
  if (rows === null) return { validity: "invalidLedger", rows: [] };
  if (new Set(rows.map((row) => row.id)).size !== rows.length) return { validity: "duplicateObservation", rows: [] };
  return { validity: heldQuantities(rows) === null ? "invalidLedger" : "valid", rows };
}

/** A ledger is usable only when every record is well formed, ids are unique and no sale exceeds holdings. */
export function validateLedger(transactions: readonly PortfolioTransaction[], { asOf }: Pick<LedgerOptions, "asOf">): LedgerValidity {
  return inspect(transactions, asOf).validity;
}

/** Quantity held per security after the given rows (already in ledger order); null on an oversell. */
function heldQuantities(rows: readonly Row[]): Map<string, Decimal> | null {
  // Contract §5.1: balances are checked per portfolio_id; iOS checks one balance per security across books.
  const books = new Map<string, Decimal>();
  const held = new Map<string, Decimal>();
  for (const row of rows) {
    if (row.kind === "income") continue;
    const key = bookKey(row);
    const current = books.get(key) ?? ZERO;
    if (row.kind === "sell" && row.quantity.gt(current)) return null;
    const delta = row.kind === "buy" ? row.quantity : row.quantity.neg();
    books.set(key, current.plus(delta));
    held.set(row.securityId, (held.get(row.securityId) ?? ZERO).plus(delta));
  }
  return held;
}

// MARK: Ledger

type Entry = { day: CivilDate; realized: Decimal; income: Decimal; fees: Decimal; withheld: Decimal };

type Ledger = {
  priceScale: Decimal;
  /** Quantity and cost basis per portfolio. */
  books: Map<string, { quantity: Decimal; invested: Decimal }>;
  realized: Decimal;
  income: Decimal;
  purchases: PortfolioTransaction[];
  entries: Entry[];
};

const scaleFor = (priceScales: PriceScales | undefined, securityId: string) => exact(priceScales?.[securityId] ?? 1);

/**
 * Buys add cost plus fees. Sales realize proceeds net of fees against average cost.
 * Income adds its gross amount net of withheld tax and never changes quantity.
 */
function ledgers(transactions: readonly PortfolioTransaction[], { asOf, priceScales }: LedgerOptions): Map<string, Ledger> | null {
  const { validity, rows } = inspect(transactions, asOf);
  if (validity !== "valid") return null;

  const result = new Map<string, Ledger>();
  for (const row of rows) {
    let ledger = result.get(row.securityId);
    if (!ledger) {
      const priceScale = scaleFor(priceScales, row.securityId);
      if (!priceScale.isFinite()) return null;
      ledger = { priceScale, books: new Map(), realized: ZERO, income: ZERO, purchases: [], entries: [] };
      result.set(row.securityId, ledger);
    }
    // Contract §5.1: average cost runs per portfolio_id; iOS runs one average per security across books.
    const key = bookKey(row);
    const book = ledger.books.get(key) ?? { quantity: ZERO, invested: ZERO };
    ledger.books.set(key, book);
    const gross = row.quantity.times(row.unitPrice);
    const entry: Entry = { day: row.tradedOn, realized: ZERO, income: ZERO, fees: row.fees, withheld: ZERO };

    switch (row.kind) {
      case "buy":
        book.quantity = book.quantity.plus(row.quantity);
        book.invested = book.invested.plus(gross.times(ledger.priceScale).plus(row.fees));
        ledger.purchases.push(row);
        break;
      case "sell": {
        const averageCost = divide(book.invested, book.quantity);
        if (averageCost === null || row.quantity.gt(book.quantity)) return null;
        const soldCost = row.quantity.times(averageCost);
        const gain = gross.times(ledger.priceScale).minus(row.fees).minus(soldCost);
        ledger.realized = ledger.realized.plus(gain);
        book.quantity = book.quantity.minus(row.quantity);
        book.invested = book.quantity.isZero() ? ZERO : book.invested.minus(soldCost);
        entry.realized = gain;
        break;
      }
      case "income": {
        const net = gross.minus(row.fees);
        ledger.income = ledger.income.plus(net);
        entry.income = net;
        entry.withheld = row.fees;
        break;
      }
    }
    ledger.entries.push(entry);
  }
  return result;
}

const sum = (values: Iterable<Decimal>) => {
  let total = ZERO;
  for (const value of values) total = total.plus(value);
  return total;
};

const bySecurity = <T extends { securityId: string }>(a: T, b: T) =>
  a.securityId < b.securityId ? -1 : a.securityId > b.securityId ? 1 : 0;

/** Open positions, sorted by security id. Empty when the ledger is invalid. */
export function ledgerPositions(transactions: readonly PortfolioTransaction[], options: LedgerOptions): PortfolioPosition[] {
  const all = ledgers(transactions, options);
  if (!all) return [];
  const positions: PortfolioPosition[] = [];
  for (const [securityId, ledger] of all) {
    const books = [...ledger.books.values()];
    const quantity = sum(books.map((book) => book.quantity));
    const investedAmount = sum(books.map((book) => book.invested));
    if (!quantity.gt(0)) continue;
    const averageCost = divide(investedAmount, quantity);
    const averagePurchasePrice = averageCost && divide(averageCost, ledger.priceScale);
    if (!averagePurchasePrice) continue;
    positions.push({
      securityId,
      purchases: ledger.purchases,
      quantity,
      investedAmount,
      averagePurchasePrice,
      priceScale: ledger.priceScale,
      realizedProfitLoss: ledger.realized,
      netIncome: ledger.income,
    });
  }
  return positions.sort(bySecurity);
}

const yearOf = (day: CivilDate) => Number(day.slice(0, 4));

/** Realized gains, net income and fees per calendar year of `tradedOn`, closed positions included. */
export function ledgerResults(transactions: readonly PortfolioTransaction[], options: LedgerOptions): PortfolioResults {
  const all = ledgers(transactions, options);
  const buckets = new Map<number, PortfolioResultsYear>();
  for (const entry of all ? [...all.values()].flatMap((ledger) => ledger.entries) : []) {
    const year = yearOf(entry.day);
    const bucket = buckets.get(year) ?? { year, realizedProfitLoss: ZERO, netIncome: ZERO, fees: ZERO };
    buckets.set(year, {
      year,
      realizedProfitLoss: bucket.realizedProfitLoss.plus(entry.realized),
      netIncome: bucket.netIncome.plus(entry.income),
      fees: bucket.fees.plus(entry.fees),
    });
  }
  const years = [...buckets.values()]
    .filter((year) => !year.realizedProfitLoss.isZero() || !year.netIncome.isZero() || !year.fees.isZero())
    .sort((a, b) => b.year - a.year);
  return {
    years,
    realizedProfitLoss: sum(years.map((year) => year.realizedProfitLoss)),
    netIncome: sum(years.map((year) => year.netIncome)),
    hasEntries: years.some((year) => !year.realizedProfitLoss.isZero() || !year.netIncome.isZero()),
  };
}

/** One calendar year by instrument, for the annual report. */
export function ledgerYearReport(
  transactions: readonly PortfolioTransaction[],
  year: number,
  options: LedgerOptions,
): PortfolioInstrumentYear[] {
  const all = ledgers(transactions, options);
  if (!all) return [];
  const rows: PortfolioInstrumentYear[] = [];
  for (const [securityId, ledger] of all) {
    const entries = ledger.entries.filter((entry) => yearOf(entry.day) === year);
    if (entries.length === 0) continue;
    const withheldTax = sum(entries.map((entry) => entry.withheld));
    const row = {
      securityId,
      realizedProfitLoss: sum(entries.map((entry) => entry.realized)),
      netIncome: sum(entries.map((entry) => entry.income)),
      withheldTax,
      commissions: sum(entries.map((entry) => entry.fees)).minus(withheldTax),
    };
    if ([row.realizedProfitLoss, row.netIncome, row.withheldTax, row.commissions].some((value) => !value.isZero())) rows.push(row);
  }
  return rows.sort(bySecurity);
}

// MARK: Valuation

/** Values each position at its usable current price. A missing or non-positive price leaves it unvalued. */
export function valuePositions(
  positions: readonly PortfolioPosition[],
  latestPrices: Readonly<Partial<Record<string, Numeric>>>,
): PortfolioValuation[] {
  return positions.map((position) => {
    const raw = latestPrices[position.securityId];
    const currentPrice = raw === undefined ? null : exact(raw);
    if (!currentPrice || !currentPrice.isFinite() || !currentPrice.gt(0)) {
      return { position, currentPrice: null, currentValue: null, unrealizedProfitLoss: null, returnPercentage: null };
    }
    const currentValue = exact(position.quantity).times(currentPrice).times(position.priceScale);
    const unrealizedProfitLoss = currentValue.minus(position.investedAmount);
    const returnPercentage = position.investedAmount.gt(0)
      ? divide(unrealizedProfitLoss.times(HUNDRED), exact(position.investedAmount))
      : ZERO;
    return { position, currentPrice, currentValue, unrealizedProfitLoss, returnPercentage };
  });
}

const EMPTY_SUMMARY: PortfolioSummary = {
  investedAmount: ZERO,
  currentValue: ZERO,
  unrealizedProfitLoss: ZERO,
  returnPercentage: ZERO,
  missingPriceCount: 0,
};

/** Totals over priced positions; the return is against the cost of priced positions only. */
export function portfolioSummary(valuations: readonly PortfolioValuation[]): PortfolioSummary {
  if (valuations.length === 0) return EMPTY_SUMMARY;
  const priced = valuations.filter((valuation) => valuation.currentValue !== null);
  const pricedInvested = sum(priced.map((valuation) => valuation.position.investedAmount));
  const unrealizedProfitLoss = sum(priced.map((valuation) => valuation.unrealizedProfitLoss ?? ZERO));
  const returnPercentage = pricedInvested.gt(0) ? divide(unrealizedProfitLoss.times(HUNDRED), pricedInvested) : ZERO;
  if (!returnPercentage) return EMPTY_SUMMARY;
  return {
    investedAmount: sum(valuations.map((valuation) => valuation.position.investedAmount)),
    currentValue: sum(priced.map((valuation) => valuation.currentValue ?? ZERO)),
    unrealizedProfitLoss,
    returnPercentage,
    missingPriceCount: valuations.length - priced.length,
  };
}

/** Shares of current value, largest first. Empty unless every position is priced. */
export function portfolioAllocations(valuations: readonly PortfolioValuation[]): PortfolioAllocation[] {
  if (!valuations.every((valuation) => valuation.currentValue !== null)) return [];
  const available = valuations.flatMap((valuation) =>
    valuation.currentValue?.gt(0) ? [{ securityId: valuation.position.securityId, currentValue: valuation.currentValue }] : [],
  );
  const total = sum(available.map((item) => item.currentValue));
  if (!total.gt(0)) return [];
  return available
    .map((item) => ({ ...item, percentage: divide(item.currentValue.times(HUNDRED), total) ?? ZERO }))
    .sort((a, b) => b.percentage.comparedTo(a.percentage));
}

// MARK: Value series

/** One close per Luanda day, or null when the history is unusable. */
function dailyCloses(points: readonly HistoryPoint[]): Map<CivilDate, Decimal> | null {
  if (points.length === 0) return null;
  const closes = new Map<CivilDate, Decimal>();
  for (const point of points) {
    const day = typeof point.date === "string" ? (isCivilDate(point.date) ? point.date : null) : luandaDay(point.date);
    if (day === null) return null;
    const value = exact(point.value);
    if (!value.isFinite() || !value.gt(0) || closes.has(day)) return null;
    closes.set(day, value);
  }
  return closes;
}

/**
 * Portfolio value on each day with a close in range: held quantity × close × price scale.
 * A day is dropped when any open position lacks a close; a day with nothing open is worth 0.
 */
export function portfolioValueSeries(
  transactions: readonly PortfolioTransaction[],
  histories: Readonly<Record<string, readonly HistoryPoint[]>>,
  { asOf, priceScales, rangeDays }: ValueSeriesOptions,
): ValuePoint[] {
  const today = luandaDay(asOf);
  const { validity, rows } = inspect(transactions, asOf);
  if (today === null || validity !== "valid" || !rows.some((row) => row.kind === "buy")) return [];

  const closes = new Map<string, Map<CivilDate, Decimal>>();
  for (const [securityId, points] of Object.entries(histories)) {
    closes.set(securityId, dailyCloses(points) ?? new Map());
  }
  const days = [...new Set([...closes.values()].flatMap((byDay) => [...byDay.keys()]))]
    .filter((day) => day <= today && (rangeDays === null || civilDaysBetween(day, today) <= rangeDays))
    .sort();

  const series: ValuePoint[] = [];
  for (const day of days) {
    const active = rows.filter((row) => row.tradedOn <= day);
    if (active.length === 0) continue;
    const held = heldQuantities(active) ?? new Map<string, Decimal>();
    let total = ZERO;
    let complete = true;
    for (const [securityId, quantity] of held) {
      if (!quantity.gt(0)) continue;
      const close = closes.get(securityId)?.get(day);
      if (!close) {
        complete = false;
        break;
      }
      total = total.plus(quantity.times(close).times(scaleFor(priceScales, securityId)));
    }
    if (complete && total.isFinite() && total.gte(0)) series.push({ day, value: total });
  }
  return series;
}

/** Balance movement between the first and last points, including purchases and sales. */
export function portfolioPeriodChange(points: readonly ValuePoint[]): PortfolioPeriodChange | null {
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const start = exact(first.value);
  const end = exact(last.value);
  if (!(first.day < last.day) || !start.isFinite() || start.isNeg() || !end.isFinite() || end.isNeg()) return null;
  const amount = end.minus(start);
  return { amount, percentage: start.gt(0) ? divide(amount.times(HUNDRED), start) : null };
}
