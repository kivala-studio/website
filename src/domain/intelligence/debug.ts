import type Decimal from "decimal.js";

import type { DataQualityReport } from "../market/quality";
import { type EpochMs } from "../market/zone";
import { SIGNIFICANCE, interpret } from "./math";
import type { InformationSignificance, Insight, InsightPeriod } from "./models";
import { sha256Hex } from "./sha256";

/*
 * iOS `IntelligenceDebugCapture`, `IntelligenceDebugRun` and `IntelligenceDebugDecision` (DEBUG builds). Disabled
 * by default and bounded; captures are process-local developer diagnostics, never analytics, never persisted.
 * Identities appear only as salted tokens.
 */

export type DebugContext =
  "generation" | "home" | "portfolio" | "watchlist" | "saturdayDiscover" | "weeklyWrap" | "activityCenter" | "notification" | "weekAhead";
export type DebugStage = "GENERATED" | "REJECTED" | "RANKED" | "SUPPRESSED" | "OBSERVED";

export interface DebugScore {
  readonly baseRelevance: number;
  readonly significance: number;
  readonly marketImportance: number;
  readonly portfolioRelationship: number;
  readonly watchlistRelationship: number;
  readonly alertRelationship: number;
  readonly behavioralInterest: number;
  readonly freshness: number;
  readonly novelty: number;
  readonly repetitionPenalty: number;
  readonly feedbackAdjustment: number;
  readonly noveltyReason: string;
  /** Diversity is a selection gate, not an arithmetic adjustment in this engine. */
  readonly diversity: string;
  readonly finalScore: number;
  readonly minimumScore: number;
  readonly mandatory: boolean;
}

export interface DebugProvenance {
  readonly calculation: string;
  readonly version: number;
  readonly calendar: string;
  readonly observationCount: number;
  readonly sourceTokens: readonly string[];
  readonly sourceTokensOmitted: number;
  readonly fetchedAt: EpochMs;
}

export interface DebugDecision {
  readonly id: string;
  readonly stage: DebugStage;
  readonly subject: string;
  readonly reason: string;
  readonly token?: string;
  readonly generator?: string;
  readonly requiredData?: readonly string[];
  readonly missingData?: readonly string[];
  readonly validation?: DataQualityReport;
  readonly period?: InsightPeriod;
  readonly significance?: InformationSignificance;
  readonly significanceRule?: string;
  readonly measuredPercentage?: Decimal;
  readonly threshold?: Decimal;
  readonly privateMeasurementRedacted?: boolean;
  readonly provenance?: DebugProvenance;
  readonly score?: DebugScore;
  readonly rank?: number;
  readonly selectedPosition?: number;
  readonly observedAt?: EpochMs;
  readonly familyTiePriority?: number;
  readonly identityOrder?: number;
}

export type DebugDecisionInput = Omit<DebugDecision, "id">;

export interface DebugSnapshot {
  readonly id: string;
  readonly context: DebugContext;
  readonly layer: string;
  readonly asOf: EpochMs | null;
  readonly cacheHit: boolean;
  readonly decisions: readonly DebugDecision[];
  readonly omittedDecisions: number;
}

const uuid = () => globalThis.crypto.randomUUID();

export const DEBUG_MAXIMUM_RUNS = 16;
export const DEBUG_MAXIMUM_DECISIONS = 300;

export class IntelligenceDebugCapture {
  static readonly shared = new IntelligenceDebugCapture();

  private enabled = false;
  private epoch = uuid();
  private salt = uuid();
  private stored: DebugSnapshot[] = [];

  get isEnabled(): boolean {
    return this.enabled;
  }

  snapshots(): readonly DebugSnapshot[] {
    return this.stored;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.epoch = uuid();
  }

  clear(disable = false): void {
    this.stored = [];
    this.epoch = uuid();
    this.salt = uuid();
    if (disable) this.enabled = false;
  }

