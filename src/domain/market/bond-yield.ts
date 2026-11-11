import Decimal from "decimal.js";

import { type CivilDate, civilDaysBetween, parseCivilDate } from "../format/date";

/*
 * iOS `BondYield`: coupon schedule, accrued interest and yield to maturity from coupon terms the
 * holder confirms (BODIVA does not publish them). Maturity comes from the ticker via
 * `civilDate(bodivaMaturityDate(symbol))`; settlement is the Luanda civil day of `now`.
 */

/** Payments per year a prospectus may set. */
export const BOND_COUPON_FREQUENCIES = [1, 2, 4] as const;

/** iOS `BondTerms`. */
export interface BondTerms {
  /** Annual coupon, percent of nominal. */
  readonly couponRate: Decimal;
  /** Payments per year. */
  readonly frequency: number;
}

export interface BondYieldResult {
  /** Annual percent, compounded at the coupon frequency. */
  readonly yieldToMaturity: Decimal;
  /** Annual coupon over clean price, percent; absent for a zero coupon. */
  readonly currentYield?: Decimal;
  /** Per 100 of nominal. */
  readonly accruedInterest: Decimal;
  readonly dirtyPrice: Decimal;
  readonly nextCouponDate: CivilDate;
  readonly remainingCoupons: number;
}

const MAX_PERIODS = 480;
const BISECTION_STEPS = 200;
const ZERO = new Decimal(0);
const ONE = new Decimal(1);
const HUNDRED = new Decimal(100);

/** Per 100 of nominal, paid each period. */
export const couponPerPeriod = (terms: BondTerms) => terms.couponRate.div(terms.frequency);

export const isValidBondTerms = (terms: BondTerms) =>
  terms.couponRate.isFinite() &&
  terms.couponRate.gte(0) &&
  terms.couponRate.lt(100) &&
  (BOND_COUPON_FREQUENCIES as readonly number[]).includes(terms.frequency);

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

/** Calendar month arithmetic that clamps to the month's last day, like Foundation's `date(byAdding: .month)`. */
function addMonths(date: CivilDate, months: number): CivilDate {
  const { year, month, day } = parseCivilDate(date);
  const index = year * 12 + month - 1 + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = index - targetYear * 12 + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  return `${pad(targetYear, 4)}-${pad(targetMonth)}-${pad(Math.min(day, lastDay))}`;
}

const isCivil = (date: CivilDate) => {
  try {
    parseCivilDate(date);
    return true;
  } catch {
    return false;
  }
};

/** Coupon dates in `[from, through]`. They step back from maturity in whole months, so each period ends on the maturity day. */
export function couponDates(maturity: CivilDate, frequency: number, from: CivilDate, through: CivilDate): CivilDate[] {
  if (!(BOND_COUPON_FREQUENCIES as readonly number[]).includes(frequency) || ![maturity, from, through].every(isCivil)) return [];
  const months = 12 / frequency;
  const dates: CivilDate[] = [];
  for (let step = 0; step < MAX_PERIODS; step += 1) {
    const date = addMonths(maturity, -step * months);
    if (date < from) break;
    if (date <= through) dates.push(date);
  }
  return dates.reverse();
}

/** Yield to maturity by bisection on the dirty price; undefined when the inputs or the price admit no yield. */
export function calculateBondYield(input: {
  cleanPrice: Decimal;
  terms: BondTerms;
  maturity: CivilDate;
  settlement: CivilDate;
}): BondYieldResult | undefined {
  const { cleanPrice, terms, maturity, settlement } = input;
  if (!cleanPrice.isFinite() || !cleanPrice.gt(0) || !isValidBondTerms(terms)) return undefined;
  if (!isCivil(maturity) || !isCivil(settlement) || maturity <= settlement) return undefined;

  const months = 12 / terms.frequency;
  const upcoming: CivilDate[] = [];
  let previous: CivilDate | undefined;
  for (let step = 0; step < MAX_PERIODS; step += 1) {
    const date = addMonths(maturity, -step * months);
    if (date > settlement) upcoming.push(date);
    else {
      previous = date;
      break;
    }
  }
  const next = upcoming.at(-1);
  if (previous === undefined || next === undefined) return undefined;
  upcoming.reverse();

  const periodDays = civilDaysBetween(previous, next);
  if (periodDays <= 0) return undefined;
  const fraction = new Decimal(civilDaysBetween(settlement, next)).div(periodDays);
  const coupon = couponPerPeriod(terms);
  const accrued = coupon.times(ONE.minus(fraction));
  const dirty = cleanPrice.plus(accrued);
  const frequency = new Decimal(terms.frequency);
  const count = upcoming.length;

  // Σ cashFlow / base^(index + fraction): one fractional power, then a running division.
  const price = (annualYield: Decimal) => {
    const base = annualYield.div(frequency).plus(ONE);
    let discount = base.pow(fraction.neg());
    let total = ZERO;
    for (let index = 0; index < count; index += 1) {
      total = total.plus((index === count - 1 ? coupon.plus(HUNDRED) : coupon).times(discount));
      discount = discount.div(base);
    }
    return total;
  };

  let low = new Decimal("-0.99").times(frequency);
  let high = new Decimal(10);
  if (price(low).lt(dirty) || price(high).gt(dirty)) return undefined;
  for (let step = 0; step < BISECTION_STEPS; step += 1) {
    const middle = low.plus(high).div(2);
    if (price(middle).gt(dirty)) low = middle;
    else high = middle;
  }

  return {
    yieldToMaturity: low.plus(high).div(2).times(HUNDRED),
    currentYield: terms.couponRate.gt(0) ? terms.couponRate.div(cleanPrice).times(HUNDRED) : undefined,
    accruedInterest: accrued,
    dirtyPrice: dirty,
    nextCouponDate: next,
    remainingCoupons: count,
  };
}
