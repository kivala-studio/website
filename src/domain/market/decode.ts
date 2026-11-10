import Decimal from "decimal.js";

import type { MarketCalendarResponse } from "./calendar";
import { MarketDecodingError } from "./decoding-error";
import {
  type HomeMarketSummary,
  type MarketClientControl,
  type MarketSourceAvailability,
  SOURCE_AVAILABILITY_STATUSES,
  type SourceAvailabilityStatus,
} from "./models";
import { type DataQualityReport, QUALITY_REASONS, QUALITY_STATUSES, type QualityReason, type QualityStatus } from "./quality";

/*
 * Hand-written guards with the iOS decoding semantics: an optional key may be missing or null but,
 * when present, must have the right type; `tolerant` parts never fail their parent; `lossy` arrays
 * drop malformed rows only.
 */

type Json = unknown;
type JsonObject = Readonly<Record<string, Json>>;
type Read<T> = (value: Json, path: string) => T;

const fail = (path: string, expected: string): never => {
  throw new MarketDecodingError("market.decode", `${path}: expected ${expected}`);
};

const object = (value: Json, path: string): JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as JsonObject) : fail(path, "object");

const string: Read<string> = (value, path) => (typeof value === "string" ? value : fail(path, "string"));
const boolean: Read<boolean> = (value, path) => (typeof value === "boolean" ? value : fail(path, "boolean"));
const integer: Read<number> = (value, path) => (Number.isInteger(value) ? (value as number) : fail(path, "integer"));
/** Seconds and other non-monetary quantities. */
const number: Read<number> = (value, path) =>
  typeof value === "number" && Number.isFinite(value) ? value : fail(path, "number");

// Contract §2: numeric columns arrive as JSON numbers (evidence RPCs send strings); both become Decimal.
const decimal: Read<Decimal> = (value, path) => {
  if (typeof value === "number" && Number.isFinite(value)) return new Decimal(value);
  if (typeof value === "string" && /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(value.trim())) return new Decimal(value.trim());
  return fail(path, "decimal");
};

const array =
  <T>(item: Read<T>): Read<T[]> =>
  (value, path) =>
    Array.isArray(value) ? value.map((element, index) => item(element, `${path}[${index}]`)) : fail(path, "array");

/** A malformed element drops that element instead of the whole array. */
const lossy =
  <T>(item: Read<T>): Read<T[]> =>
  (value, path) =>
    Array.isArray(value)
      ? value.flatMap((element, index) => {
          try {
            return [item(element, `${path}[${index}]`)];
          } catch {
            return [];
          }
        })
      : fail(path, "array");

const required = <T>(record: JsonObject, key: string, read: Read<T>, path: string) => read(record[key], `${path}.${key}`);

const optional = <T>(record: JsonObject, key: string, read: Read<T>, path: string): T | undefined =>
  record[key] === undefined || record[key] === null ? undefined : read(record[key], `${path}.${key}`);

/** Later additions never fail their parent: malformed means absent. */
const tolerant = <T>(record: JsonObject, key: string, read: Read<T>, path: string): T | undefined => {
  try {
    return optional(record, key, read, path);
  } catch {
    return undefined;
  }
};

const oneOf = <T extends string>(values: readonly T[], value: string, fallback: T): T =>
  (values as readonly string[]).includes(value) ? (value as T) : fallback;

// Contract §3.3: data_quality carries status, reasons and epoch seconds only; observedAt is set locally.
export const readDataQuality: Read<DataQualityReport> = (value, path) => {
  const record = object(value, path);
  const status: QualityStatus = oneOf(QUALITY_STATUSES, required(record, "status", string, path), "unknown");
  const reasons: QualityReason[] = required(record, "reasons", array(string), path).map((reason) =>
    oneOf(QUALITY_REASONS, reason, "missingMetadata"),
  );
  return {
    status,
    reasons,
    validUntilEpoch: optional(record, "validUntilEpoch", number, path),
    sourceObservedAtEpoch: optional(record, "sourceObservedAtEpoch", number, path),
  };
};

export const encodeDataQuality = (report: DataQualityReport) => ({
  status: report.status,
  reasons: [...report.reasons],
  ...(report.validUntilEpoch === undefined ? {} : { validUntilEpoch: report.validUntilEpoch }),
  ...(report.sourceObservedAtEpoch === undefined ? {} : { sourceObservedAtEpoch: report.sourceObservedAtEpoch }),
});

export interface SecurityRow {
  readonly id: string;
  readonly symbol: string;
  readonly isin?: string;
  readonly name?: string;
  readonly securityType: string;
  readonly currency: string;
  readonly issuerID?: string;
  readonly isActive: boolean;
}

