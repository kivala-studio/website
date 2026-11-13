import type { SupabaseClient } from "@supabase/supabase-js";
import Decimal from "decimal.js";

import { unwrap } from "@/data/supabase/read";
import { type CalendarException, MarketCalendar, decodeCalendarResponse, decodeMarketCalendar, readDataQuality } from "@/domain/market";
import type { PriceObservation } from "@/domain/market/history-validation";
import { type EpochMs, DAY_MS, MINUTE_MS, civilDate, dayStart, parseInstant } from "@/domain/market/zone";
import type { InsightPeriod } from "@/domain/intelligence/models";

/*
 * `get_market_period_evidence` (iOS `WeeklyWrapEvidenceRepository`, contract v3): verified daily closes for a
 * civil period plus the 14 days before it, the server's day list and the calendar snapshot it was built from.
 * Strict: any contract violation rejects the whole response. Only `is_final` rows are kept.
 */

export const EVIDENCE_CONTRACT_VERSION = 3;
export type EvidenceKind = "weekly" | "monthly" | "yearly";

export interface EvidencePeriod extends InsightPeriod {
  readonly kind?: EvidenceKind;
}

export interface MarketPeriodEvidence {
  /** From the last trading day before the period (the baseline close) to the period's end. */
  readonly comparisonPeriod: InsightPeriod;
  readonly calendar: MarketCalendar;
  readonly observations: readonly PriceObservation[];
  readonly fetchedAt: EpochMs;
}

export class EvidenceError extends Error {
  constructor(
    readonly code: "insufficientHistory" | "decoding",
    readonly operation: string,
  ) {
    super(`${code}: ${operation}`);
    this.name = "EvidenceError";
  }
}

const decoding = (operation: string): never => {
  throw new EvidenceError("decoding", operation);
};

export const evidenceParameters = (period: EvidencePeriod) => ({
  starts_on: civilDate(period.start),
  ends_on: civilDate(period.endExclusive - DAY_MS),
  requested_kind: period.kind ?? "weekly",
});

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, operation: string): string => (typeof value === "string" ? value : decoding(operation));
const optionalText = (value: unknown, operation: string): string | undefined => (value === undefined || value === null ? undefined : text(value, operation));

/** A strict `yyyy-MM-dd` Luanda day. */
function marketDay(value: unknown): EpochMs | undefined {
  if (typeof value !== "string") return undefined;
  const start = dayStart(value);
  return start !== undefined && civilDate(start) === value ? start : undefined;
}

function minute(value: string): number | undefined {
  const parts = value.split(":");
  if (parts.length !== 3 || !parts.every((part) => /^\d+(\.\d+)?$/.test(part))) return undefined;
  const [hour, minutes, seconds] = parts.map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minutes) || hour < 0 || hour >= 24 || minutes < 0 || minutes >= 60 || seconds !== 0) return undefined;
  return hour * 60 + minutes;
}

const DECIMAL_TEXT = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const HEX_64 = /^[0-9a-fA-F]{64}$/;

function readObservation(value: unknown, contractVersion: number): PriceObservation {
  if (!isObject(value)) return decoding("wrap.observation");
  const sha = text(value.source_sha256, "wrap.observation");
  const parserVersion = text(value.parser_version, "wrap.observation");
  const dataset = text(value.dataset, "wrap.observation");
  const price = text(value.price, "wrap.observation");
  const observedAt = parseInstant(text(value.observed_at, "wrap.observation"));
  const collectedAt = parseInstant(text(value.collected_at, "wrap.observation"));
  if (typeof value.is_final !== "boolean") return decoding("wrap.observation");
  if (
    !HEX_64.test(sha) ||
    parserVersion === "" ||
    !dataset.startsWith("price_history.") ||
    !DECIMAL_TEXT.test(price) ||
    observedAt === undefined ||
    collectedAt === undefined
  ) {
    return decoding("wrap.observation");
  }
  const quality = value.data_quality === undefined || value.data_quality === null ? undefined : readDataQuality(value.data_quality, "$.data_quality");
  if (contractVersion >= 3 && quality === undefined) return decoding("wrap.qualityContract");
  return {
    recordID: text(value.record_id, "wrap.observation"),
    assetID: text(value.asset_id, "wrap.observation"),
    currencyCode: text(value.currency_code, "wrap.observation"),
    price: new Decimal(price),
    observedAt,
    collectedAt,
    source: { dataset, ingestionRunID: text(value.ingestion_run_id, "wrap.observation"), contentHash: sha, parserVersion },
    isFinal: value.is_final,
    ...(quality === undefined ? {} : { dataQuality: quality }),
  };
}

/**
 * Validates a response for `period`. `live` is a fresh network response, which must be contract v3 with a calendar
 * snapshot; cached copies may be v1 to v3. `now` is the assessment instant for the snapshot calendar.
 */
