import type { InsightType } from "./models";

/*
 * iOS `IntelligenceObservability`: fixed dimensions and aggregate counts only. No payload, identifier, error text
 * or financial value can enter this API, and nothing here is sent to analytics: events reach only a sink a
 * developer installs (tests, local diagnostics).
 */

export type IntelligenceMetric =
  | "validationAssets"
  | "generatorAdmission"
  | "insights"
  | "ranking"
  | "wrapLoad"
  | "snapshotWrite"
  | "activityEligibility"
  | "activityPersistence"
  | "weekAheadFetch"
  | "weekAheadSelection"
  | "featureConfiguration"
  | "featureFallback";

export type IntelligenceOutcome =
  "attempted" | "succeeded" | "insufficientData" | "failed" | "cancelled" | "cached" | "rejected" | "stale" | "eligible" | "suppressed";

export interface IntelligenceHealthEvent {
  readonly schemaVersion: 1;
  readonly metric: IntelligenceMetric;
  readonly outcome: IntelligenceOutcome;
  readonly count: number;
  readonly total: number;
  readonly insightType: InsightType | null;
  readonly wrapKind: string | null;
}

export interface MetricOptions {
  readonly count?: number;
  readonly total?: number;
  readonly insightType?: InsightType;
  readonly wrapKind?: string;
}

export function makeHealthEvent(metric: IntelligenceMetric, outcome: IntelligenceOutcome, options: MetricOptions = {}): IntelligenceHealthEvent {
  return {
    schemaVersion: 1,
    metric,
    outcome,
    count: Math.max(0, options.count ?? 1),
    total: Math.max(0, options.total ?? 1),
    insightType: options.insightType ?? null,
    wrapKind: options.wrapKind ?? null,
  };
}

let sink: ((event: IntelligenceHealthEvent) => void) | null = null;

/** Installs (or removes, with null) the only receiver of health events. */
export function setIntelligenceHealthSink(next: ((event: IntelligenceHealthEvent) => void) | null): void {
  sink = next;
}

export function recordIntelligenceMetric(metric: IntelligenceMetric, outcome: IntelligenceOutcome, options: MetricOptions = {}): void {
  sink?.(makeHealthEvent(metric, outcome, options));
}
