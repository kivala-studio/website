import Decimal from "decimal.js";

import {
  type CivilDate,
  type Instant,
  formatCivilAbbreviated,
  formatCivilLong,
  formatInstantDate,
  formatInstantDateTime,
  formatInstantTime,
  luandaCivilDate,
  civilDaysBetween,
} from "./date";
import { type FormatLocale, type Numeric, formatNumber, formatParts, toDecimal } from "./number";

export type { CivilDate, Instant } from "./date";
export type { FormatLocale, Numeric } from "./number";

/** Message lookup supplied by the caller (next-intl in the UI). Keys come from `messages/*.json`. */
export type Translate = (key: string, values?: Record<string, string>) => string;

/** Display symbols per ISO code. pt_AO puts the symbol after the amount, en_AO before it. */
const CURRENCY_SYMBOLS: Record<string, Record<FormatLocale, string>> = {
  AOA: { pt: "Kz", en: "AOA" },
  USD: { pt: "US$", en: "$" },
  EUR: { pt: "€", en: "€" },
};

/** Percentages are percentage points (4.32 means 4,32 %), never ratios. */
export function createFormat(locale: FormatLocale, translate: Translate) {
  const number = (value: Numeric, { digits = 2, signed = false }: { digits?: number; signed?: boolean } = {}) =>
    formatNumber(value, locale, { minFraction: digits, maxFraction: digits, signed });

  const currency = (
    value: Numeric,
    { code = "AOA", digits = 0, signed = false }: { code?: string; digits?: number; signed?: boolean } = {},
  ) => {
    const { sign, digits: amount } = formatParts(value, locale, { minFraction: digits, maxFraction: digits, signed });
    const symbol = CURRENCY_SYMBOLS[code]?.[locale] ?? code;
    if (locale === "pt") return `${sign}${amount} ${symbol}`;
    // ICU currency spacing: an alphabetic symbol is separated from the digits.
    return `${sign}${symbol}${/^[A-Za-z]/.test(symbol) ? " " : ""}${amount}`;
  };

  /** Plain percent; changes are signed by default. `+1,20%`. */
  const percent = (value: Numeric, { digits = 2, signed = true }: { digits?: number; signed?: boolean } = {}) =>
    `${number(value, { digits, signed })}%`;

  /** A non-zero movement is never rounded to zero. `+4,3%`, `Entre 0% e +0,1%`. */
  const changePercent = (value: Numeric, { digits = 1, signed = true }: { digits?: number; signed?: boolean } = {}) => {
    const decimal = toDecimal(value);
    const boundary = new Decimal(10).pow(-digits);
    const bound = number(boundary, { digits });
    if (decimal.gt(0) && decimal.lt(boundary)) return signed ? translate("legacy.entre0E", { arg1: bound }) : `<${bound}%`;
    if (decimal.lt(0) && decimal.gt(boundary.neg())) return translate("legacy.entreE0", { arg1: bound });
    return `${number(decimal, { digits, signed })}%`;
  };

  /** Like `changePercent` with one digit, and never claims 100 % for a near-total share. */
  const boundedPercent = (value: Numeric, { signed = true }: { signed?: boolean } = {}) => {
    const decimal = toDecimal(value);
    const boundary = new Decimal("0.1");
    if (!signed && decimal.lt(100) && decimal.gt(new Decimal(100).minus(boundary))) {
      return `>${number(new Decimal(100).minus(boundary), { digits: 1 })}%`;
    }
    return changePercent(decimal, { digits: 1, signed });
  };

  /** Percentage points for bond price changes and yield differences. `+0,25 p.p.`. */
  const points = (value: Numeric) => {
    const decimal = toDecimal(value);
    const boundary = new Decimal("0.01");
    const bound = number(boundary, { digits: 2 });
    if (decimal.gt(0) && decimal.lt(boundary)) return translate("formatting.change.betweenZeroAndPositive", { arg1: bound });
    if (decimal.lt(0) && decimal.gt(boundary.neg())) return translate("formatting.change.betweenNegativeAndZero", { arg1: bound });
    return `${number(decimal, { signed: true })} p.p.`;
  };

  /** Bond prices are a percentage of par with at least two decimals. `98,50%`. */
  const bondPrice = (value: Numeric, { digits = 2, signed = false }: { digits?: number; signed?: boolean } = {}) =>
    percent(value, { digits: Math.max(digits, 2), signed });

  /** Instrument price: currency with 2 decimals, or % of par for bonds. */
  const securityPrice = (
    value: Numeric,
    { bond = false, code = "AOA", digits, signed = false }: { bond?: boolean; code?: string; digits?: number; signed?: boolean } = {},
  ) => (bond ? bondPrice(value, { digits, signed }) : currency(value, { code, digits: digits ?? 2, signed }));

  /** Absolute quote change: currency for shares and funds, points for bonds. */
  const quoteChange = (
    value: Numeric,
    { bond = false, code = "AOA", signed = false }: { bond?: boolean; code?: string; signed?: boolean } = {},
  ) => (bond ? `${number(value, { signed })} p.p.` : currency(value, { code, digits: 2, signed }));

  const quantity = (value: Numeric) => formatNumber(value, locale, { minFraction: 0, maxFraction: 4 });

  const count = (value: Numeric) => formatNumber(value, locale, { minFraction: 0, maxFraction: 0 });

  /** Full stored precision, no padding. */
  const price = (value: Numeric) => formatNumber(value, locale, { minFraction: 0, maxFraction: 38 });

  /** Compact chart ticks: `65k`, `1,25M`, `2B`. */
  const chartAxis = (value: Numeric) => {
    const decimal = toDecimal(value);
    const magnitude = decimal.abs();
    const [scale, suffix] = magnitude.gte(1e9)
      ? [1e9, "B"]
      : magnitude.gte(1e6)
        ? [1e6, "M"]
        : magnitude.gte(1e3)
          ? [1e3, "k"]
          : [1, ""];
    return formatNumber(decimal.div(scale), locale, { minFraction: 0, maxFraction: 2 }) + suffix;
  };

  const date = (instant: Instant) => formatInstantDate(instant, locale);
  const time = (instant: Instant) => formatInstantTime(instant, locale);
  /** `10/11/2026, 15:30 · Luanda`. */
  const timestamp = (instant: Instant) => translate("formatting.time.luanda", { arg1: formatInstantDateTime(instant, locale) });
  const period = (first: Instant, last: Instant) => `${date(first)} – ${date(last)}`;
  /** Civil dates: transaction day (`8/10/2026`) and maturity (`8 de maio de 2030`). */
  const civilDate = (value: CivilDate) => formatCivilAbbreviated(value, locale);
  const maturity = (value: CivilDate) => formatCivilLong(value, locale);
  const civilPeriod = (first: CivilDate, last: CivilDate) => `${civilDate(first)} – ${civilDate(last)}`;

  /** `Hoje · 15:30`, `Ontem · 09:05`, otherwise the Luanda timestamp. */
  const relativeDay = (instant: Instant, now: Instant) => {
    const days = civilDaysBetween(luandaCivilDate(instant), luandaCivilDate(now));
    if (days === 0) return translate("notifications.date.today", { arg1: time(instant) });
    if (days === 1) return translate("notifications.date.yesterday", { arg1: time(instant) });
    return timestamp(instant);
  };

  return {
    locale,
    number,
    currency,
    percent,
    changePercent,
    boundedPercent,
    points,
    bondPrice,
    securityPrice,
    quoteChange,
    quantity,
    count,
    price,
    chartAxis,
    date,
    time,
    timestamp,
    period,
    civilDate,
    maturity,
    civilPeriod,
    relativeDay,
  };
}

export type Format = ReturnType<typeof createFormat>;
