import Decimal from "decimal.js";

import { type CivilDate, civilDaysBetween, parseCivilDate } from "../format/date";
import { type BondTerms, couponDates, couponPerPeriod, isValidBondTerms } from "../market/bond-yield";
import { bodivaMaturityDate, isBondKind } from "../market/classification";
import type { MarketSecurity } from "../market/models";
import { civilDate } from "../market/zone";
import type { PortfolioTransaction } from "./models";

/*
 * iOS `IncomeCalendar`: payments the ledger entitles the holder to, gross AOA. Dividends announced by the
 * issuer of each held equity; bond redemptions decoded from the BODIVA symbol; coupons only for bonds whose
 * terms the holder saved on this device. Everything runs on Luanda civil days.
 */

/** Days back and ahead of today the calendar covers. */
export const INCOME_WINDOW_DAYS = 365;
/** An income record this close to a past payment counts as having recorded it. */
const RECORDED_WITHIN_DAYS = 42;

export type IssuerDividend = {
  issuerId: string;
  /** Gross, per share. */
  amountPerShare: Decimal;
  exDividendDate: CivilDate | null;
  recordDate: CivilDate | null;
  paymentDate: CivilDate;
};

export type IncomeEventKind = "dividend" | "coupon" | "maturity";
export type IncomeStatus = "upcoming" | "recorded" | "unrecorded";

export type IncomeEvent = {
  id: string;
  securityId: string;
  kind: IncomeEventKind;
  date: CivilDate;
  /** Gross AOA. */
  amount: Decimal;
  quantity: Decimal;
  status: IncomeStatus;
};

export type IncomeTotals = { next12Months: Decimal; last12Months: Decimal };

type Security = Pick<MarketSecurity, "id" | "symbol" | "kind" | "issuerID">;

const CIVIL = /^\d{4}-\d{2}-\d{2}$/;

/** An `issuer_dividends` row with an amount and a payment day; null otherwise. */
export function decodeIssuerDividend(value: unknown): IssuerDividend | null {
  const row = (value ?? {}) as Record<string, unknown>;
  const day = (field: unknown) => (typeof field === "string" && CIVIL.test(field.slice(0, 10)) ? field.slice(0, 10) : null);
  const amount = typeof row.amount_per_share === "number" || (typeof row.amount_per_share === "string" && /^\d+(\.\d+)?$/.test(row.amount_per_share)) ? new Decimal(row.amount_per_share) : null;
  const paymentDate = day(row.payment_date);
  if (typeof row.issuer_id !== "string" || !amount?.isFinite() || !paymentDate) return null;
  return { issuerId: row.issuer_id.toLowerCase(), amountPerShare: amount, exDividendDate: day(row.ex_dividend_date), recordDate: day(row.record_date), paymentDate };
}

export function addCivilDays(date: CivilDate, days: number): CivilDate {
  const { year, month, day } = parseCivilDate(date);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Units (or nominal) held from trades on days before `cutoff`. */
export function quantityHeld(ledger: readonly PortfolioTransaction[], cutoff: CivilDate): Decimal {
  const quantity = ledger
    .filter((transaction) => transaction.tradedOn < cutoff)
    .reduce((total, transaction) => (transaction.kind === "buy" ? total.plus(transaction.quantity) : transaction.kind === "sell" ? total.minus(transaction.quantity) : total), new Decimal(0));
  return Decimal.max(0, quantity);
}

/** Shares bought before the ex-date; by the record date when there is none; else before the payment. */
export function entitledQuantity(ledger: readonly PortfolioTransaction[], dividend: IssuerDividend): Decimal {
  if (dividend.exDividendDate) return quantityHeld(ledger, dividend.exDividendDate);
  if (dividend.recordDate) return quantityHeld(ledger, addCivilDays(dividend.recordDate, 1));
  return quantityHeld(ledger, dividend.paymentDate);
}

function status(payment: CivilDate, ledger: readonly PortfolioTransaction[], today: CivilDate): IncomeStatus {
  if (payment >= today) return "upcoming";
  const recorded = ledger.some((transaction) => transaction.kind === "income" && Math.abs(civilDaysBetween(payment, transaction.tradedOn)) <= RECORDED_WITHIN_DAYS);
  return recorded ? "recorded" : "unrecorded";
}

const event = (securityId: string, kind: IncomeEventKind, date: CivilDate, amount: Decimal, quantity: Decimal, state: IncomeStatus): IncomeEvent => ({
  id: `${securityId}|${kind}|${date}`,
  securityId,
  kind,
  date,
  amount,
  quantity,
  status: state,
});

export type IncomeCalendarInput = {
  transactions: readonly PortfolioTransaction[];
  securities: readonly Security[];
  dividends: readonly IssuerDividend[];
  /** Coupon terms saved on this device, by security id. */
  bondTerms?: Readonly<Record<string, BondTerms>>;
  today: CivilDate;
};

/** Events in date order (then id). */
export function incomeEvents({ transactions, securities, dividends, bondTerms = {}, today }: IncomeCalendarInput): IncomeEvent[] {
  const earliest = addCivilDays(today, -INCOME_WINDOW_DAYS);
  const horizon = addCivilDays(today, INCOME_WINDOW_DAYS);
  const byId = new Map(securities.map((security) => [security.id, security]));
  const events: IncomeEvent[] = [];

  for (const securityId of [...new Set(transactions.map((transaction) => transaction.securityId))].sort()) {
    const security = byId.get(securityId);
    if (!security) continue;
    const ledger = transactions.filter((transaction) => transaction.securityId === securityId);
    if (security.kind === "equity" && security.issuerID) {
      const issuer = security.issuerID.toLowerCase();
      for (const dividend of dividends) {
        if (dividend.issuerId !== issuer || dividend.paymentDate < earliest) continue;
        const quantity = entitledQuantity(ledger, dividend);
        if (!quantity.gt(0) || !dividend.amountPerShare.gt(0)) continue;
        events.push(event(securityId, "dividend", dividend.paymentDate, quantity.times(dividend.amountPerShare), quantity, status(dividend.paymentDate, ledger, today)));
      }
      continue;
    }
    const maturityInstant = isBondKind(security.kind) ? bodivaMaturityDate(security.symbol) : undefined;
    if (maturityInstant === undefined) continue;
    const maturity = civilDate(maturityInstant);
    const terms = bondTerms[securityId];
    if (terms && isValidBondTerms(terms) && terms.couponRate.gt(0)) {
      for (const date of couponDates(maturity, terms.frequency, earliest, horizon)) {
        const nominal = quantityHeld(ledger, date);
        if (!nominal.gt(0)) continue;
        events.push(event(securityId, "coupon", date, nominal.times(couponPerPeriod(terms)).div(100), nominal, status(date, ledger, today)));
      }
    }
    const nominal = quantityHeld(ledger, "9999-12-31");
    if (maturity >= today && nominal.gt(0)) events.push(event(securityId, "maturity", maturity, nominal, nominal, "upcoming"));
  }
  return events.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Upcoming within the next 12 months; every past payment of the last 12 months, recorded or not. */
export function incomeTotals(events: readonly IncomeEvent[], today: CivilDate): IncomeTotals {
  const horizon = addCivilDays(today, INCOME_WINDOW_DAYS);
  const sum = (items: readonly IncomeEvent[]) => items.reduce((total, item) => total.plus(item.amount), new Decimal(0));
  return {
    next12Months: sum(events.filter((item) => item.status === "upcoming" && item.date <= horizon)),
    last12Months: sum(events.filter((item) => item.status !== "upcoming")),
  };
}
