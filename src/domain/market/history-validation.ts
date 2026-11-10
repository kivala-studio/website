import Decimal from "decimal.js";

import { type MarketCalendar, type Period, type Session, isValidPeriod, periodContains } from "./calendar";
import { type DataQualityReport, VALID_QUALITY, permitsInsight, permitsUse, qualityFailure } from "./quality";
import { type EpochMs, DAY_MS, MINUTE_MS } from "./zone";

/** A closing price from a source row, never from a chart point or a snapshot-wide timestamp. */
export interface PriceObservation {
  readonly recordID: string;
  readonly assetID: string;
  readonly currencyCode: string;
  readonly price: Decimal;
  readonly observedAt: EpochMs;
  readonly collectedAt: EpochMs;
  readonly source: {
    readonly dataset: string;
    readonly ingestionRunID: string;
    readonly contentHash?: string;
    readonly parserVersion?: string;
  };
  readonly isFinal: boolean;
  readonly dataQuality?: DataQualityReport;
}

export interface HistoryFreshness {
  readonly maximumFetchAgeMs: number;
  readonly maximumPeriodAgeMs: number;
}

export const DEFAULT_HISTORY_FRESHNESS: HistoryFreshness = { maximumFetchAgeMs: 15 * MINUTE_MS, maximumPeriodAgeMs: 7 * DAY_MS };

export interface HistoryInput {
  readonly period: Period;
  readonly generatedAt: EpochMs;
  readonly fetchedAt: EpochMs;
  readonly calendar?: MarketCalendar;
  readonly observations: readonly PriceObservation[];
  readonly watchlistIDs?: readonly string[];
  readonly portfolioIDs?: readonly string[];
  readonly freshness?: HistoryFreshness;
}

export interface HistoryAssessment {
  readonly period: DataQualityReport;
  readonly assets: ReadonlyMap<string, DataQualityReport>;
  /** Only series that passed every check: one final, provenanced close per session. */
  readonly verified: ReadonlyMap<string, readonly PriceObservation[]>;
  readonly sessions: readonly Session[];
}

const HUNDRED = new Decimal(100);
// Contract §13: percentages are numeric(16,8); a change outside that range cannot be real and fails closed.
const PERCENT_LIMIT = new Decimal("1e8");

/** Unrounded percentage points, or `undefined` when invalid. */
export function percentageChange(from: Decimal, to: Decimal): Decimal | undefined {
  if (from.isNaN() || to.isNaN() || !from.gt(0) || to.lt(0)) return undefined;
  const result = to.minus(from).div(from).times(HUNDRED);
  return result.isFinite() && result.abs().lt(PERCENT_LIMIT) ? result : undefined;
}

const LOWER_HEX_64 = /^[0-9a-f]{64}$/;
const CURRENCY = /^[A-Z]{3}$/;

function validateRows(
  rows: readonly PriceObservation[],
  assetID: string,
  expected: readonly EpochMs[],
  fetchedAt: EpochMs,
  duplicateIDs: ReadonlySet<string>,
): DataQualityReport {
  if (rows.length === 0) return qualityFailure("incomplete", "missingObservation");
  if (rows.some((row) => duplicateIDs.has(row.recordID)) || new Set(rows.map((row) => row.observedAt)).size !== rows.length) {
    return qualityFailure("invalid", "duplicateObservation");
  }
  if (assetID === "" || !rows.every((row) => !row.price.isNaN() && row.price.gt(0))) {
    return qualityFailure("invalid", "invalidValue");
  }
  if (!rows.every((row) => Number.isFinite(row.collectedAt) && row.observedAt <= row.collectedAt && row.collectedAt <= fetchedAt)) {
    return qualityFailure("invalid", "invalidTimestamp");
  }
  const currency = rows[0].currencyCode;
  if (!rows.every((row) => row.currencyCode === currency && CURRENCY.test(row.currencyCode))) {
    return qualityFailure("invalid", "inconsistentCurrency");
  }
  const provenanced = rows.every(({ recordID, source }) =>
    recordID !== "" &&
    source.dataset !== "" &&
    source.ingestionRunID !== "" &&
    source.contentHash !== undefined &&
    LOWER_HEX_64.test(source.contentHash) &&
    source.parserVersion !== undefined &&
    source.parserVersion.trim() !== "",
  );
  if (!provenanced || !rows.every((row) => row.dataQuality !== undefined)) return qualityFailure("unknown", "missingProvenance");
  const qualities = rows.flatMap((row) => (row.dataQuality ? [row.dataQuality] : []));
  const rejected = qualities.find((quality) => !permitsInsight(quality));
  if (rejected) return rejected;
  if (!qualities.every((quality) => permitsUse(quality, fetchedAt))) return qualityFailure("stale", "staleFetch");
  if (!rows.every((row) => row.isFinal)) return qualityFailure("delayed", "notFinal");
  if (rows.length !== expected.length || rows.some((row, index) => row.observedAt !== expected[index])) {
    return qualityFailure("incomplete", "missingSession");
  }
  const last = rows[rows.length - 1];
  if (percentageChange(rows[0].price, last.price) === undefined) return qualityFailure("invalid", "invalidValue");
  return { status: "valid", reasons: [], observedAt: last.observedAt };
}

