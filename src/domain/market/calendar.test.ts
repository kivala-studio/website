import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { type CalendarException, MarketCalendar, decodeMarketCalendar } from "./calendar";
import { MarketDecodingError } from "./decoding-error";
import { decodeCalendarResponse } from "./decode";
import { validateHistoricalSeries } from "./history-validation";
import { VALID_QUALITY } from "./quality";
import { DAY_MS, LUANDA, addDays, dayStart, parseInstant, startOfDay } from "./zone";

const instant = (value: string) => parseInstant(value) ?? Number.NaN;
const day = (value: string) => dayStart(value) ?? Number.NaN;
const now = instant("2026-09-25T15:00:00Z");

/** Reviewed fixture hours (09:00–15:30), Monday to Friday. */
function fixtureCalendar(at: number, exceptions: [string, CalendarException][] = []) {
  return new MarketCalendar({
    version: "reviewed-fixture",
    coverage: { start: addDays(startOfDay(at), -60), endExclusive: addDays(startOfDay(at), 60) },
    verifiedAt: at - DAY_MS,
    validUntil: at + 7 * DAY_MS,
    normalHours: { openingMinute: 9 * 60, closingMinute: 15 * 60 + 30 },
    exceptions: new Map(exceptions.map(([value, exception]) => [day(value), exception])),
    regularWeekdays: new Set([2, 3, 4, 5, 6]),
  });
}

const specialSunday: [string, CalendarException] = ["2026-09-27", { kind: "session", hours: { openingMinute: 600, closingMinute: 720 } }];

