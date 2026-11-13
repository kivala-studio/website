import type { SupabaseClient } from "@supabase/supabase-js";

import { CancellationError, boundaryError, isCancellation, mapError } from "@/domain/errors";
import {
  EMPTY_MARKET_INDEX,
  MarketCalendar,
  type MarketClientControl,
  type MarketIndex,
  type MarketSnapshot,
  type MarketUpdate,
  type PricePoint,
  SnapshotRoute,
  acceptSnapshotBundle,
  buildMarketSnapshot,
  decodeCalendarResponse,
  decodeCurrentMarketQuotes,
  decodeMarketCalendar,
  decodePulseRows,
  decodeSecurityRows,
  decodeSnapshotBundle,
  decodeVerifiedCloseRows,
  makeMarketIndex,
} from "@/domain/market";
import { type EpochMs, DAY_MS, addDays, civilDate, parseInstant } from "@/domain/market/zone";

import { readAll, unwrap } from "../supabase/read";
import { SnapshotExtras } from "./extras";
import { readPriceHistory, readPulseHistory } from "./history";

/** One shared snapshot response: exact-parsed JSON and its `ETag`. */
export type SnapshotResponse = { json: unknown; etag?: string };

/** Where the shared snapshot comes from: `/api/market/snapshot` in the browser, the Edge Function on the server. */
export type SnapshotSource = (signal?: AbortSignal) => Promise<SnapshotResponse>;

/** What the market store needs. Every method throws `AppError` or `CancellationError`. */
export interface MarketRepository {
  fetchLightSnapshot(signal?: AbortSignal): Promise<MarketSnapshot>;
  fetchTradingCalendar(signal?: AbortSignal): Promise<MarketCalendar | undefined>;
  fetchMarketIndex(signal?: AbortSignal): Promise<MarketIndex>;
  /** Daily closes for one security over the range its source allows (one year for public pages). */
  fetchDailyHistory(securityID: string, signal?: AbortSignal): Promise<PricePoint[]>;
  clientControl(): MarketClientControl | undefined;
}

/** Where daily history comes from: `/api/market/history/{id}` in the browser. */
export type HistorySource = (securityID: string, signal?: AbortSignal) => Promise<PricePoint[]>;

const SECURITY_COLUMNS = "id,symbol,isin,name,currency,security_type,issuer_id,is_active";

/** Contract/4xx failures fall through to the direct reads in the same refresh; transport failures do not. */
const fallsThrough = (error: unknown) => {
  const mapped = mapError(error, "market.snapshot");
  return mapped !== null && mapped.category !== "offline" && mapped.category !== "connectionLost";
};

/**
 * Market reads (iOS `SupabaseMarketRepository`). The shared snapshot is preferred; after a server
 * failure the direct reads replace it for five minutes, and a refresh never sends both after one.
 * Without a Supabase client (demo mode) only the snapshot is read.
 */
export class SupabaseMarketRepository implements MarketRepository {
  readonly extras = new SnapshotExtras();
  private readonly route: SnapshotRoute;
  private readonly now: () => EpochMs;

  constructor(
    private readonly options: {
      snapshot: SnapshotSource;
      /** Loaded on first use, so pages that never fall back do not load the SDK. */
      supabase?: () => SupabaseClient | Promise<SupabaseClient>;
      history?: HistorySource;
      now?: () => EpochMs;
      route?: SnapshotRoute;
      /** Demo only: market information attached to every snapshot (the live backend sends none). */
      updates?: readonly MarketUpdate[];
    },
  ) {
    this.now = options.now ?? Date.now;
    this.route = options.route ?? new SnapshotRoute();
  }

  clientControl(): MarketClientControl | undefined {
    return this.extras.control;
  }

  async fetchLightSnapshot(signal?: AbortSignal): Promise<MarketSnapshot> {
    try {
      // Without direct reads (demo mode) the snapshot is the only route, also after a server failure.
      if (!this.options.supabase || this.route.usesSnapshot(this.now())) {
        try {
          return this.withUpdates(await this.fromSnapshot(signal));
        } catch (error) {
          if (isCancellation(error) || signal?.aborted) throw new CancellationError();
          if (SnapshotRoute.isServerFailure(error)) {
            this.route.recordServerFailure(this.now());
            throw error;
          }
          if (!this.options.supabase || !fallsThrough(error)) throw error;
        }
      }
      return this.withUpdates(await this.fromDirectReads(signal));
    } catch (error) {
      throw boundaryError(error, "supabase.fetchLightSnapshot");
    }
  }

  private withUpdates(snapshot: MarketSnapshot): MarketSnapshot {
    return this.options.updates ? { ...snapshot, updates: this.options.updates } : snapshot;
  }

