import { type CivilDate, parseCivilDate } from "../format/date";

/** Milliseconds since the Unix epoch. Every market instant uses this unit. */
export type EpochMs = number;
/** Supplies the current instant. Logic never reads the system clock itself. */
export type Clock = () => EpochMs;

/** A fixed-offset civil zone. The market zone has no daylight saving, so day arithmetic is exact. */
export interface MarketZone {
  readonly id: string;
  readonly offsetMs: number;
}

export const LUANDA: MarketZone = { id: "Africa/Luanda", offsetMs: 60 * 60 * 1000 };

export const SECOND_MS = 1000;
export const MINUTE_MS = 60 * SECOND_MS;
export const DAY_MS = 24 * 60 * MINUTE_MS;

const shifted = (instant: EpochMs, zone: MarketZone) => new Date(instant + zone.offsetMs);

/** Local midnight of the civil day containing `instant`. */
export function startOfDay(instant: EpochMs, zone: MarketZone = LUANDA): EpochMs {
  return Math.floor((instant + zone.offsetMs) / DAY_MS) * DAY_MS - zone.offsetMs;
}

export const isSameDay = (a: EpochMs, b: EpochMs, zone: MarketZone = LUANDA) =>
  startOfDay(a, zone) === startOfDay(b, zone);

export const addDays = (instant: EpochMs, days: number) => instant + days * DAY_MS;

/** Foundation weekday numbering, as used by the calendar contract: 1 = Sunday … 7 = Saturday. */
export const weekday = (instant: EpochMs, zone: MarketZone = LUANDA) => shifted(instant, zone).getUTCDay() + 1;

/** Minutes since local midnight. */
export function minuteOfDay(instant: EpochMs, zone: MarketZone = LUANDA): number {
  const date = shifted(instant, zone);
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

export function civilDate(instant: EpochMs, zone: MarketZone = LUANDA): CivilDate {
  return shifted(instant, zone).toISOString().slice(0, 10);
}

function civilStart(year: number, month: number, day: number, zone: MarketZone, hour = 0): EpochMs | undefined {
  const value = Date.UTC(year, month - 1, day, hour);
  const check = new Date(value);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return undefined;
  return value - zone.offsetMs;
}

/** Strict `YYYY-MM-DD` → local midnight, or undefined for impossible days. */
export function dayStart(value: string, zone: MarketZone = LUANDA): EpochMs | undefined {
  try {
    const { year, month, day } = parseCivilDate(value);
    return civilStart(year, month, day, zone);
  } catch {
    return undefined;
  }
}

/** A row's trading day, anchored at local noon so a morning observation stays on the same day. */
export function tradingDateNoon(value: string | undefined, zone: MarketZone = LUANDA): EpochMs | undefined {
  const match = value === undefined ? null : /^(\d{1,4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (!match) return undefined;
  return civilStart(Number(match[1]), Number(match[2]), Number(match[3]), zone, 12);
}

const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:?\d{2})$/;

/** ISO-8601 internet date-time with an explicit offset, with or without fractional seconds. */
export function parseInstant(value: string | undefined): EpochMs | undefined {
  const match = value === undefined ? null : INSTANT.exec(value);
  if (!match) return undefined;
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  if (hour > 23 || minute > 59 || second > 59) return undefined;
  const start = civilStart(year, month, day, { id: "UTC", offsetMs: 0 });
  if (start === undefined) return undefined;
  const fraction = match[7] ? Math.floor(Number(`0.${match[7]}`) * 1000) : 0;
  let offset = 0;
  if (match[8] !== "Z") {
    const digits = match[8].replace(":", "");
    const hours = Number(digits.slice(1, 3));
    const minutes = Number(digits.slice(3, 5));
    if (hours > 23 || minutes > 59) return undefined;
    offset = (digits[0] === "-" ? -1 : 1) * (hours * 60 + minutes) * MINUTE_MS;
  }
  return start + ((hour * 60 + minute) * 60 + second) * SECOND_MS + fraction - offset;
}

export const isFiniteInstant = (value: EpochMs | undefined): value is EpochMs =>
  value !== undefined && Number.isFinite(value);