describe("MarketCalendar", () => {
  it("regular week and exact open/close boundaries", () => {
    const calendar = fixtureCalendar(now);
    const week = calendar.currentTradingWeek(now);
    expect(week?.period).toEqual({ start: day("2026-09-21"), endExclusive: day("2026-09-28") });
    expect(week?.sessions).toHaveLength(5);
    expect(calendar.state(instant("2026-09-25T08:00:00Z"))).toBe("open");
    expect(calendar.state(instant("2026-09-25T14:30:00Z"))).toBe("postClose");
    expect(calendar.state(instant("2026-09-25T07:59:59Z"))).toBe("preMarket");
    expect(calendar.isTradingDay(day("2026-09-26"), now)).toBe(false);
    expect(calendar.state(instant("2026-09-26T12:00:00Z"))).toBe("weekend");
  });

  it("a Friday holiday completes the week on Thursday", () => {
    const thursday = instant("2026-09-24T14:30:00Z");
    const calendar = fixtureCalendar(thursday, [["2026-09-25", { kind: "holiday" }]]);
    const week = calendar.previousCompletedTradingWeek(thursday);
    expect(week?.period.start).toBe(day("2026-09-21"));
    expect(week?.sessions).toHaveLength(4);
    expect(calendar.state(now)).toBe("holiday");
    expect(calendar.previousTradingDay(day("2026-09-28"), thursday)).toBe(day("2026-09-24"));
  });

  it("Monday holiday and exceptional closure skip sessions", () => {
    const calendar = fixtureCalendar(now, [
      ["2026-09-21", { kind: "holiday" }],
      ["2026-09-23", { kind: "closed" }],
    ]);
    expect(calendar.nextTradingDay(day("2026-09-18"), now)).toBe(day("2026-09-22"));
    expect(calendar.previousTradingDay(day("2026-09-24"), now)).toBe(day("2026-09-22"));
    expect(calendar.currentTradingWeek(now)?.sessions).toHaveLength(3);
    expect(calendar.day(day("2026-09-23"), now)).toEqual({ kind: "nonTrading", closure: "exceptional" });
  });

  it("an exceptional Sunday delays completion and uses its own hours", () => {
    const calendar = fixtureCalendar(now, [specialSunday]);
    expect(calendar.previousCompletedTradingWeek(now)?.period.start).toBe(day("2026-09-14"));
    expect(calendar.nextTradingDay(day("2026-09-25"), now)).toBe(day("2026-09-27"));
    const sunday = instant("2026-09-27T11:00:00Z");
    const fresh = fixtureCalendar(sunday, [specialSunday]);
    expect(fresh.state(sunday)).toBe("postClose");
    expect(fresh.previousCompletedTradingWeek(sunday)?.sessions).toHaveLength(6);
    expect(calendar.isTradingWeek({ start: day("2026-09-21"), endExclusive: day("2026-09-26") }, now)).toBe(false);
  });

  it("completed sessions exclude future closes", () => {
    const midday = instant("2026-09-23T11:00:00Z");
    const calendar = fixtureCalendar(midday);
    const week = calendar.currentTradingWeek(midday);
    expect(week).toBeDefined();
    expect(calendar.completedSessions(week!.period, midday)).toHaveLength(2);
    expect(calendar.tradingDays(week!.period, midday)).toHaveLength(5);
  });

  it("unknown expiry and coverage never become closed", () => {
    const calendar = fixtureCalendar(now).with({
      coverage: { start: day("2026-09-21"), endExclusive: day("2026-09-26") },
      exceptions: new Map(),
    });
    expect(calendar.isTradingDay(day("2026-09-27"), now)).toBeUndefined();
    expect(calendar.nextTradingDay(day("2026-09-25"), now)).toBeUndefined();
    expect(calendar.currentTradingWeek(now)).toBeUndefined();
    expect(calendar.state(calendar.validUntil)).toBe("unknown");
    expect(calendar.completedSessions({ start: day("2026-09-21"), endExclusive: day("2026-09-28") }, now)).toBeUndefined();
  });

  it("year and month boundaries", () => {
    const clock = instant("2027-01-04T12:00:00Z");
    const calendar = fixtureCalendar(clock, [["2027-01-01", { kind: "holiday" }]]);
    expect(calendar.previousTradingDay(day("2027-01-04"), clock)).toBe(day("2026-12-31"));
    expect(calendar.nextTradingDay(day("2026-12-31"), clock)).toBe(day("2027-01-04"));
    expect(calendar.previousCompletedTradingWeek(clock)?.period.start).toBe(day("2026-12-28"));
  });

  it("the process time zone and daylight saving do not change market identity", () => {
    const original = process.env.TZ;
    try {
      for (const zone of ["Pacific/Honolulu", "Asia/Tokyo", "America/New_York", "Europe/London"]) {
        process.env.TZ = zone;
        for (const value of ["2026-03-08T23:30:00Z", "2026-11-01T23:30:00Z"]) {
          const clock = instant(value);
          const calendar = fixtureCalendar(clock);
          expect(calendar.state(clock)).toBe("preMarket");
          expect(LUANDA.offsetMs / 1000).toBe(3600);
          expect(calendar.currentTradingWeek(clock)?.sessions).toHaveLength(5);
        }
      }
    } finally {
      process.env.TZ = original;
    }
  });

  it("the recurring schedule comes from the data, not from weekdays", () => {
    const calendar = fixtureCalendar(now).with({ regularWeekdays: new Set([1, 3, 4, 5, 6, 7]) });
    expect(calendar.isTradingDay(day("2026-09-21"), now)).toBe(false);
    expect(calendar.isTradingDay(day("2026-09-27"), now)).toBe(true);
    expect(calendar.currentTradingWeek(now)?.sessions).toHaveLength(6);
  });

  it("a fully closed week is known empty and skipped for the completed week", () => {
    const closed = [21, 22, 23, 24, 25].map((number): [string, CalendarException] => [`2026-09-${number}`, { kind: "closed" }]);
    const calendar = fixtureCalendar(now, closed);
    const week = calendar.currentTradingWeek(now);
    expect(week?.sessions).toEqual([]);
    expect(calendar.completedSessions(week!.period, now)).toEqual([]);
    expect(calendar.previousCompletedTradingWeek(now)?.period.start).toBe(day("2026-09-14"));
  });

  it("the decoder validates coverage, kinds and expiry", () => {
    const json = `{"contract_version":2,"timezone":"Africa/Luanda","version":"v1","source":"https://www.bodiva.ao/notice",
      "fetched_at":"2026-09-25T14:59:30Z","valid_until":"2026-09-25T15:01:30Z",
      "starts_on":"2026-09-25","ends_on":"2026-09-27","regular_weekdays":[2,3,4,5,6],"opens_at":"09:00:00","closes_at":"15:30:00",
      "days":[{"day":"2026-09-25","kind":"holiday"},{"day":"2026-09-26","kind":"non_trading"},
      {"day":"2026-09-27","kind":"exceptional_session","opens_at":"10:00:00","closes_at":"12:00:00"}]}`;
    const decode = (value: string, clock = now) => decodeMarketCalendar(decodeCalendarResponse(JSON.parse(value)), clock);
    expect(decode(json).state(now)).toBe("holiday");
    expect(decode(json).tradingDays({ start: day("2026-09-25"), endExclusive: day("2026-09-28") }, now)).toEqual([day("2026-09-27")]);
    for (const invalid of [
      json.replace("Africa/Luanda", "UTC"),
      json.replaceAll("2026-09-26", "2026-09-25"),
      json.replace("non_trading", "unknown"),
      json.replace("12:00:00", "09:00:00"),
    ]) {
      expect(() => decode(invalid)).toThrow(MarketDecodingError);
    }
    expect(() => decode(json, now + 90_000)).toThrow(MarketDecodingError);
    expect(decode(json.replace(`"contract_version":2`, `"contract_version":3`)).state(now)).toBe("holiday");
    expect(() => decode(json.replace(`"contract_version":2`, `"contract_version":1`))).toThrow(MarketDecodingError);
  });

  // The iOS case asserts the insight built on this evidence; here the verified series that gates it.
  it("verified history requires the exceptional Sunday and skips holiday closures", () => {
    const clock = instant("2026-09-27T15:00:00Z");
    const calendar = fixtureCalendar(clock, [
      ["2026-09-21", { kind: "holiday" }],
      ["2026-09-25", { kind: "holiday" }],
      specialSunday,
    ]);
    const period = { start: day("2026-09-18"), endExclusive: day("2026-09-28") };
    const sessions = calendar.sessions(period, clock) ?? [];
    const observations = sessions.map((session, index) => ({
      recordID: `close-${index}`,
      assetID: "A",
      currencyCode: "AOA",
      price: new Decimal(100 + index),
      observedAt: session.closesAt,
      collectedAt: clock,
      source: { dataset: "price_history.fixture", ingestionRunID: "run", contentHash: "a".repeat(64), parserVersion: "1" },
      isFinal: true,
      dataQuality: VALID_QUALITY,
    }));
    const evaluate = (rows: typeof observations) =>
      validateHistoricalSeries({ period, generatedAt: clock, fetchedAt: clock, calendar, observations: rows, watchlistIDs: ["A"] });
    const verified = evaluate(observations).verified.get("A");
    expect(verified).toHaveLength(5);
    expect(verified?.at(-1)?.observedAt).toBe(instant("2026-09-27T11:00:00Z"));
    expect(evaluate(observations.slice(0, -1)).verified.size).toBe(0);
  });
});
