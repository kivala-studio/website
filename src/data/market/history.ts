import type { SupabaseClient } from "@supabase/supabase-js";

import { DecodingError } from "@/domain/errors";
import {
  type MarketPulseRow,
  type PricePoint,
  type PriceHistoryRow,
  decodePriceHistoryRows,
  decodePulseRows,
  reportedClose,
  validateChart,
} from "@/domain/market";
import { type EpochMs, civilDate, tradingDateNoon } from "@/domain/market/zone";

import { readAll, unwrap } from "../supabase/read";

const HISTORY_COLUMNS = "security_id,trading_date,close_price,open_price,high_price,low_price,volume";
/** Keyset page size for `price_history` (iOS). */
const HISTORY_PAGE = 1000;

const withSignal = <Q extends { abortSignal(signal: AbortSignal): unknown }>(query: Q, signal?: AbortSignal): Q =>
  signal ? (query.abortSignal(signal) as Q) : query;

/**
 * Raw `price_history` rows (M13) with date keyset paging, stable while newer rows arrive; paging
 * ends at an empty page. JSON-safe, so callers may cache it before `pricePoints`.
 */
export async function readPriceHistoryRows(
  client: SupabaseClient,
  securityID: string,
  range: { from?: EpochMs; through: EpochMs },
  signal?: AbortSignal,
): Promise<unknown[]> {
  const through = civilDate(range.through);
  const from = range.from === undefined ? undefined : civilDate(range.from);
  const rows: unknown[] = [];
  let cursor: string | undefined;
  for (;;) {
    let query = client.from("price_history").select(HISTORY_COLUMNS).eq("security_id", securityID).lte("trading_date", through);
    if (from) query = query.gte("trading_date", from);
    if (cursor) query = query.gt("trading_date", cursor);
    const page = unwrap(await withSignal(query.order("trading_date").limit(HISTORY_PAGE), signal)) as unknown[];
    const decoded = decodePriceHistoryRows(page);
    if (decoded.length === 0) break;
    const next = decoded.at(-1)!.tradingDate;
    if (tradingDateNoon(next) === undefined || next <= (cursor ?? "")) throw new DecodingError("history cursor");
    rows.push(...page);
    cursor = next;
  }
  return rows;
}

/** Chart points from raw rows: legacy rows without provenance count; malformed candles keep only their close. */
export function pricePoints(rows: unknown): PricePoint[] {
  const points = decodePriceHistoryRows(rows).flatMap((row: PriceHistoryRow): PricePoint[] => {
    const date = tradingDateNoon(row.tradingDate);
    if (row.closePrice === undefined || date === undefined) return [];
    const close = reportedClose({
      date,
      value: row.closePrice,
      openValue: row.openPrice,
      highValue: row.highPrice,
      lowValue: row.lowPrice,
      volume: row.volume,
    });
    return close ? [close] : [];
  });
  return validateChart(points).points;
}

export async function readPriceHistory(
  client: SupabaseClient,
  securityID: string,
  range: { from?: EpochMs; through: EpochMs },
  signal?: AbortSignal,
): Promise<PricePoint[]> {
  return pricePoints(await readPriceHistoryRows(client, securityID, range, signal));
}

/** Raw market indicator rows from the first day of the previous calendar year (Luanda), paged. */
export function readPulseRows(client: SupabaseClient, now: EpochMs, signal?: AbortSignal): Promise<unknown[]> {
  const year = Number(civilDate(now).slice(0, 4));
  return readAll((from, to) =>
    withSignal(
      client
        .from("quality_market_pulse_history")
        .select()
        .gte("trading_date", `${year - 1}-01-01`)
        .order("trading_date")
        .range(from, to),
      signal,
    ),
  );
}

export async function readPulseHistory(client: SupabaseClient, now: EpochMs, signal?: AbortSignal): Promise<MarketPulseRow[]> {
  return decodePulseRows(await readPulseRows(client, now, signal));
}
