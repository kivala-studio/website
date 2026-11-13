import Decimal from "decimal.js";

import type { DataQualityReport } from "../../market/quality";
import type { EpochMs } from "../../market/zone";
import type { PortfolioTransaction } from "../../portfolio/models";
import type { MarketEvent } from "../../week-ahead/week-ahead";
import type { FinancialFact, Insight, InsightDestination, InsightPriceObservation, PortfolioInsightEvidence } from "../models";

/*
 * Encodes evaluation values the way the iOS report does: Swift `Codable` shapes (enums with associated values as
 * `{"case":{"_0":…}}`), ISO-8601 dates without fractional seconds, exact decimals as JSON numbers, absent optionals
 * omitted and keys sorted. Test support for the evaluation export only.
 */

/** A JSON number written verbatim (an exact decimal). */
export class RawNumber {
  constructor(readonly text: string) {}
}

export type Json = null | boolean | number | string | RawNumber | Json[] | { [key: string]: Json };

export const number = (value: Decimal) => new RawNumber(value.toFixed());
export const date = (value: EpochMs) => new Date(Math.floor(value / 1000) * 1000).toISOString().replace(".000Z", "Z");

const DATE_KEYS = new Set([
  "start",
  "endExclusive",
  "observedAt",
  "collectedAt",
  "fetchedAt",
  "generatedAt",
  "expiresAt",
  "firstObservedAt",
  "lastObservedAt",
  "holdingsCutoff",
  "publishedAt",
  "ledgerFetchedAt",
  "metadataFetchedAt",
  "updatedAt",
  "retrievedAt",
  "firstDate",
  "lastDate",
  "createdAt",
]);

/** Plain records: decimals become numbers, known date keys become ISO dates, `undefined`/`null` keys are omitted. */
export function encodeValue(value: unknown, key = ""): Json | undefined {
  if (value === undefined || value === null) return undefined;
  if (value instanceof Decimal || (typeof value === "object" && value !== null && "toFixed" in value && "isNaN" in value)) return number(value as Decimal);
  if (typeof value === "number") return DATE_KEYS.has(key) ? date(value) : value;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (value instanceof Set) return [...value].map((item) => encodeValue(item) ?? null);
  if (value instanceof Map) return Object.fromEntries([...value.entries()].map(([k, v]) => [String(k), encodeValue(v, String(k)) ?? null]));
  if (Array.isArray(value)) return value.map((item) => encodeValue(item, key) ?? null);
  const result: Record<string, Json> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const encoded = encodeValue(v, k);
    if (encoded !== undefined) result[k] = encoded;
  }
  return result;
}

export const enumCase = (name: string, payload?: Json): Json => ({ [name]: payload === undefined ? {} : { _0: payload } });

export function encodeQuality(report: DataQualityReport): Json {
  return encodeValue({
    status: report.status,
    reasons: [...report.reasons],
    observedAt: report.observedAt,
    validUntilEpoch: report.validUntilEpoch,
    sourceObservedAtEpoch: report.sourceObservedAtEpoch,
  })!;
}

export function encodeObservation(row: InsightPriceObservation): Json {
  return {
    assetID: row.assetID,
    collectedAt: date(row.collectedAt),
    currencyCode: row.currencyCode,
    ...(row.dataQuality ? { dataQuality: encodeQuality(row.dataQuality) } : {}),
    isFinal: row.isFinal,
    observedAt: date(row.observedAt),
    price: number(row.price),
    recordID: row.recordID,
    source: encodeValue(row.source)!,
  };
}

/** Swift stores `tradedOn` as the Luanda noon of the civil day. */
const civilNoon = (day: string) => date(Date.parse(`${day}T12:00:00+01:00`));

export function encodeTransaction(tx: PortfolioTransaction): Json {
  return {
    createdAt: date(Date.parse(tx.createdAt)),
    fees: number(tx.fees),
    id: tx.id,
    kind: tx.kind,
    ...(tx.portfolioId ? { portfolioID: tx.portfolioId } : {}),
    quantity: number(tx.quantity),
    securityID: tx.securityId,
    tradedOn: civilNoon(tx.tradedOn),
    unitPrice: number(tx.unitPrice),
  };
}

export function encodePortfolioEvidence(evidence: PortfolioInsightEvidence): Json {
  return {
    ledgerFetchedAt: date(evidence.ledgerFetchedAt),
    metadataFetchedAt: date(evidence.metadataFetchedAt),
    securities: evidence.securities.map((security) =>
      encodeValue({ ...security, allowsFractionalQuantity: security.allowsFractionalQuantity ?? false }),
    ) as Json[],
    transactions: evidence.transactions.map(encodeTransaction),
    week: encodeValue(evidence.week)!,
  };
}