export const readSecurityRow: Read<SecurityRow> = (value, path) => {
  const record = object(value, path);
  return {
    id: required(record, "id", string, path),
    symbol: required(record, "symbol", string, path),
    isin: optional(record, "isin", string, path),
    name: optional(record, "name", string, path),
    securityType: required(record, "security_type", string, path),
    currency: required(record, "currency", string, path),
    issuerID: optional(record, "issuer_id", string, path),
    isActive: required(record, "is_active", boolean, path),
  };
};

export interface MarketPriceRow {
  readonly securityID: string;
  readonly tradingDate?: string;
  readonly openPrice?: Decimal;
  readonly closePrice?: Decimal;
  readonly highPrice?: Decimal;
  readonly lowPrice?: Decimal;
  readonly lastPrice?: Decimal;
  /** `verified_change_percent`: the only change used for calculations. */
  readonly changePercent?: Decimal;
  /** `change_percent` as reported by BODIVA: display only. */
  readonly reportedChangePercent?: Decimal;
  readonly volume?: Decimal;
  readonly tradeCount?: number;
  readonly dataQuality?: DataQualityReport;
}

export const currentRowPrice = (row: MarketPriceRow) => row.lastPrice ?? row.closePrice;

export const readMarketPriceRow: Read<MarketPriceRow> = (value, path) => {
  const record = object(value, path);
  return {
    securityID: required(record, "security_id", string, path),
    tradingDate: optional(record, "trading_date", string, path),
    openPrice: optional(record, "open_price", decimal, path),
    closePrice: optional(record, "close_price", decimal, path),
    highPrice: optional(record, "high_price", decimal, path),
    lowPrice: optional(record, "low_price", decimal, path),
    lastPrice: optional(record, "last_price", decimal, path),
    changePercent: optional(record, "verified_change_percent", decimal, path),
    reportedChangePercent: optional(record, "change_percent", decimal, path),
    volume: optional(record, "volume", decimal, path),
    tradeCount: optional(record, "trade_count", integer, path),
    dataQuality: optional(record, "data_quality", readDataQuality, path),
  };
};

export interface MarketSessionRow {
  readonly tradingDate: string;
  readonly totalVolume?: Decimal;
  readonly tradeCount?: number;
  readonly status?: string;
  readonly publishedAt?: string;
  readonly updatedAt?: string;
  readonly dataQuality?: DataQualityReport;
}

export const readSessionRow: Read<MarketSessionRow> = (value, path) => {
  const record = object(value, path);
  return {
    tradingDate: required(record, "trading_date", string, path),
    totalVolume: optional(record, "total_volume", decimal, path),
    tradeCount: optional(record, "trade_count", integer, path),
    status: optional(record, "status", string, path),
    publishedAt: optional(record, "published_at", string, path),
    updatedAt: optional(record, "updated_at", string, path),
    dataQuality: optional(record, "data_quality", readDataQuality, path),
  };
};

export interface MarketOverviewRow {
  readonly status?: string;
  readonly lastUpdatedAt?: string;
  readonly sourceTradingDate?: string;
  readonly collectedAt?: string;
  readonly publishedAt?: string;
  readonly dataStatus?: string;
}

export const readOverviewRow: Read<MarketOverviewRow> = (value, path) => {
  const record = object(value, path);
  return {
    status: optional(record, "status", string, path),
    lastUpdatedAt: optional(record, "last_updated_at", string, path),
    sourceTradingDate: optional(record, "source_trading_date", string, path),
    collectedAt: optional(record, "collected_at", string, path),
    publishedAt: optional(record, "published_at", string, path),
    dataStatus: optional(record, "data_status", string, path),
  };
};

/** Keys are camelCase and snake_case mixed, exactly as the server sends them. */
export const readSourceAvailability: Read<MarketSourceAvailability> = (value, path) => {
  const record = object(value, path);
  const status: SourceAvailabilityStatus = oneOf(SOURCE_AVAILABILITY_STATUSES, required(record, "status", string, path), "unknown");
  return {
    status,
    lastSuccessfulObservationAtEpoch: optional(record, "lastSuccessfulObservationAtEpoch", number, path),
    lastAttemptAtEpoch: optional(record, "lastAttemptAtEpoch", number, path),
    retryAfterEpoch: optional(record, "retryAfterEpoch", number, path),
    availableInstrumentCount: optional(record, "availableInstrumentCount", integer, path),
    totalInstrumentCount: optional(record, "totalInstrumentCount", integer, path),
    sourceTradingDate: optional(record, "sourceTradingDate", string, path),
    sessionQuoteCount: optional(record, "session_quote_count", integer, path),
    referencePriceCount: optional(record, "reference_price_count", integer, path),
    missingPriceCount: optional(record, "missing_price_count", integer, path),
    activeInstrumentCount: optional(record, "active_instrument_count", integer, path),
    coverageDate: optional(record, "coverage_date", string, path),
  };
};

