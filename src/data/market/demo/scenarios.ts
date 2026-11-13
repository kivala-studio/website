import { MarketCalendar } from "@/domain/market/calendar";
import { type EpochMs, DAY_MS, SECOND_MS, addDays, civilDate, dayStart, weekday } from "@/domain/market/zone";

import recorded from "../../../../tests/fixtures/market/market-snapshot.production.json";

/*
 * Demo mode serves one production snapshot (recorded 2026-11-10, see the `.headers.json` beside
 * it) re-dated to the request time, so every scenario is valid "now" without a backend:
 *   open     session open all day, every recorded price current for 90 s
 *   closed   exceptional closure today, today's verified closes for the priced instruments
 *   stale    session open, every quote past its deadline and marked stale
 *   empty    no instruments, prices, sessions or closes
 *   partial  session open, half of the prices missing
 *   offline  as `open` on the server; the browser treats the connection as lost after loading
 *   listing  as `open`, plus an announced new admission (`market_events`) highlighted on Home
 *   unverified  as `open`, but no verified calendar for the coming week (the week ahead stays withheld)
 *   updates  as `open`, plus market information (`MarketUpdate`, which no live source sends yet)
 */
export const DEMO_SCENARIOS = ["open", "closed", "stale", "empty", "partial", "offline", "listing", "unverified", "updates"] as const;
export type DemoScenario = (typeof DEMO_SCENARIOS)[number];
export const DEFAULT_DEMO_SCENARIO: DemoScenario = "open";
export const DEMO_SCENARIO_COOKIE = "demo-scenario";

export const isDemoScenario = (value: unknown): value is DemoScenario =>
  typeof value === "string" && (DEMO_SCENARIOS as readonly string[]).includes(value);

type Row = Record<string, unknown>;

/** The recorded production body, unchanged (dated evidence only for public pages in demo mode). */
export const recordedSnapshot = recorded;

const iso = (instant: EpochMs) => new Date(instant).toISOString();
const epoch = (instant: EpochMs) => instant / SECOND_MS;

function calendar(now: EpochMs, today: string, session: boolean, freshUntil: EpochMs): Row {
  const week = MarketCalendar.week(now)!;
  const start = addDays(week.start, -28);
  const end = addDays(week.endExclusive, 14);
  const days: Row[] = [];
  for (let day = start; day < end; day = addDays(day, 1)) {
    const date = civilDate(day);
    const regular = weekday(day) >= 2 && weekday(day) <= 6;
    if (date === today) {
      days.push(
        session
          ? { day: date, kind: "exceptional_session", opens_at: "00:00:00", closes_at: "23:59:00" }
          : { day: date, kind: "exceptional_closure" },
      );
    } else {
      days.push(regular ? { day: date, kind: "regular", opens_at: "09:25:00", closes_at: "15:00:00" } : { day: date, kind: "non_trading" });
    }
  }
  return {
    ...recorded.calendar,
    days,
    starts_on: civilDate(start),
    ends_on: civilDate(end - DAY_MS),
    fetched_at: iso(now - SECOND_MS),
    valid_until: iso(freshUntil),
  };
}

/** Whole weeks, so recorded weekdays stay weekdays. */
function shiftedDate(date: string, weeks: number): string {
  return civilDate(addDays(dayStart(date)!, weeks * 7));
}

/** The re-dated bundle for `scenario` at `now`, as the Edge Function would send it. */
export function demoSnapshot(scenario: DemoScenario, now: EpochMs): Row {
  const today = civilDate(now);
  const session = scenario !== "closed" && scenario !== "empty";
  const freshUntil = now + (session ? 90 : 300) * SECOND_MS;
  const observed = now - 20 * SECOND_MS;
  const stale = scenario === "stale";
  const quality = stale
    ? { status: "stale", reasons: ["staleObservation"], validUntilEpoch: epoch(now - 60 * SECOND_MS), sourceObservedAtEpoch: epoch(now - 180 * SECOND_MS) }
    : { status: "valid", reasons: [], validUntilEpoch: epoch(now + 90 * SECOND_MS), sourceObservedAtEpoch: epoch(observed) };
  const weeks = Math.floor((dayStart(today)! - dayStart(recorded.quotes.sessions[0].trading_date)!) / (7 * DAY_MS));

  let prices: Row[] = recorded.quotes.prices.map((row) => ({ ...row, trading_date: today, data_quality: quality }));
  if (scenario === "partial") prices = prices.filter((_, index) => index % 2 === 0);
  const closes: Row[] =
    scenario === "closed"
      ? recorded.quotes.prices
          .filter((row) => row.last_price !== null)
          .map((row) => ({
            security_id: row.security_id,
            price: row.last_price,
            trading_date: today,
            confirmed_at: iso(now - 60 * SECOND_MS),
            verified_change_percent: row.verified_change_percent,
          }))
      : recorded.closes;
  const status = session ? "open" : "closed";
  const stamps = { collected_at: iso(observed), published_at: iso(observed) };
  const { availability: _availability, ...quotes } = recorded.quotes;
  void _availability;

  const bundle: Row = {
    ...recorded,
    generated_at: iso(now - SECOND_MS),
    fresh_until: iso(freshUntil),
    quotes: {
      ...quotes,
      prices,
      sessions: recorded.quotes.sessions.map((row) => ({
        ...row,
        ...stamps,
        status,
        trading_date: today,
        source_trading_date: today,
        updated_at: iso(observed),
        data_quality: quality,
      })),
      overview: recorded.quotes.overview.map((row) => ({
        ...row,
        ...stamps,
        status,
        data_status: stale ? "stale" : "live",
        trading_date: today,
        source_trading_date: today,
        last_updated_at: iso(observed),
        last_successful_ingestion_at: iso(observed),
      })),
    },
    closes,
    pulse: recorded.pulse.map((row) => ({ ...row, trading_date: shiftedDate(row.trading_date, weeks) })),
    calendar: calendar(now, today, session, freshUntil),
  };
  if (scenario !== "empty") return bundle;
  return {
    ...bundle,
    securities: [],
    quotes: { ...quotes, prices: [], sessions: [], overview: [], reference_prices: [], active_security_ids: [] },
    closes: [],
    pulse: [],
  };
}