export function decodeMarketPeriodEvidence(json: unknown, period: EvidencePeriod, now: EpochMs, live = true): MarketPeriodEvidence {
  if (!isObject(json)) return decoding("wrap.evidence");
  const contract = json.contract_version;
  const snapshot = json.calendar_snapshot ?? undefined;
  if (typeof contract !== "number" || !Number.isInteger(contract)) return decoding("wrap.evidence");
  if (live && (contract !== EVIDENCE_CONTRACT_VERSION || snapshot === undefined)) return decoding("wrap.calendarContract");
  if (contract >= 2 && snapshot === undefined) return decoding("wrap.calendarContract");
  const baseline = marketDay(json.baseline_day);
  if (baseline === undefined || !(baseline < period.start)) throw new EvidenceError("insufficientHistory", "wrap.baseline");
  const days = Array.isArray(json.calendar) ? json.calendar : decoding("wrap.evidence");
  const observationsJson = Array.isArray(json.observations) ? json.observations : decoding("wrap.evidence");
  const fetched = parseInstant(typeof json.fetched_at === "string" ? json.fetched_at : undefined);
  const first = marketDay(isObject(days[0]) ? days[0].day : undefined);
  const last = marketDay(isObject(days.at(-1)) ? days.at(-1).day : undefined);
  if (![1, 2, 3].includes(contract) || fetched === undefined || first === undefined || last === undefined) return decoding("wrap.evidence");
  const end = last + DAY_MS;
  if (end !== period.endExclusive || first !== period.start - 14 * DAY_MS || first > baseline || days.length !== Math.round((end - first) / DAY_MS)) {
    return decoding("wrap.evidence");
  }
  const exceptions = new Map<EpochMs, CalendarException>();
  const versions: string[] = [];
  for (const item of days) {
    if (!isObject(item)) return decoding("wrap.calendar");
    const date = marketDay(item.day);
    if (date === undefined || exceptions.has(date) || typeof item.is_open !== "boolean") return decoding("wrap.calendar");
    const opensAt = optionalText(item.opens_at, "wrap.hours");
    const closesAt = optionalText(item.closes_at, "wrap.hours");
    const revision = optionalText(item.revision, "wrap.calendar");
    if (item.is_open) {
      const open = opensAt === undefined ? undefined : minute(opensAt);
      const close = closesAt === undefined ? undefined : minute(closesAt);
      if (open === undefined || close === undefined) return decoding("wrap.hours");
      exceptions.set(date, { kind: "session", hours: { openingMinute: open, closingMinute: close } });
    } else exceptions.set(date, { kind: "closed" });
    versions.push(`${item.day as string}:${item.is_open}:${opensAt ?? ""}:${closesAt ?? ""}:${revision ?? ""}`);
  }
  for (let cursor = first; cursor < end; cursor += DAY_MS) if (!exceptions.has(cursor)) return decoding("wrap.calendarCoverage");
  const preceding = Math.max(...[...exceptions].filter(([date, exception]) => exception.kind === "session" && date < period.start).map(([date]) => date));
  if (preceding !== baseline) return decoding("wrap.baseline");
  const legacy = new MarketCalendar({
    version: `backend-v1|${versions.join("|")}`,
    coverage: { start: first, endExclusive: end },
    verifiedAt: fetched,
    validUntil: fetched + 15 * MINUTE_MS,
    normalHours: { openingMinute: 9 * 60, closingMinute: 15 * 60 + 30 },
    exceptions,
    regularWeekdays: new Set([2, 3, 4, 5, 6]),
  });
  let calendar = legacy;
  if (contract >= 2 && snapshot !== undefined) {
    const asOf = now;
    try {
      calendar = decodeMarketCalendar(decodeCalendarResponse(snapshot), asOf);
    } catch {
      return decoding("wrap.verifiedCalendar");
    }
    if (calendar.coverage.start !== first || calendar.coverage.endExclusive !== end || calendar.previousTradingDay(period.start, asOf) !== baseline) {
      return decoding("wrap.verifiedCalendar");
    }
    const expected = calendar.sessions({ start: first, endExclusive: end }, asOf);
    const received = legacy.sessions({ start: first, endExclusive: end }, fetched);
    if (!expected || !received || JSON.stringify(expected) !== JSON.stringify(received)) return decoding("wrap.calendarMismatch");
  }
  const observations = observationsJson.map((row) => readObservation(row, contract)).filter((row) => row.isFinal);
  return { comparisonPeriod: { start: baseline, endExclusive: end }, calendar, observations, fetchedAt: fetched };
}

/** Fetches and validates the evidence for `period` with the signed-in client. */
export async function fetchMarketPeriodEvidence(client: SupabaseClient, period: EvidencePeriod, now: () => EpochMs = Date.now): Promise<MarketPeriodEvidence> {
  const json = unwrap(await client.rpc("get_market_period_evidence", evidenceParameters(period)));
  return decodeMarketPeriodEvidence(json, period, now());
}
