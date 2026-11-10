import { MarketDecodingError } from "./decoding-error";
import {
  DAY_MS,
  type EpochMs,
  LUANDA,
  MINUTE_MS,
  type MarketZone,
  addDays,
  dayStart,
  parseInstant,
  startOfDay,
  weekday,
} from "./zone";

export type MarketState = "open" | "closed" | "preMarket" | "postClose" | "weekend" | "holiday" | "unknown";

/** Half-open interval `[start, endExclusive)`. */
export interface Period {
  readonly start: EpochMs;
  readonly endExclusive: EpochMs;
}

export const isValidPeriod = (period: Period) =>
  Number.isFinite(period.start) && Number.isFinite(period.endExclusive) && period.start < period.endExclusive;

export const periodContains = (period: Period, instant: EpochMs) => instant >= period.start && instant < period.endExclusive;

export interface Session {
  readonly opensAt: EpochMs;
  readonly closesAt: EpochMs;
}

/** Minutes after local midnight. */
export interface TradingHours {
  readonly openingMinute: number;
  readonly closingMinute: number;
}

const validHours = (hours: TradingHours) =>
  hours.openingMinute >= 0 && hours.openingMinute < hours.closingMinute && hours.closingMinute < 24 * 60;

export type CalendarException = { kind: "holiday" } | { kind: "closed" } | { kind: "session"; hours: TradingHours };

export type CalendarDay =
  | { kind: "trading"; session: Session; exceptional: boolean }
  | { kind: "nonTrading"; closure: "scheduled" | "holiday" | "exceptional" }
  | { kind: "unknown" };

export interface TradingWeek {
  readonly period: Period;
  readonly sessions: readonly Session[];
}

export interface MarketCalendarInit {
  readonly version: string;
  readonly coverage: Period;
  readonly verifiedAt: EpochMs;
  readonly validUntil: EpochMs;
  readonly normalHours: TradingHours;
  /** Keys are local midnights. */
  readonly exceptions?: ReadonlyMap<EpochMs, CalendarException>;
  /** Weekday numbers, 1 = Sunday … 7 = Saturday. The server supplies the recurring schedule. */
  readonly regularWeekdays: ReadonlySet<number>;
  readonly sourceURL?: string;
  readonly zone?: MarketZone;
}

/**
 * Built only from the server calendar contract. A weekday alone never establishes a trading day:
 * outside verified coverage, or after `validUntil`, every answer is unknown.
 */
export class MarketCalendar {
  readonly version: string;
  readonly coverage: Period;
  readonly verifiedAt: EpochMs;
  readonly validUntil: EpochMs;
  readonly normalHours: TradingHours;
  readonly exceptions: ReadonlyMap<EpochMs, CalendarException>;
  readonly regularWeekdays: ReadonlySet<number>;
  readonly sourceURL?: string;
  readonly zone: MarketZone;

  constructor(init: MarketCalendarInit) {
    this.version = init.version;
    this.coverage = init.coverage;
    this.verifiedAt = init.verifiedAt;
    this.validUntil = init.validUntil;
    this.normalHours = init.normalHours;
    this.exceptions = init.exceptions ?? new Map();
    this.regularWeekdays = init.regularWeekdays;
    this.sourceURL = init.sourceURL;
    this.zone = init.zone ?? LUANDA;
  }

  with(changes: Partial<MarketCalendarInit>): MarketCalendar {
    return new MarketCalendar({ ...this, ...changes });
  }

  /** Civil week identity is Monday to Monday; membership comes only from sessions. */
  static week(containing: EpochMs, zone: MarketZone = LUANDA): Period | undefined {
    if (!Number.isFinite(containing)) return undefined;
    const today = startOfDay(containing, zone);
    const start = addDays(today, -((weekday(today, zone) + 5) % 7));
    return { start, endExclusive: addDays(start, 7) };
  }

  day(on: EpochMs, asOf: EpochMs): CalendarDay {
    if (!Number.isFinite(on) || !this.isUsable(asOf) || !periodContains(this.coverage, on)) return { kind: "unknown" };
    const day = startOfDay(on, this.zone);
    const exception = this.exceptions.get(day);
    if (exception?.kind === "holiday") return { kind: "nonTrading", closure: "holiday" };
    if (exception?.kind === "closed") return { kind: "nonTrading", closure: "exceptional" };
    const session = this.session(day);
    if (session) return { kind: "trading", session, exceptional: exception !== undefined };
    return { kind: "nonTrading", closure: "scheduled" };
  }

  /** `undefined` is unknown, `false` a verified non-trading day. */
  isTradingDay(on: EpochMs, asOf: EpochMs): boolean | undefined {
    const day = this.day(on, asOf);
    return day.kind === "unknown" ? undefined : day.kind === "trading";
  }

  state(at: EpochMs): MarketState {
    const day = this.day(at, at);
    if (day.kind === "unknown") return "unknown";
    if (day.kind === "nonTrading") {
      if (day.closure === "holiday") return "holiday";
      if (day.closure === "exceptional") return "closed";
      const number = weekday(at, this.zone);
      return number === 1 || number === 7 ? "weekend" : "closed";
    }
    if (at < day.session.opensAt) return "preMarket";
    return at < day.session.closesAt ? "open" : "postClose";
  }

