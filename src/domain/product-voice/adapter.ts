import Decimal from "decimal.js";

import type { Format, Translate } from "../format";
import { interpret } from "../intelligence/math";
import type { FinancialFact, Insight } from "../intelligence/models";
import type { LocalProductVoice } from "./local-voice";
import { type VoiceComposition, type VoiceContext, voiceHash, voiceMood } from "./voice";

/*
 * iOS `InsightVoiceAdapter`: presentation only. Qualification and calculations stay with the engine; this maps a
 * verified insight to a voice context and composes it through the account's recent-choice memory.
 */

const SECOND_MS = 1000;
/** Foundation's reference date (2001-01-01T00:00:00Z) in Unix seconds: dates in the revision evidence count from it. */
const REFERENCE_DATE_S = 978_307_200;

/** Sorted-key JSON of a fact, the shape Swift's `JSONEncoder` gives an enum case: decimals as numbers, dates as reference seconds. */
function encodeEvidence(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Decimal.isDecimal(value)) return value.toString();
  if (Array.isArray(value)) return `[${value.map(encodeEvidence).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined && item !== null)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${encodeEvidence(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

const DATE_FIELDS = new Set(["firstObservedAt", "lastObservedAt", "publishedAt", "observedAt", "holdingsCutoff"]);

function withReferenceDates(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withReferenceDates);
  if (value === null || typeof value !== "object" || Decimal.isDecimal(value)) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      DATE_FIELDS.has(key) && typeof item === "number" ? item / SECOND_MS - REFERENCE_DATE_S : withReferenceDates(item),
    ]),
  );
}

const factEvidence = (fact: FinancialFact) => encodeEvidence({ [fact.kind]: { _0: withReferenceDates(fact.value) } });

const LEVELS = { routine: "routine", noteworthy: "notable", significant: "significant", material: "exceptional", critical: "exceptional" } as const;

export interface InsightVoiceOptions {
  /** Symbol per asset id. */
  readonly symbols: Readonly<Record<string, string>>;
  readonly surface: string;
  readonly format: Format;
  readonly t: Translate;
}

/** Portfolio facts have no voice: they return null and keep their tile copy. */
export function insightVoiceContext(insight: Insight, { symbols, surface, format, t }: InsightVoiceOptions): VoiceContext | null {
  const interpretation = interpret(insight.fact);
  const movement = interpretation.movementPercentage;
  const direction = movement === null ? "neutral" : movement.greaterThan(0) ? "up" : movement.lessThan(0) ? "down" : "neutral";
  const level = LEVELS[interpretation.significance];
  const facts: Record<string, string> = {};
  const asset = (id: string) => {
    facts.symbol = symbols[id] ?? t("common.watchedSecurity");
    facts.issuer = facts.symbol;
  };
  facts.referencePeriod = format.period(insight.period.start, insight.period.endExclusive - SECOND_MS);
  if (movement !== null) facts.signedPercentage = format.number(movement, { digits: 1, signed: true });
  let family: string;
  let capabilities: string[];
  const { fact } = insight;
  switch (fact.kind) {
    case "priceChange":
      family = "movement";
      capabilities = ["movement"];
      asset(fact.value.assetID);
      facts.comparisonLabel = `entre os fechos verificados de ${format.period(fact.value.firstObservedAt, fact.value.lastObservedAt)}`;
      break;
    case "watchlistMovement":
      family = "watchlist_rank";
      capabilities = ["complete_watchlist"];
      asset(fact.value.movement.assetID);
      facts.referencePeriod = format.period(fact.value.movement.firstObservedAt, fact.value.movement.lastObservedAt);
      break;
    case "breadth":
      family = "watchlist_breadth";
      capabilities = ["complete_watchlist"];
      facts.rising = String(fact.value.rising);
      facts.falling = String(fact.value.falling);
      facts.unchanged = String(fact.value.unchanged);
      break;
    case "watchlistSessionRun":
      family = "watchlist_run";
      capabilities = ["verified_run"];
      asset(fact.value.assetID);
      facts.sessions = String(fact.value.sessions);
      facts.directionLabel = fact.value.direction > 0 ? "subida" : "descida";
      facts.referencePeriod = format.period(fact.value.firstObservedAt, fact.value.lastObservedAt);
      break;
    case "watchlistClosingExtreme":
      family = "watchlist_extreme";
      capabilities = ["period_extreme"];
      asset(fact.value.assetID);
      facts.extremeLabel = fact.value.isHigh ? "máximo" : "mínimo";
      facts.referencePeriod = format.period(fact.value.firstObservedAt, fact.value.lastObservedAt);
      break;
    case "watchlistInformation":
      family = "publication";
      capabilities = ["verified_publication"];
      facts.publicationTitle = fact.value.title;
      if (fact.value.assetIDs[0] !== undefined) asset(fact.value.assetIDs[0]);
      break;
    default:
      return null;
  }
  // The revision changes when any frozen measurement or source identity changes.
  const sortedFacts = Object.fromEntries(Object.entries(facts).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  const revision = voiceHash(`${factEvidence(fact)}|${JSON.stringify(sortedFacts)}|${level}|${direction}`);
  return {
    eventFamily: family,
    surface,
    sourceKey: insight.id,
    sourceRevision: revision,
    significance: level,
    direction,
    mood: voiceMood(family, direction, level),
    privacyClass: insight.category === "watchlist" ? "personal_context" : "public_market",
    verifiedFacts: facts,
    capabilities,
  };
}

/** The stored (Portuguese) composition, or null when only the generic fallback fits. */
export function insightComposition(insight: Insight, voice: LocalProductVoice, options: InsightVoiceOptions, now?: number): VoiceComposition | null {
  const context = insightVoiceContext(insight, options);
  if (!context) return null;
  const result = voice.compose(context, now);
  return result.strategyId === "fallback" ? null : result;
}
