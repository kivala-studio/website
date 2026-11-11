import type { CivilDate } from "../format/date";
import { jsonGuards } from "./json-guards";
import type { PricePoint } from "./models";
import { validateChart } from "./quality";
import { type EpochMs, parseInstant } from "./zone";

/*
 * iOS `IntradayChartSnapshot` and the `get_intraday_chart` decoding of `SupabaseMarketRepository`
 * (contract §3.6). The prior-close anchor and the `1D` movement are `intradayChartPoints` and
 * `rangeMovement` in time-range.ts.
 */

export const INTRADAY_SOURCES = ["trades", "observations"] as const;
export type IntradaySource = (typeof INTRADAY_SOURCES)[number] | "unknown";

/** Trades: `ready`, `no_trades`, `stale`. Observations: `observed`, `stale`. */
export const INTRADAY_STATUSES = ["ready", "no_trades", "stale", "observed"] as const;
export type IntradayStatus = (typeof INTRADAY_STATUSES)[number] | "unknown";

export interface IntradayChartSnapshot {
  /** Validated, chronological; empty when any row was unusable. */
  readonly points: readonly PricePoint[];
  /** The session actually shown. */
  readonly sessionDate: CivilDate;
  readonly status: IntradayStatus;
  readonly source: IntradaySource;
  readonly lastCheckedAt?: EpochMs;
  readonly lastTradeAt?: EpochMs;
}

const json = jsonGuards("market.intradayChart");

const oneOf = <T extends string>(values: readonly T[], value: string): T | "unknown" =>
  (values as readonly string[]).includes(value) ? (value as T) : "unknown";

/** A candle, or undefined when its bucket time is unreadable or later than `now`. */
function readCandle(value: unknown, path: string, now: EpochMs): PricePoint | undefined {
  const row = json.object(value, path);
  json.required(row, "security_id", json.string, path);
  const date = parseInstant(json.required(row, "bucket_at", json.string, path));
  const fields = {
    value: json.required(row, "close_price", json.decimal, path),
    openValue: json.optional(row, "open_price", json.decimal, path),
    highValue: json.optional(row, "high_price", json.decimal, path),
    lowValue: json.optional(row, "low_price", json.decimal, path),
    volume: json.optional(row, "volume", json.decimal, path),
    tradeCount: json.optional(row, "trade_count", json.integer, path),
  };
  json.optional(row, "traded_amount", json.decimal, path);
  return date !== undefined && date <= now ? { date, ...fields } : undefined;
}

/**
 * The RPC body as a snapshot. A broken contract throws `MarketDecodingError`; a future or
 * unreadable bucket, or a series `validateChart` rejects, leaves the snapshot without points.
 */
export function decodeIntradayChart(body: unknown, now: EpochMs): IntradayChartSnapshot {
  const path = "$";
  const record = json.object(body, path);
  const instant = (key: string) => {
    const text = json.optional(record, key, json.string, path);
    return text === undefined ? undefined : parseInstant(text);
  };
  const rows = json.required(record, "points", json.array((row, rowPath) => readCandle(row, rowPath, now)), path);
  const points = rows.filter((point): point is PricePoint => point !== undefined);
  return {
    points: points.length === rows.length ? validateChart(points).points : [],
    sessionDate: json.required(record, "session_date", json.string, path),
    status: oneOf(INTRADAY_STATUSES, json.required(record, "status", json.string, path)),
    source: oneOf(INTRADAY_SOURCES, json.required(record, "source", json.string, path)),
    lastCheckedAt: instant("last_checked_at"),
    lastTradeAt: instant("last_trade_at"),
  };
}

export type IntradayStatusKey =
  | "assetDetails.chart.outdatedData"
  | "assetDetails.chart.noTrades"
  | "assetDetails.chart.oneTrade"
  | "assetDetails.chart.loadingSession";

/** iOS `IntradayChartStatusView`: the line under the `1D` chart. */
export interface IntradayStatusLine {
  readonly key: IntradayStatusKey;
  /** Warning tint and a retry action. */
  readonly stale: boolean;
  /** Adds `assetDetails.chart.lastTradeNote`. */
  readonly showsLastTradeNote: boolean;
}

/** Shown while loading, when stale or failed, without trades, or with a single trade; otherwise undefined. */
export function intradayStatusLine(chart: IntradayChartSnapshot | undefined, failed: boolean): IntradayStatusLine | undefined {
  const stale = failed || chart?.status === "stale";
  const single = chart?.source === "trades" && chart.points.length === 1;
  if (!stale && chart !== undefined && chart.status !== "no_trades" && !single) return undefined;
  const key: IntradayStatusKey = stale
    ? "assetDetails.chart.outdatedData"
    : chart?.status === "no_trades"
      ? "assetDetails.chart.noTrades"
      : chart?.points.length === 1
        ? "assetDetails.chart.oneTrade"
        : "assetDetails.chart.loadingSession";
  return { key, stale, showsLastTradeNote: chart?.source === "trades" && chart.points.length > 0 };
}

/** The empty `1D` chart message. */
export const intradayEmptyKey = (chart: IntradayChartSnapshot | undefined, failed: boolean) =>
  chart?.status === "no_trades" && !failed ? "assetDetails.chart.noTradesSentence" : "assetDetails.chart.sessionUnavailable";