  /** The earliest session boundary, calendar expiry or coverage end after `now`. */
  nextTransition(after: EpochMs): EpochMs | undefined {
    if (!this.isUsable(after)) return undefined;
    let deadline = this.validUntil;
    for (let day = startOfDay(after, this.zone); day < this.coverage.endExclusive && day < deadline; day += DAY_MS) {
      const entry = this.day(day, after);
      if (entry.kind !== "trading") continue;
      for (const boundary of [entry.session.opensAt, entry.session.closesAt]) {
        if (boundary > after) deadline = Math.min(deadline, boundary);
      }
    }
    return Math.min(deadline, this.coverage.endExclusive);
  }

  /** `undefined` means unknown or invalid coverage; `[]` a verified interval without sessions. */
  sessions(period: Period, asOf: EpochMs): Session[] | undefined {
    if (
      !this.isUsable(asOf) ||
      !isValidPeriod(period) ||
      period.start < this.coverage.start ||
      period.endExclusive > this.coverage.endExclusive ||
      startOfDay(period.start, this.zone) !== period.start ||
      startOfDay(period.endExclusive, this.zone) !== period.endExclusive ||
      period.endExclusive - period.start > 400 * DAY_MS
    ) {
      return undefined;
    }
    const result: Session[] = [];
    for (let day = period.start; day < period.endExclusive; day += DAY_MS) {
      const session = this.session(day);
      if (session) result.push(session);
    }
    return result;
  }

  completedSessions(period: Period, asOf: EpochMs): Session[] | undefined {
    return this.sessions(period, asOf)?.filter((session) => session.closesAt <= asOf);
  }

  tradingDays(period: Period, asOf: EpochMs): EpochMs[] | undefined {
    return this.sessions(period, asOf)?.map((session) => startOfDay(session.opensAt, this.zone));
  }

  /** Strictly before the given day. Unknown coverage stops the search. */
  previousTradingDay(before: EpochMs, asOf: EpochMs): EpochMs | undefined {
    return this.adjacentTradingDay(before, -1, asOf);
  }

  nextTradingDay(after: EpochMs, asOf: EpochMs): EpochMs | undefined {
    return this.adjacentTradingDay(after, 1, asOf);
  }

  currentTradingWeek(asOf: EpochMs): TradingWeek | undefined {
    const period = MarketCalendar.week(asOf, this.zone);
    const sessions = period && this.sessions(period, asOf);
    return period && sessions ? { period, sessions } : undefined;
  }

  /** Includes this week once its last session has closed. Weeks without sessions are skipped. */
  previousCompletedTradingWeek(asOf: EpochMs): TradingWeek | undefined {
    let period = MarketCalendar.week(asOf, this.zone);
    for (let step = 0; period && step < 53; step += 1) {
      const sessions = this.sessions(period, asOf);
      if (!sessions) return undefined;
      const last = sessions.at(-1);
      if (last && last.closesAt <= asOf) return { period, sessions };
      period = { start: addDays(period.start, -7), endExclusive: period.start };
    }
    return undefined;
  }

  /** Legacy five-day intervals remain readable, but cannot omit a known weekend session. */
  isTradingWeek(period: Period, asOf: EpochMs): boolean {
    const week = MarketCalendar.week(period.start, this.zone);
    if (!week || period.start !== week.start) return false;
    if (period.endExclusive === week.endExclusive) return this.sessions(period, asOf) !== undefined;
    const legacyEnd = addDays(period.start, 5);
    if (period.endExclusive !== legacyEnd || this.sessions(period, asOf) === undefined) return false;
    return this.sessions({ start: legacyEnd, endExclusive: week.endExclusive }, asOf)?.length === 0;
  }

  private isUsable(asOf: EpochMs): boolean {
    const { coverage, zone } = this;
    if (!isValidPeriod(coverage) || this.version === "" || !validHours(this.normalHours)) return false;
    if (this.regularWeekdays.size === 0 || [...this.regularWeekdays].some((day) => day < 1 || day > 7)) return false;
    if (startOfDay(coverage.start, zone) !== coverage.start || startOfDay(coverage.endExclusive, zone) !== coverage.endExclusive) {
      return false;
    }
    if (![asOf, this.verifiedAt, this.validUntil].every(Number.isFinite)) return false;
    if (!(this.verifiedAt <= asOf && asOf < this.validUntil)) return false;
    for (const [day, exception] of this.exceptions) {
      if (!Number.isFinite(day) || startOfDay(day, zone) !== day || !periodContains(coverage, day)) return false;
      if (exception.kind === "session" && !validHours(exception.hours)) return false;
    }
    return true;
  }