export function encodeDestination(destination: InsightDestination): Json {
  switch (destination.kind) {
    case "asset":
      return enumCase("asset", destination.assetID);
    case "information":
      return enumCase("information", destination.articleID);
    default:
      return enumCase(destination.kind);
  }
}

export function encodeFact(fact: FinancialFact): Json {
  return enumCase(fact.kind, encodeValue(fact.value));
}

export function encodeInsight(insight: Insight): Json {
  const { provenance } = insight;
  return {
    category: insight.category,
    destination: encodeDestination(insight.destination),
    expiresAt: date(insight.expiresAt),
    fact: encodeFact(insight.fact),
    generatedAt: date(insight.generatedAt),
    id: insight.id,
    period: encodeValue(insight.period)!,
    provenance: {
      calculationID: provenance.calculationID,
      calculationVersion: provenance.calculationVersion,
      calendarVersion: provenance.calendarVersion,
      completeness: provenance.completeness,
      fetchedAt: date(provenance.fetchedAt),
      observations: provenance.observations.map(encodeObservation),
      ...(provenance.portfolio ? { portfolio: encodePortfolioEvidence(provenance.portfolio) } : {}),
      ...(provenance.publication ? { publication: encodeValue(provenance.publication)! } : {}),
    },
    relatedAssetIDs: [...insight.relatedAssetIDs],
    relevance: encodeValue(insight.relevance)!,
    ...(insight.serverNotificationID ? { serverNotificationID: insight.serverNotificationID } : {}),
    type: insight.type,
    ...(insight.voiceComposition ? { voiceComposition: encodeValue(insight.voiceComposition)! } : {}),
  };
}

export function encodeEvent(event: MarketEvent): Json {
  const timing = event.timing;
  let encodedTiming: Json;
  switch (timing.kind) {
    case "day":
      encodedTiming = enumCase("day", timing.day);
      break;
    case "instant":
      encodedTiming = enumCase("instant", date(timing.at));
      break;
    case "days":
      encodedTiming = { days: { _0: timing.start, _1: timing.endInclusive } };
      break;
    case "interval":
      encodedTiming = { interval: { _0: date(timing.start), _1: date(timing.endExclusive) } };
      break;
  }
  return {
    id: event.id,
    importance: event.importance,
    ...(event.issuer ? { issuer: { id: event.issuer.id, name: event.issuer.name } } : {}),
    kind: event.kind,
    ...(event.metadata ? { metadata: { dividend: { fiscalYear: event.metadata.fiscalYear, milestone: event.metadata.milestone } } } : {}),
    relatedSecurityIDs: [...event.relatedSecurityIDs],
    sources: event.sources.map((source) => ({
      dataset: source.dataset,
      name: source.name,
      ...(source.publishedAt
        ? { publishedAt: source.publishedAt.kind === "day" ? enumCase("day", source.publishedAt.day) : enumCase("instant", date(source.publishedAt.at)) }
        : {}),
      recordID: source.recordID,
      retrievedAt: date(source.retrievedAt),
      url: source.url,
    })),
    status: event.status,
    timing: encodedTiming,
    title: event.title,
    updatedAt: date(event.updatedAt),
  };
}

const byKey = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Sorted keys, two-space indentation, slashes unescaped (Swift `.prettyPrinted, .sortedKeys, .withoutEscapingSlashes`). */
export function stringify(value: Json, indent = ""): string {
  if (value === null) return "null";
  if (value instanceof RawNumber) return value.text;
  if (typeof value === "number") return JSON.stringify(value);
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `[\n${value.map((item) => inner + stringify(item, inner)).join(",\n")}\n${indent}]`;
  }
  const keys = Object.keys(value).sort(byKey);
  if (keys.length === 0) return "{}";
  return `{\n${keys.map((key) => `${inner}${JSON.stringify(key)} : ${stringify(value[key], inner)}`).join(",\n")}\n${indent}}`;
}

/** Compact sorted-key form, the trace ordering key (Swift `JSONSerialization` with `.sortedKeys`). */
export function compact(value: Json): string {
  if (value === null) return "null";
  if (value instanceof RawNumber) return value.text;
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(compact).join(",")}]`;
  return `{${Object.keys(value)
    .sort(byKey)
    .map((key) => `${JSON.stringify(key)}:${compact(value[key])}`)
    .join(",")}}`;
}
