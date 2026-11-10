import Decimal from "decimal.js";

import type { PricePoint } from "./models";
import { type EpochMs, SECOND_MS, startOfDay } from "./zone";

export const QUALITY_STATUSES = ["valid", "incomplete", "stale", "delayed", "invalid", "unknown"] as const;
export type QualityStatus = (typeof QUALITY_STATUSES)[number];

export const QUALITY_REASONS = [
  "missingObservation",
  "missingSession",
  "duplicateObservation",
  "invalidValue",
  "invalidTimestamp",
  "missingProvenance",
  "inconsistentCurrency",
  "notFinal",
  "incompletePeriod",
  "unavailableCalendar",
  "staleFetch",
  "stalePeriod",
  "staleObservation",
  "delayedIngestion",
  "missingMetadata",
  "invalidLedger",
] as const;
export type QualityReason = (typeof QUALITY_REASONS)[number];

/** Evidence about suitability, never a probability or a confidence score. */
export interface DataQualityReport {
  readonly status: QualityStatus;
  readonly reasons: readonly QualityReason[];
  /** Local assessment day or instant; never sent by the server. */
  readonly observedAt?: EpochMs;
  /** Seconds. The value stops being current at this instant. */
  readonly validUntilEpoch?: number;
  /** Seconds. */
  readonly sourceObservedAtEpoch?: number;
}

export const VALID_QUALITY: DataQualityReport = { status: "valid", reasons: [] };

export const qualityFailure = (status: QualityStatus, ...reasons: QualityReason[]): DataQualityReport => ({
  status,
  reasons,
});

export const permitsInsight = (report: DataQualityReport) => report.status === "valid" && report.reasons.length === 0;

/** Keep the evidence timestamps and deadline when presentation eligibility ends. */
export function invalidated(report: DataQualityReport, status: QualityStatus, reason: QualityReason): DataQualityReport {
  if (!permitsInsight(report)) return report;
  return { ...report, status, reasons: [reason] };
}

export function permitsUse(report: DataQualityReport, now: EpochMs): boolean {
  const seconds = now / SECOND_MS;
  const { observedAt, sourceObservedAtEpoch, validUntilEpoch } = report;
  return (
    permitsInsight(report) &&
    Number.isFinite(now) &&
    (observedAt === undefined || (Number.isFinite(observedAt) && observedAt <= now)) &&
    (sourceObservedAtEpoch === undefined || (Number.isFinite(sourceObservedAtEpoch) && sourceObservedAtEpoch <= seconds)) &&
    (validUntilEpoch === undefined || (Number.isFinite(validUntilEpoch) && seconds < validUntilEpoch))
  );
}

/** Current prices, totals and books share the source's two-minute observation ceiling. */
export function permitsCurrentUse(report: DataQualityReport, now: EpochMs, requiresSourceObservation = true): boolean {
  const { validUntilEpoch, sourceObservedAtEpoch } = report;
  if (!permitsUse(report, now) || validUntilEpoch === undefined || !Number.isFinite(validUntilEpoch)) return false;
  if (!requiresSourceObservation) return true;
  if (sourceObservedAtEpoch === undefined) return false;
  return validUntilEpoch <= sourceObservedAtEpoch + 120;
}

const positive = (value: Decimal | undefined) => value !== undefined && value.isFinite() && value.gt(0);

/** Validates a reported price without inventing a maximum price or assuming daily liquidity. */
export function validateReportedPrice(input: {
  price?: Decimal;
  /** Trading day, anchored at Luanda noon. */
  tradingDate?: EpochMs;
  now: EpochMs;
  sourceQuality?: DataQualityReport;
}): DataQualityReport {
  const { price, tradingDate, now, sourceQuality } = input;
  if (price === undefined) return qualityFailure("incomplete", "missingObservation");
  if (!positive(price)) return qualityFailure("invalid", "invalidValue");
  if (
    !Number.isFinite(now) ||
    tradingDate === undefined ||
    !Number.isFinite(tradingDate) ||
    startOfDay(tradingDate) > startOfDay(now)
  ) {
    return qualityFailure("unknown", "invalidTimestamp");
  }
  if (sourceQuality === undefined) return qualityFailure("unknown", "missingProvenance");
  // The day, not the noon anchor, so a source observation before noon is not rejected.
  const observedAt = startOfDay(tradingDate);
  if (permitsInsight(sourceQuality) && !permitsUse(sourceQuality, now)) {
    return { ...invalidated(sourceQuality, "stale", "staleFetch"), observedAt };
  }
  return {
    status: sourceQuality.status,
    reasons: sourceQuality.reasons,
    observedAt,
    validUntilEpoch: sourceQuality.validUntilEpoch,
    sourceObservedAtEpoch: sourceQuality.sourceObservedAtEpoch,
  };
}

function coherent(point: PricePoint): boolean {
  const { value, openValue, highValue, lowValue, volume, tradeCount } = point;
  if (!Number.isFinite(point.date) || !positive(value)) return false;
  if (![openValue, highValue, lowValue].every((item) => item === undefined || positive(item))) return false;
  if (volume !== undefined && !(volume.isFinite() && volume.gte(0))) return false;
  if (tradeCount !== undefined && tradeCount < 0) return false;
  const open = openValue ?? value;
  if (highValue !== undefined && highValue.lt(Decimal.max(value, open, lowValue ?? value))) return false;
  if (lowValue !== undefined && lowValue.gt(Decimal.min(value, open, highValue ?? value))) return false;
  return true;
}

/** Chart points are accepted only as a whole: duplicates or malformed candles reject the series. */
export function validateChart(points: readonly PricePoint[]): { points: PricePoint[]; quality: DataQualityReport } {
  if (points.length === 0) return { points: [], quality: qualityFailure("incomplete", "missingObservation") };
  if (new Set(points.map((point) => point.date)).size !== points.length) {
    return { points: [], quality: qualityFailure("invalid", "duplicateObservation") };
  }
  if (!points.every(coherent)) return { points: [], quality: qualityFailure("invalid", "invalidValue") };
  return { points: [...points].sort((a, b) => a.date - b.date), quality: VALID_QUALITY };
}

/** Keep a valid reported close when the optional candle fields are incoherent. */
export function reportedClose(point: PricePoint): PricePoint | undefined {
  const closeOnly: PricePoint = { date: point.date, value: point.value };
  if (!permitsInsight(validateChart([closeOnly]).quality)) return undefined;
  return permitsInsight(validateChart([point]).quality) ? point : closeOnly;
}
