import "server-only";

import { readLedger } from "@/data/account/portfolio";
import type { AccountSession } from "@/data/account/session";
import { demoScenario } from "@/data/demo/account";
import { demoLedger } from "@/data/demo/portfolio";
import { demoWeekCalendar, demoWeekDividendRows } from "@/data/demo/week-ahead";
import { getPublicCatalogue } from "@/data/market/public-cache";
import { readAll, unwrap } from "@/data/supabase/read";
import { decodeCalendarResponse, decodeMarketCalendar } from "@/domain/market";
import type { MarketCalendar } from "@/domain/market/calendar";
import type { EpochMs } from "@/domain/market/zone";
import { ledgerPositions } from "@/domain/portfolio/calculator";
import { type TransactionWire, fromWire } from "@/domain/portfolio/records";
import {
  DIVIDEND_EVENT_COLUMNS,
  type MarketEvent,
  type WeekSecurity,
  dividendEvents,
  lastDay,
  nextWeek,
  verifiedClosures,
} from "@/domain/week-ahead/week-ahead";

/** What `/api/account/week-ahead` answers: the source batch, or a calendar that cannot vouch for the week. */
export type WeekAheadPayload =
  | { readonly verified: false; readonly periodID: string }
  | {
      readonly verified: true;
      readonly periodID: string;
      readonly fetchedAt: EpochMs;
      readonly events: readonly MarketEvent[];
      readonly securities: readonly WeekSecurity[];
      readonly heldIDs: readonly string[];
      readonly closedDays: readonly string[];
    };

function calendarOf(json: unknown, now: EpochMs): MarketCalendar | undefined {
  if (json === null || json === undefined) return undefined;
  try {
    return decodeMarketCalendar(decodeCalendarResponse(json), now);
  } catch {
    return undefined;
  }
}

/** Held instruments after a valid ledger read; an unreadable ledger relates nothing (iOS needs a loaded portfolio). */
async function heldIDs(read: () => Promise<{ transactions: TransactionWire[] }>, now: EpochMs): Promise<string[]> {
  try {
    const { transactions } = await read();
    return ledgerPositions(transactions.map(fromWire), { asOf: now }).map((position) => position.securityId);
  } catch {
    return [];
  }
}

async function securities(now: EpochMs): Promise<WeekSecurity[]> {
  try {
    return (await getPublicCatalogue(now)).map((item) => ({ id: item.id, issuerID: item.issuerID, isEquity: item.kind === "equity" }));
  } catch {
    return [];
  }
}

/**
 * The coming week for this account (iOS `WeekAheadCoordinator` + `SupabaseMarketEventRepository`): `issuer_dividends`
 * read fresh, the verified calendar for the same week, the instruments the ledger holds and the catalogue's issuers.
 * A failed source read throws; a calendar that is missing or unverified withholds the week.
 */
export async function readWeekAhead(session: AccountSession, now: EpochMs, regularWeek = false): Promise<WeekAheadPayload> {
  const period = nextWeek(now);
  if (!period) throw new Error("week");
  let calendarJson: unknown;
  let rows: unknown[];
  let held: Promise<string[]>;
  if (session.kind === "demo") {
    const scenario = await demoScenario();
    calendarJson = demoWeekCalendar(scenario, now, regularWeek);
    rows = demoWeekDividendRows(scenario, now);
    held = heldIDs(demoLedger, now);
  } else {
    const { client } = session;
    held = heldIDs(() => readLedger(client), now);
    [calendarJson, rows] = await Promise.all([
      client.rpc("get_market_calendar", { starts_on: period.id, ends_on: lastDay(period) }).then(unwrap),
      readAll<unknown>((from, to) => client.from("issuer_dividends").select(DIVIDEND_EVENT_COLUMNS).order("id").range(from, to)),
    ]);
  }
  // The demo clock may stand on another day; the batch is dated on it.
  const fetchedAt = session.kind === "demo" ? now : Date.now();
  const closedDays = verifiedClosures(calendarOf(calendarJson, fetchedAt), period, fetchedAt);
  if (closedDays === null) return { verified: false, periodID: period.id };
  const [heldList, catalogue] = await Promise.all([held, securities(now)]);
  return {
    verified: true,
    periodID: period.id,
    fetchedAt,
    events: rows.flatMap((row) => dividendEvents(row, fetchedAt)),
    securities: catalogue,
    heldIDs: heldList,
    closedDays,
  };
}