  begin(context: DebugContext, layer: string, asOf: EpochMs, cacheHit = false): IntelligenceDebugRun | null {
    if (!this.enabled) return null;
    return new IntelligenceDebugRun(
      (snapshot, epoch) => this.commit(snapshot, epoch),
      this.epoch,
      this.salt,
      context,
      layer,
      Number.isFinite(asOf) ? asOf : null,
      cacheHit,
    );
  }

  private commit(snapshot: DebugSnapshot, epoch: string): void {
    if (!this.enabled || this.epoch !== epoch) return;
    this.stored = [snapshot, ...this.stored].slice(0, DEBUG_MAXIMUM_RUNS);
  }
}

/** Contains only redacted scalar explanations, never the input snapshot or a financial payload. */
export class IntelligenceDebugRun {
  private readonly id = uuid();
  private readonly decisions: DebugDecision[] = [];
  private omitted = 0;

  constructor(
    private readonly commit: (snapshot: DebugSnapshot, epoch: string) => void,
    private readonly epoch: string,
    private readonly salt: string,
    private readonly context: DebugContext,
    private readonly layer: string,
    private readonly asOf: EpochMs | null,
    private readonly cacheHit: boolean,
  ) {}

  token(value: string): string {
    return sha256Hex(`${this.salt.toUpperCase()}:${value}`);
  }

  append(decision: DebugDecisionInput): void {
    if (this.decisions.length < DEBUG_MAXIMUM_DECISIONS) this.decisions.push({ id: uuid(), ...decision });
    else this.omitted += 1;
  }

  note(subject: string, stage: DebugStage, reason: string, options: { id?: string; metric?: Decimal; threshold?: Decimal } = {}): void {
    this.append({
      stage,
      subject,
      reason,
      ...(options.id === undefined ? {} : { token: this.token(options.id) }),
      ...(options.metric === undefined ? {} : { measuredPercentage: options.metric }),
      ...(options.threshold === undefined ? {} : { threshold: options.threshold }),
    });
  }

  generated(insight: Insight, generator: string, requirements: Iterable<string>): void {
    const sourceTokens = [...new Set(insight.provenance.observations.map((row) => this.token(row.recordID)))].sort();
    const privateFact = insight.category === "portfolio";
    const interpretation = interpret(insight.fact);
    let rule: string;
    switch (insight.fact.kind) {
      case "watchlistInformation":
        rule = "published-information: fixed noteworthy";
        break;
      case "breadth":
        rule = "verified-breadth: fixed significant";
        break;
      case "portfolioAllocation":
        rule = `largest allocation >= ${SIGNIFICANCE.concentrationDisclosure.toString()}%: significant; otherwise routine (measurement redacted)`;
        break;
      default:
        rule = `absolute movement: noteworthy >= ${SIGNIFICANCE.noteworthyMovement.toString()}%, significant >= ${SIGNIFICANCE.significantMovement.toString()}%, material >= ${SIGNIFICANCE.materialMovement.toString()}%; otherwise routine`;
    }
    this.append({
      stage: "GENERATED",
      subject: insight.type,
      reason: "generator-emitted",
      token: this.token(insight.id),
      generator,
      requiredData: [...requirements].sort(),
      period: insight.period,
      significance: interpretation.significance,
      significanceRule: rule,
      ...(privateFact || interpretation.movementPercentage === null ? {} : { measuredPercentage: interpretation.movementPercentage }),
      privateMeasurementRedacted: privateFact,
      provenance: {
        calculation: insight.provenance.calculationID,
        version: insight.provenance.calculationVersion,
        calendar: insight.provenance.calendarVersion,
        observationCount: insight.provenance.observations.length,
        sourceTokens: sourceTokens.slice(0, 20),
        sourceTokensOmitted: Math.max(0, sourceTokens.length - 20),
        fetchedAt: insight.provenance.fetchedAt,
      },
    });
  }

  finish(): void {
    this.commit(
      {
        id: this.id,
        context: this.context,
        layer: this.layer,
        asOf: this.asOf,
        cacheHit: this.cacheHit,
        decisions: [...this.decisions],
        omittedDecisions: this.omitted,
      },
      this.epoch,
    );
  }
}
