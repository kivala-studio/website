import Decimal from "decimal.js";

/** `pt` → pt_AO, `en` → en_AO. The region is always Angola. */
export type FormatLocale = "pt" | "en";

export type Numeric = Decimal.Value;

type Symbols = { decimal: string; group: string };

/** CLDR 48 symbols. pt_AO groups from four digits with a no-break space; en_AO follows `en`. */
const SYMBOLS: Record<FormatLocale, Symbols> = {
  pt: { decimal: ",", group: " " },
  en: { decimal: ".", group: "," },
};

export type NumberOptions = {
  minFraction: number;
  maxFraction: number;
  /** Show `+` for zero and positive values, like ICU's `sign(strategy: .always())`. */
  signed?: boolean;
  grouping?: boolean;
};

export const toDecimal = (value: Numeric) => (value instanceof Decimal ? value : new Decimal(value));

type Parts = { sign: "" | "-" | "+"; digits: string };

/** Rounds half-even, the iOS FormatStyle default, without passing through a binary float. */
export function formatParts(value: Numeric, locale: FormatLocale, options: NumberOptions): Parts {
  const { minFraction, maxFraction, signed = false, grouping = true } = options;
  const decimal = toDecimal(value);
  if (!decimal.isFinite()) throw new RangeError("Cannot format a non-finite value");
  const symbols = SYMBOLS[locale];

  const fixed = decimal.abs().toDecimalPlaces(maxFraction, Decimal.ROUND_HALF_EVEN).toFixed(maxFraction);
  const [integer, rawFraction = ""] = fixed.split(".");
  let fraction = rawFraction;
  while (fraction.length > minFraction && fraction.endsWith("0")) fraction = fraction.slice(0, -1);

  const grouped = grouping ? groupDigits(integer, symbols.group) : integer;
  const digits = fraction ? `${grouped}${symbols.decimal}${fraction}` : grouped;
  const sign = decimal.isNegative() ? "-" : signed ? "+" : "";
  return { sign, digits };
}

export function groupDigits(integer: string, separator: string): string {
  let out = "";
  for (let index = 0; index < integer.length; index += 1) {
    if (index > 0 && (integer.length - index) % 3 === 0) out += separator;
    out += integer[index];
  }
  return out;
}

export function formatNumber(value: Numeric, locale: FormatLocale, options: NumberOptions): string {
  const { sign, digits } = formatParts(value, locale, options);
  return sign + digits;
}

export const symbolsFor = (locale: FormatLocale) => SYMBOLS[locale];