  async fetchTradingCalendar(signal?: AbortSignal): Promise<MarketCalendar | undefined> {
    const now = this.now();
    const week = MarketCalendar.week(now);
    if (!week) return undefined;
    const startsOn = civilDate(addDays(week.start, -28));
    const endsOn = civilDate(addDays(week.endExclusive, 14) - DAY_MS);
    const bundled = this.extras.calendar(startsOn, endsOn, now);
    if (bundled) {
      try {
        return decodeMarketCalendar(bundled.row, now, bundled.freshUntil);
      } catch {
        // A malformed bundled calendar falls back to its own read.
      }
    }
    const client = await this.options.supabase?.();
    if (!client) return undefined;
    try {
      const query = client.rpc("get_market_calendar", { starts_on: startsOn, ends_on: endsOn });
      const json = unwrap(await (signal ? query.abortSignal(signal) : query));
      return decodeMarketCalendar(decodeCalendarResponse(json), this.now());
    } catch (error) {
      throw boundaryError(error, "supabase.fetchTradingCalendar");
    }
  }

  async fetchMarketIndex(signal?: AbortSignal): Promise<MarketIndex> {
    const bundled = this.extras.pulse(this.now());
    if (bundled) return makeMarketIndex(bundled);
    const client = await this.options.supabase?.();
    if (!client) return EMPTY_MARKET_INDEX;
    try {
      let query = client.from("quality_market_pulse_history").select().order("trading_date", { ascending: false }).limit(30);
      if (signal) query = query.abortSignal(signal);
      return makeMarketIndex(decodePulseRows(unwrap(await query)));
    } catch (error) {
      throw boundaryError(error, "supabase.fetchMarketIndex");
    }
  }

  async fetchDailyHistory(securityID: string, signal?: AbortSignal): Promise<PricePoint[]> {
    if (!this.options.history) return [];
    try {
      return await this.options.history(securityID, signal);
    } catch (error) {
      throw boundaryError(error, "market.fetchDailyHistory");
    }
  }

  /** The full market indicator series: complete calendar years for longer periods. */
  async fetchHistory(partial: MarketSnapshot, signal?: AbortSignal): Promise<MarketSnapshot> {
    try {
      const client = await this.options.supabase?.();
      if (!client) return { ...partial, index: EMPTY_MARKET_INDEX };
      return { ...partial, index: makeMarketIndex(await readPulseHistory(client, this.now(), signal)) };
    } catch (error) {
      throw boundaryError(error, "supabase.fetchHistory");
    }
  }

  async fetchPriceHistory(
    securityID: string,
    range: { from?: EpochMs; through?: EpochMs } = {},
    signal?: AbortSignal,
  ): Promise<PricePoint[]> {
    try {
      const client = await this.options.supabase?.();
      if (!client) return [];
      return await readPriceHistory(client, securityID, { from: range.from, through: range.through ?? this.now() }, signal);
    } catch (error) {
      throw boundaryError(error, "supabase.fetchPriceHistory");
    }
  }

  private async fromSnapshot(signal?: AbortSignal): Promise<MarketSnapshot> {
    const { json, etag } = await this.options.snapshot(signal);
    const bundle = decodeSnapshotBundle(json);
    const now = this.now();
    const generatedAt = acceptSnapshotBundle(bundle, now);
    const freshUntil = parseInstant(bundle.freshUntil);
    if (freshUntil !== undefined && freshUntil > generatedAt) {
      this.extras.store({ generatedAt, freshUntil, pulse: bundle.pulse, calendar: bundle.calendar }, bundle.control);
    }
    const snapshot = buildMarketSnapshot(
      { securities: bundle.securities, quotes: bundle.quotes, closes: bundle.closes, generatedAt },
      now,
    );
    return etag ? { ...snapshot, sourceMetadata: { ...snapshot.sourceMetadata, snapshotETag: etag } } : snapshot;
  }

  private async fromDirectReads(signal?: AbortSignal): Promise<MarketSnapshot> {
    const client = await this.options.supabase!();
    const withSignal = <Q extends { abortSignal(signal: AbortSignal): Q }>(query: Q) => (signal ? query.abortSignal(signal) : query);
    const [securities, quotes, closes] = await Promise.all([
      readAll((from, to) => withSignal(client.from("securities").select(SECURITY_COLUMNS).order("symbol").order("id").range(from, to))),
      withSignal(client.rpc("get_current_market_quotes")).then(unwrap),
      // Verified closes are optional: their failure leaves the catalogue and quotes usable.
      readAll((from, to) => withSignal(client.from("latest_verified_market_closes").select().order("security_id").range(from, to)))
        .then(decodeVerifiedCloseRows)
        .catch(() => undefined),
    ]);
    return buildMarketSnapshot(
      { securities: decodeSecurityRows(securities), quotes: decodeCurrentMarketQuotes(quotes), closes },
      this.now(),
    );
  }
}