export interface ReferenceEvidence {
  readonly price?: Decimal;
  readonly priceDate?: string;
  readonly tradedAt?: string;
  readonly collectedAt?: string;
  readonly sourceURL?: string;
  readonly sourceHash?: string;
  readonly parserVersion?: string;
}

export interface MarketReferencePriceRow {
  readonly securityID: string;
  readonly referencePrice?: ReferenceEvidence;
  readonly unavailableReason?: string;
  readonly lastCheckedAt?: string;
  readonly updateStatus?: string;
  readonly updateReason?: string;
}

const readReferenceEvidence: Read<ReferenceEvidence> = (value, path) => {
  const record = object(value, path);
  return {
    price: optional(record, "price", decimal, path),
    priceDate: optional(record, "price_date", string, path),
    tradedAt: optional(record, "traded_at", string, path),
    collectedAt: optional(record, "collected_at", string, path),
    sourceURL: optional(record, "source_url", string, path),
    sourceHash: optional(record, "source_hash", string, path),
    parserVersion: optional(record, "parser_version", string, path),
  };
};

export const readReferencePriceRow: Read<MarketReferencePriceRow> = (value, path) => {
  const record = object(value, path);
  return {
    securityID: required(record, "security_id", string, path),
    referencePrice: optional(record, "reference_price", readReferenceEvidence, path),
    unavailableReason: optional(record, "reference_unavailable_reason", string, path),
    lastCheckedAt: optional(record, "reference_last_checked_at", string, path),
    updateStatus: optional(record, "reference_update_status", string, path),
    updateReason: optional(record, "reference_update_reason", string, path),
  };
};

export interface VerifiedCloseRow {
  readonly securityID: string;
  readonly price: Decimal;
  readonly tradingDate: string;
  readonly confirmedAt: string;
  readonly verifiedChangePercent?: Decimal;
}

export const readVerifiedCloseRow: Read<VerifiedCloseRow> = (value, path) => {
  const record = object(value, path);
  return {
    securityID: required(record, "security_id", string, path),
    price: required(record, "price", decimal, path),
    tradingDate: required(record, "trading_date", string, path),
    confirmedAt: required(record, "confirmed_at", string, path),
    verifiedChangePercent: optional(record, "verified_change_percent", decimal, path),
  };
};

export interface MarketPulseRow {
  readonly tradingDate: string;
  readonly value: Decimal;
  readonly dailyChangePercent: Decimal;
  readonly dataQuality?: DataQualityReport;
}

export const readPulseRow: Read<MarketPulseRow> = (value, path) => {
  const record = object(value, path);
  return {
    tradingDate: required(record, "trading_date", string, path),
    value: required(record, "value", decimal, path),
    dailyChangePercent: required(record, "daily_change_percent", decimal, path),
    dataQuality: optional(record, "data_quality", readDataQuality, path),
  };
};

export const readClientControl: Read<MarketClientControl> = (value, path) => {
  const record = object(value, path);
  return {
    maintenance: required(record, "maintenance", boolean, path),
    minPollSeconds: required(record, "min_poll_seconds", integer, path),
  };
};

export const readCalendarResponse: Read<MarketCalendarResponse> = (value, path) => {
  const record = object(value, path);
  const day: Read<MarketCalendarResponse["days"][number]> = (item, itemPath) => {
    const entry = object(item, itemPath);
    return {
      day: required(entry, "day", string, itemPath),
      kind: required(entry, "kind", string, itemPath),
      opensAt: optional(entry, "opens_at", string, itemPath),
      closesAt: optional(entry, "closes_at", string, itemPath),
    };
  };
  return {
    contractVersion: required(record, "contract_version", integer, path),
    timezone: required(record, "timezone", string, path),
    version: required(record, "version", string, path),
    source: required(record, "source", string, path),
    fetchedAt: required(record, "fetched_at", string, path),
    validUntil: required(record, "valid_until", string, path),
    startsOn: required(record, "starts_on", string, path),
    endsOn: required(record, "ends_on", string, path),
    regularWeekdays: required(record, "regular_weekdays", array(integer), path),
    opensAt: required(record, "opens_at", string, path),
    closesAt: required(record, "closes_at", string, path),
    days: required(record, "days", array(day), path),
  };
};

export interface CurrentMarketQuotes {
  readonly prices: readonly MarketPriceRow[];
  readonly sessions: readonly MarketSessionRow[];
  readonly overview: readonly MarketOverviewRow[];
  /** Diagnostics only; malformed health metadata is ignored. */
  readonly availability?: MarketSourceAvailability;
  readonly referencePrices?: readonly MarketReferencePriceRow[];
  readonly activeSecurityIDs?: readonly string[];
}