/**
 * Verifies daily close series against the calendar: one final, provenanced, current close per session,
 * nothing duplicated or missing. Transport order does not matter; conflicting copies are never merged.
 */
export function validateHistoricalSeries(input: HistoryInput): HistoryAssessment {
  const { period, generatedAt, fetchedAt, calendar, observations } = input;
  const freshness = input.freshness ?? DEFAULT_HISTORY_FRESHNESS;
  const requested = new Set([
    ...observations.map((row) => row.assetID),
    ...(input.watchlistIDs ?? []),
    ...(input.portfolioIDs ?? []),
  ]);
  const rejected = (report: DataQualityReport): HistoryAssessment => ({
    period: report,
    assets: new Map([...requested].map((id) => [id, report])),
    verified: new Map(),
    sessions: [],
  });
  const { maximumFetchAgeMs: fetchAge, maximumPeriodAgeMs: periodAge } = freshness;
  if (
    !Number.isFinite(generatedAt) ||
    !Number.isFinite(fetchedAt) ||
    fetchedAt > generatedAt ||
    !isValidPeriod(period) ||
    !(Number.isFinite(fetchAge) && fetchAge > 0 && Number.isFinite(periodAge) && periodAge > 0)
  ) {
    return rejected(qualityFailure("invalid", "invalidTimestamp"));
  }
  if (!(generatedAt - fetchedAt < fetchAge)) return rejected(qualityFailure("stale", "staleFetch"));
  if (!(generatedAt - period.endExclusive < periodAge)) return rejected(qualityFailure("stale", "stalePeriod"));
  const sessions = calendar?.sessions(period, generatedAt);
  if (!sessions) return rejected(qualityFailure("unknown", "unavailableCalendar"));
  const lastSession = sessions.at(-1);
  if (sessions.length < 2 || !lastSession || lastSession.closesAt > generatedAt) {
    return rejected(qualityFailure("incomplete", "incompletePeriod"));
  }
  const expected = sessions.map((session) => session.closesAt);
  const recordCounts = new Map<string, number>();
  for (const row of observations) {
    if (periodContains(period, row.observedAt)) recordCounts.set(row.recordID, (recordCounts.get(row.recordID) ?? 0) + 1);
  }
  const duplicateIDs = new Set([...recordCounts].filter(([, count]) => count > 1).map(([id]) => id));
  const assets = new Map<string, DataQualityReport>();
  const verified = new Map<string, readonly PriceObservation[]>();
  for (const id of [...requested].sort()) {
    const all = observations.filter((row) => row.assetID === id);
    if (!all.every((row) => Number.isFinite(row.observedAt))) {
      assets.set(id, qualityFailure("invalid", "invalidTimestamp"));
      continue;
    }
    const rows = all.filter((row) => periodContains(period, row.observedAt)).sort((a, b) => a.observedAt - b.observedAt);
    const report = validateRows(rows, id, expected, fetchedAt, duplicateIDs);
    assets.set(id, report);
    if (permitsInsight(report)) verified.set(id, rows);
  }
  return { period: VALID_QUALITY, assets, verified, sessions };
}
