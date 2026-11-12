import type { FormatLocale } from "./number";

/** Africa/Luanda is UTC+1 all year (no daylight saving). Every market date is read in this zone. */
const LUANDA_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A Luanda civil day as `YYYY-MM-DD`. */
export type CivilDate = string;
export type Instant = Date | number;

type Fields = { year: number; month: number; day: number; hour: number; minute: number };

const MONTHS_LONG: Record<FormatLocale, readonly string[]> = {
  pt: ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};
const MONTHS_SHORT_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad = (value: number) => String(value).padStart(2, "0");

function luandaFields(instant: Instant): Fields {
  const shifted = new Date((typeof instant === "number" ? instant : instant.getTime()) + LUANDA_OFFSET_MS);
  if (Number.isNaN(shifted.getTime())) throw new RangeError("Invalid instant");
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

const CIVIL = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseCivilDate(value: CivilDate): Pick<Fields, "year" | "month" | "day"> {
  const match = CIVIL.exec(value);
  if (!match) throw new RangeError(`Invalid civil date: ${value}`);
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new RangeError(`Invalid civil date: ${value}`);
  }
  return { year, month, day };
}

/** The Luanda civil day an instant falls on. */
export function luandaCivilDate(instant: Instant): CivilDate {
  const { year, month, day } = luandaFields(instant);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Last representable moment of today in Luanda: the latest a date-only picker may select. */
export function latestSelectableInstant(now: Instant): Date {
  const { year, month, day } = luandaFields(now);
  return new Date(Date.UTC(year, month - 1, day + 1) - LUANDA_OFFSET_MS - 1000);
}

/** Abbreviated date (CLDR skeleton yMMMd): `8/10/2026`, `Oct 8, 2026`. */
function abbreviated({ year, month, day }: Pick<Fields, "year" | "month" | "day">, locale: FormatLocale) {
  return locale === "pt" ? `${day}/${pad(month)}/${year}` : `${MONTHS_SHORT_EN[month - 1]} ${day}, ${year}`;
}

/** Day, full month, year: `8 de maio de 2030`, `May 8, 2030`. */
function long({ year, month, day }: Pick<Fields, "year" | "month" | "day">, locale: FormatLocale) {
  const name = MONTHS_LONG[locale][month - 1];
  return locale === "pt" ? `${day} de ${name} de ${year}` : `${name} ${day}, ${year}`;
}

function time({ hour, minute }: Fields, locale: FormatLocale) {
  if (locale === "pt") return `${pad(hour)}:${pad(minute)}`;
  return `${hour % 12 === 0 ? 12 : hour % 12}:${pad(minute)} ${hour < 12 ? "AM" : "PM"}`;
}

export const formatInstantDate = (instant: Instant, locale: FormatLocale) => abbreviated(luandaFields(instant), locale);
export const formatInstantTime = (instant: Instant, locale: FormatLocale) => time(luandaFields(instant), locale);
/** Date and time without the zone suffix: `10/11/2026, 15:30`. */
export function formatInstantDateTime(instant: Instant, locale: FormatLocale) {
  const fields = luandaFields(instant);
  return `${abbreviated(fields, locale)}, ${time(fields, locale)}`;
}
export const formatCivilAbbreviated = (date: CivilDate, locale: FormatLocale) => abbreviated(parseCivilDate(date), locale);
export const formatCivilLong = (date: CivilDate, locale: FormatLocale) => long(parseCivilDate(date), locale);
/** Day and full month, for a date of the current year: `8 de maio`, `May 8`. */
export function formatCivilDayMonth(date: CivilDate, locale: FormatLocale) {
  const { month, day } = parseCivilDate(date);
  const name = MONTHS_LONG[locale][month - 1];
  return locale === "pt" ? `${day} de ${name}` : `${name} ${day}`;
}

/** Whole Luanda days from `from` to `to` (both civil dates). */
export function civilDaysBetween(from: CivilDate, to: CivilDate): number {
  const a = parseCivilDate(from);
  const b = parseCivilDate(to);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / DAY_MS);
}