export const readCurrentMarketQuotes: Read<CurrentMarketQuotes> = (value, path) => {
  const record = object(value, path);
  return {
    prices: required(record, "prices", array(readMarketPriceRow), path),
    sessions: required(record, "sessions", array(readSessionRow), path),
    overview: required(record, "overview", array(readOverviewRow), path),
    availability: tolerant(record, "availability", readSourceAvailability, path),
    referencePrices: tolerant(record, "reference_prices", array(readReferencePriceRow), path),
    activeSecurityIDs: tolerant(record, "active_security_ids", array(string), path),
  };
};

/** `market-snapshot` response body. */
export interface MarketSnapshotBundle {
  readonly contractVersion: number;
  readonly generatedAt: string;
  readonly securities: readonly SecurityRow[];
  readonly quotes: CurrentMarketQuotes;
  readonly closes?: readonly VerifiedCloseRow[];
  readonly freshUntil?: string;
  readonly pulse?: readonly MarketPulseRow[];
  readonly calendar?: MarketCalendarResponse;
  readonly control?: MarketClientControl;
}

export const readSnapshotBundle: Read<MarketSnapshotBundle> = (value, path) => {
  const record = object(value, path);
  return {
    contractVersion: required(record, "contract_version", integer, path),
    generatedAt: required(record, "generated_at", string, path),
    securities: required(record, "securities", lossy(readSecurityRow), path),
    quotes: required(record, "quotes", readCurrentMarketQuotes, path),
    closes: optional(record, "closes", array(readVerifiedCloseRow), path),
    // Parts added after the first release never fail the snapshot.
    freshUntil: tolerant(record, "fresh_until", string, path),
    pulse: tolerant(record, "pulse", array(readPulseRow), path),
    calendar: tolerant(record, "calendar", readCalendarResponse, path),
    control: tolerant(record, "control", readClientControl, path),
  };
};

export const readHomeSummary: Read<HomeMarketSummary> = (value, path) => {
  const record = object(value, path);
  return {
    instrumentCount: required(record, "instrument_count", integer, path),
    availableQuoteCount: required(record, "available_quote_count", integer, path),
    validUntilEpoch: required(record, "valid_until_epoch", number, path),
    lastObservationEpoch: optional(record, "last_observation_epoch", number, path),
    sessionQuoteCount: optional(record, "session_quote_count", integer, path),
    referencePriceCount: optional(record, "reference_price_count", integer, path),
    missingPriceCount: optional(record, "missing_price_count", integer, path),
    activeInstrumentCount: optional(record, "active_instrument_count", integer, path),
    coverageDate: optional(record, "coverage_date", string, path),
  };
};

/** `get_current_market_quotes` with the `home_v1` projection header. Every part is optional. */
export interface HomeProjectionResponse {
  readonly contractVersion?: number;
  readonly requiresFullSnapshot?: boolean;
  readonly generatedAt?: string;
  readonly summary?: HomeMarketSummary;
  readonly calendar?: MarketCalendarResponse;
  readonly securities?: readonly SecurityRow[];
  readonly quotes?: CurrentMarketQuotes;
}

export const readHomeProjectionResponse: Read<HomeProjectionResponse> = (value, path) => {
  const record = object(value, path);
  return {
    contractVersion: optional(record, "contract_version", integer, path),
    requiresFullSnapshot: optional(record, "requires_full_snapshot", boolean, path),
    generatedAt: optional(record, "generated_at", string, path),
    summary: optional(record, "summary", readHomeSummary, path),
    calendar: optional(record, "calendar", readCalendarResponse, path),
    securities: optional(record, "securities", array(readSecurityRow), path),
    quotes: optional(record, "quotes", readCurrentMarketQuotes, path),
  };
};

/** Entry points: parsed JSON in, typed rows out, `MarketDecodingError` on a broken contract. */
export const decodeSnapshotBundle = (json: Json) => readSnapshotBundle(json, "$");
export const decodeCurrentMarketQuotes = (json: Json) => readCurrentMarketQuotes(json, "$");
export const decodeHomeProjectionResponse = (json: Json) => readHomeProjectionResponse(json, "$");
export const decodeHomeSummary = (json: Json) => readHomeSummary(json, "$");
export const decodeCalendarResponse = (json: Json) => readCalendarResponse(json, "$");
export const decodeSecurityRows = (json: Json) => lossy(readSecurityRow)(json, "$");
export const decodeVerifiedCloseRows = (json: Json) => array(readVerifiedCloseRow)(json, "$");
export const decodePulseRows = (json: Json) => array(readPulseRow)(json, "$");
export const decodeReferencePriceRow = (json: Json) => readReferencePriceRow(json, "$");
export const decodeVerifiedCloseRow = (json: Json) => readVerifiedCloseRow(json, "$");
export const decodePulseRow = (json: Json) => readPulseRow(json, "$");
export const decodeDataQuality = (json: Json) => readDataQuality(json, "$");
