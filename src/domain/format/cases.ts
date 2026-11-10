import type { Format } from "./index";

/**
 * Formatter table shared by the unit tests and the cross-engine check on /dev/design.
 * Rows come from ios-product §4.3 and iOS FinancialPresentationTests / CivilDatePresentationTests.
 * `pt` and `en` are the expected outputs for pt_AO and en_AO. Rows marked `ptMessages` reproduce
 * iOS tests that format an en locale with Portuguese copy.
 */
export type FormatCase = {
  name: string;
  run: (format: Format) => string;
  pt?: string;
  en?: string;
  ptMessages?: boolean;
};

const nov10 = Date.UTC(2026, 10, 10, 14, 30); // 15:30 in Luanda
const nov9Morning = Date.UTC(2026, 10, 9, 8, 5); // 09:05 in Luanda

export const FORMAT_CASES: readonly FormatCase[] = [
  // §4.3 separators and plain numbers
  { name: "grouping and decimals", run: (f) => f.number("1250000.5"), pt: "1\u00A0250\u00A0000,50", en: "1,250,000.50" },
  { name: "plain number", run: (f) => f.number("14862.34"), pt: "14\u00A0862,34", en: "14,862.34" },
  { name: "forced sign", run: (f) => f.number("12.4", { signed: true }), pt: "+12,40", en: "+12.40" },
  { name: "negative number", run: (f) => f.number("-12.4"), pt: "-12,40", en: "-12.40" },
  { name: "half-even rounding", run: (f) => f.number("0.125"), pt: "0,12", en: "0.12" },
  // Currency
  { name: "amount, no cents", run: (f) => f.currency("1250000"), pt: "1\u00A0250\u00A0000\u00A0Kz", en: "AOA\u00A01,250,000" },
  { name: "instrument price", run: (f) => f.securityPrice("65000"), pt: "65\u00A0000,00\u00A0Kz", en: "AOA\u00A065,000.00" },
  { name: "signed amount", run: (f) => f.currency("1250000", { signed: true }), pt: "+1\u00A0250\u00A0000\u00A0Kz", en: "+AOA\u00A01,250,000" },
  { name: "negative amount", run: (f) => f.currency("-65000", { digits: 2 }), pt: "-65\u00A0000,00\u00A0Kz", en: "-AOA\u00A065,000.00" },
  { name: "quote change", run: (f) => f.quoteChange("150", { signed: true }), pt: "+150,00\u00A0Kz", en: "+AOA\u00A0150.00" },
  // Percent
  { name: "change percent", run: (f) => f.percent("1.2"), pt: "+1,20%", en: "+1.20%" },
  { name: "negative percent", run: (f) => f.percent("-0.45"), pt: "-0,45%", en: "-0.45%" },
  { name: "tiny positive", run: (f) => f.boundedPercent("0.0001"), pt: "Entre 0% e +0,1%", en: "Between 0% and +0.1%" },
  { name: "tiny negative", run: (f) => f.boundedPercent("-0.05"), pt: "Entre −0,1% e 0%", en: "Between −0.1% and 0%" },
  { name: "tiny unsigned", run: (f) => f.boundedPercent("0.05", { signed: false }), pt: "<0,1%", en: "<0.1%" },
  { name: "near total", run: (f) => f.boundedPercent("99.99", { signed: false }), pt: ">99,9%", en: ">99.9%" },
  { name: "tiny at two digits", run: (f) => f.changePercent("0.004", { digits: 2 }), pt: "Entre 0% e +0,01%", en: "Between 0% and +0.01%" },
  // Percentage points and bonds
  { name: "points", run: (f) => f.points("0.25"), pt: "+0,25 p.p.", en: "+0.25 p.p." },
  { name: "tiny points", run: (f) => f.points("0.004"), pt: "Entre 0 e +0,01 p.p.", en: "Between 0 and +0.01 p.p." },
  { name: "tiny negative points", run: (f) => f.points("-0.0001"), pt: "Entre −0,01 e 0 p.p.", en: "Between −0.01 and 0 p.p." },
  { name: "bond price", run: (f) => f.securityPrice("98.5", { bond: true }), pt: "98,50%", en: "98.50%" },
  { name: "bond quote change", run: (f) => f.quoteChange("0.25", { bond: true, signed: true }), pt: "+0,25 p.p.", en: "+0.25 p.p." },
  // Quantity, axis, counts
  { name: "whole quantity", run: (f) => f.quantity("120"), pt: "120", en: "120" },
  { name: "fractional quantity", run: (f) => f.quantity("0.33333"), pt: "0,3333", en: "0.3333" },
  { name: "axis thousands", run: (f) => f.chartAxis(65000), pt: "65k", en: "65k" },
  { name: "axis millions", run: (f) => f.chartAxis(1250000), pt: "1,25M", en: "1.25M" },
  { name: "axis billions", run: (f) => f.chartAxis(2_000_000_000), pt: "2B", en: "2B" },
  { name: "axis units", run: (f) => f.chartAxis(950), pt: "950", en: "950" },
  { name: "count", run: (f) => f.count(12340), pt: "12\u00A0340", en: "12,340" },
  { name: "four-digit count", run: (f) => f.count(1234), pt: "1\u00A0234", en: "1,234" },
  { name: "stored price precision", run: (f) => f.price("104.321234"), pt: "104,321234", en: "104.321234" },
  // Dates and times, always Luanda
  { name: "date", run: (f) => f.date(nov10), pt: "10/11/2026", en: "Nov 10, 2026" },
  { name: "timestamp", run: (f) => f.timestamp(nov10), pt: "10/11/2026, 15:30 · Luanda", en: "Nov 10, 2026, 3:30 PM · Luanda" },
  { name: "period", run: (f) => f.civilPeriod("2026-11-02", "2026-11-06"), pt: "2/11/2026 – 6/11/2026", en: "Nov 2, 2026 – Nov 6, 2026" },
  { name: "relative today", run: (f) => f.relativeDay(nov10, nov10 + 3_600_000), pt: "Hoje · 15:30", en: "Today · 3:30 PM" },
  { name: "relative yesterday", run: (f) => f.relativeDay(nov9Morning, nov10), pt: "Ontem · 09:05", en: "Yesterday · 9:05 AM" },
  { name: "older than yesterday", run: (f) => f.relativeDay(nov9Morning, nov10 + 2 * 86_400_000), pt: "9/11/2026, 09:05 · Luanda", en: "Nov 9, 2026, 9:05 AM · Luanda" },
  { name: "maturity", run: (f) => f.maturity("2030-05-08"), pt: "8 de maio de 2030", en: "May 8, 2030" },
  { name: "transaction day", run: (f) => f.civilDate("2026-10-08"), pt: "8/10/2026", en: "Oct 8, 2026" },
  // iOS FinancialPresentationTests
  { name: "iOS: points keep their scale", run: (f) => f.changePercent("4.32123456789"), pt: "+4,3%" },
  { name: "iOS: two-digit percent", run: (f) => f.changePercent("4.32123456789", { digits: 2 }), en: "+4.32%" },
  { name: "iOS: no double round-trip", run: (f) => f.number("12345678901234567890.12"), en: "12,345,678,901,234,567,890.12" },
  { name: "iOS: currency code", run: (f) => f.currency("4321.23", { code: "USD", digits: 2 }), en: "$4,321.23" },
  { name: "iOS: currency precision", run: (f) => f.currency("4321.23", { code: "USD" }), en: "$4,321" },
  { name: "iOS: bounded tiny", run: (f) => f.boundedPercent("0.004"), en: "Entre 0% e +0.1%", ptMessages: true },
  { name: "iOS: tiny points", run: (f) => f.points("-0.004"), en: "Entre −0.01 e 0 p.p.", ptMessages: true },
  { name: "iOS: near total", run: (f) => f.boundedPercent("99.99", { signed: false }), en: ">99.9%" },
  { name: "iOS: default bounded copy", run: (f) => f.boundedPercent("0.0001"), pt: "Entre 0% e +0,1%" },
  { name: "iOS: default tiny points", run: (f) => f.points("-0.0001"), pt: "Entre −0,01 e 0 p.p." },
  { name: "iOS: market day survives locale", run: (f) => f.date(Date.parse("2026-09-23T23:30:00Z")), en: "Sep 24, 2026" },
  // iOS CivilDatePresentationTests
  { name: "iOS: maturity from instrument", run: (f) => f.maturity("2030-05-08"), pt: "8 de maio de 2030" },
  { name: "iOS: reloaded transaction day", run: (f) => f.civilDate("2026-10-08"), pt: "8/10/2026" },
];