  private session(day: EpochMs): Session | undefined {
    const exception = this.exceptions.get(day);
    let hours: TradingHours;
    if (exception?.kind === "holiday" || exception?.kind === "closed") return undefined;
    if (exception?.kind === "session") hours = exception.hours;
    else if (this.regularWeekdays.has(weekday(day, this.zone))) hours = this.normalHours;
    else return undefined;
    return { opensAt: day + hours.openingMinute * MINUTE_MS, closesAt: day + hours.closingMinute * MINUTE_MS };
  }

  private adjacentTradingDay(from: EpochMs, direction: 1 | -1, asOf: EpochMs): EpochMs | undefined {
    if (!Number.isFinite(from)) return undefined;
    let cursor = startOfDay(from, this.zone);
    for (let step = 0; step < 366; step += 1) {
      cursor = addDays(cursor, direction);
      const day = this.day(cursor, asOf);
      if (day.kind === "unknown") return undefined;
      if (day.kind === "trading") return cursor;
    }
    return undefined;
  }
}

/** `get_market_calendar` response (contract v2), as decoded from JSON. */
export interface MarketCalendarResponse {
  readonly contractVersion: number;
  readonly timezone: string;
  readonly version: string;
  readonly source: string;
  readonly fetchedAt: string;
  readonly validUntil: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly regularWeekdays: readonly number[];
  readonly opensAt: string;
  readonly closesAt: string;
  readonly days: readonly { day: string; kind: string; opensAt?: string; closesAt?: string }[];
}

function fail(operation: string): never {
  throw new MarketDecodingError(operation);
}

function minuteOf(value: string | undefined): number | undefined {
  const match = value === undefined ? null : /^(\d+):(\d+):(\d+(?:\.\d+)?)$/.exec(value);
  if (!match) return undefined;
  const [hour, minute, second] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (hour > 23 || minute > 59 || second !== 0) return undefined;
  return hour * 60 + minute;
}

function httpsSource(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname !== "" && url.username === "" && url.password === "" ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Validates the whole document or rejects it, which leaves the market state unknown.
 * `bundledUntil` extends a calendar bundled in the shared snapshot to that snapshot's `fresh_until`.
 */
export function decodeMarketCalendar(row: MarketCalendarResponse, now: EpochMs, bundledUntil?: EpochMs): MarketCalendar {
  const zone = LUANDA;
  const lifetime = (bundledUntil === undefined ? 121 : 310) * 1000;
  const start = dayStart(row.startsOn, zone);
  const last = dayStart(row.endsOn, zone);
  const fetched = parseInstant(row.fetchedAt);
  const expiry = bundledUntil ?? parseInstant(row.validUntil);
  const open = minuteOf(row.opensAt);
  const close = minuteOf(row.closesAt);
  const source = httpsSource(row.source);
  const weekdays = new Set(row.regularWeekdays);
  if (
    // Later versions only add fields.
    row.contractVersion < 2 ||
    row.timezone !== zone.id ||
    row.version === "" ||
    source === undefined ||
    start === undefined ||
    last === undefined ||
    start >= addDays(last, 1) ||
    fetched === undefined ||
    expiry === undefined ||
    !(fetched <= now && now < expiry && expiry <= fetched + lifetime) ||
    open === undefined ||
    close === undefined ||
    open >= close ||
    weekdays.size === 0 ||
    weekdays.size !== row.regularWeekdays.length ||
    row.regularWeekdays.some((day) => !Number.isInteger(day) || day < 1 || day > 7) ||
    row.days.length > 400 ||
    row.days.length !== Math.round((addDays(last, 1) - start) / DAY_MS)
  ) {
    return fail("market.calendar");
  }
  const exceptions = new Map<EpochMs, CalendarException>();
  let cursor = start;
  for (const item of row.days) {
    if (dayStart(item.day, zone) !== cursor) fail("market.calendarCoverage");
    const regular = weekdays.has(weekday(cursor, zone));
    switch (item.kind) {
      case "regular":
        if (!regular || minuteOf(item.opensAt) !== open || minuteOf(item.closesAt) !== close) fail("market.calendarRegular");
        break;
      case "exceptional_session": {
        const opening = minuteOf(item.opensAt);
        const closing = minuteOf(item.closesAt);
        if (opening === undefined || closing === undefined || opening >= closing) fail("market.calendarHours");
        exceptions.set(cursor, { kind: "session", hours: { openingMinute: opening, closingMinute: closing } });
        break;
      }
      case "holiday":
      case "exceptional_closure":
      case "non_trading":
        if (item.opensAt !== undefined || item.closesAt !== undefined) fail("market.calendarClosure");
        if (item.kind === "holiday") exceptions.set(cursor, { kind: "holiday" });
        else if (item.kind === "exceptional_closure") exceptions.set(cursor, { kind: "closed" });
        else if (regular) fail("market.calendarSchedule");
        break;
      default:
        fail("market.calendarUnknown");
    }
    cursor = addDays(cursor, 1);
  }
  return new MarketCalendar({
    version: row.version,
    coverage: { start, endExclusive: addDays(last, 1) },
    verifiedAt: fetched,
    validUntil: expiry,
    normalHours: { openingMinute: open, closingMinute: close },
    exceptions,
    regularWeekdays: weekdays,
    sourceURL: source,
    zone,
  });
}
