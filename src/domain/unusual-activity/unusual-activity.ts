import Decimal from "decimal.js";

import { type UnusualRule, isUnusualRule } from "@/domain/activity/preferences";
import { type EpochMs, dayStart, parseInstant } from "@/domain/market/zone";

/*
 * Unusual activity (contract §3.10, iOS `UnusualActivityModels` and `UnusualActivityStore.groups`). The server
 * computes every threshold; the client only renders observed values against their baseline.
 */

/** A flat fact stored with each event: a number, text, a flag or the digest's symbol list. */
export type FactValue = Decimal | string | boolean | readonly string[];
export type UnusualFacts = ReadonlyMap<string, FactValue>;

export interface UnusualEvent {
  readonly id: string;
  readonly securityID: string;
  readonly symbol: string;
  readonly name: string;
  /** Session day, `YYYY-MM-DD` in Luanda. */
  readonly tradingDate: string;
  readonly rule: UnusualRule;
  readonly observedValue: Decimal;
  readonly baselineValue: Decimal;
  readonly occurredAt: EpochMs;
  readonly isWithdrawn: boolean;
  readonly facts: UnusualFacts;
}

export interface UnusualGroup {
  readonly securityID: string;
  readonly symbol: string;
  readonly name: string;
  /** Strongest first. */
  readonly events: readonly UnusualEvent[];
  readonly isFollowed: boolean;
  readonly isShare: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function decimal(value: unknown): Decimal | undefined {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  try {
    const parsed = new Decimal(value);
    return parsed.isFinite() ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function decodeFacts(value: unknown): UnusualFacts {
  const facts = new Map<string, FactValue>();
  if (!isRecord(value)) return facts;
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "boolean" || typeof entry === "string") facts.set(key, entry);
    else if (typeof entry === "number") {
      const number = decimal(entry);
      if (number) facts.set(key, number);
    } else if (Array.isArray(entry) && entry.every((item) => typeof item === "string")) facts.set(key, entry);
  }
  return facts;
}

/** A number fact; numeric text counts too (the server sends some prices as text). */
export function factNumber(facts: UnusualFacts, key: string): Decimal | undefined {
  const value = facts.get(key);
  if (value instanceof Decimal) return value;
  return typeof value === "string" ? decimal(value) : undefined;
}

export function factText(facts: UnusualFacts, key: string): string | undefined {
  const value = facts.get(key);
  return typeof value === "string" ? value : undefined;
}

export function factSymbols(facts: UnusualFacts): readonly string[] {
  const value = facts.get("symbols");
  return Array.isArray(value) ? value : [];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One `get_unusual_activity` row; unknown future rules and malformed rows are skipped, never half-rendered. */
export function decodeUnusualEvent(row: unknown): UnusualEvent | null {
  if (!isRecord(row)) return null;
  const { id, security_id: securityID, symbol, name, trading_date: tradingDate, rule, observed_value, baseline_value, occurred_at, status } = row;
  if (typeof id !== "string" || !UUID.test(id) || typeof securityID !== "string" || !UUID.test(securityID)) return null;
  if (typeof symbol !== "string" || !isUnusualRule(rule) || typeof tradingDate !== "string" || dayStart(tradingDate) === undefined) return null;
  const occurredAt = typeof occurred_at === "string" ? parseInstant(occurred_at) : undefined;
  const observedValue = decimal(observed_value);
  const baselineValue = decimal(baseline_value);
  if (occurredAt === undefined || !observedValue || !baselineValue) return null;
  return {
    id: id.toLowerCase(),
    securityID: securityID.toLowerCase(),
    symbol,
    name: typeof name === "string" && name !== "" ? name : symbol,
    tradingDate,
    rule,
    observedValue,
    baselineValue,
    occurredAt,
    isWithdrawn: status === "withdrawn",
    facts: decodeFacts(row.facts),
  };
}

export const decodeUnusualEvents = (rows: unknown): UnusualEvent[] =>
  Array.isArray(rows) ? rows.map(decodeUnusualEvent).filter((event): event is UnusualEvent => event !== null) : [];

/** Intraday trades and orders first, then the precedence the pushes use. */
const PRIORITY: Record<UnusualRule, number> = {
  large_trade: 0,
  large_order: 1,
  price_move: 2,
  dormancy_break: 3,
  volume_spike: 4,
  trade_count_spike: 5,
  book_imbalance: 6,
  spread_change: 7,
  spread_shift: 7,
};

const strength = (event: UnusualEvent) =>
  factNumber(event.facts, "ratio") ?? factNumber(event.facts, "zScore") ?? factNumber(event.facts, "dormantSessions") ?? new Decimal(0);

/** Negative when `a` is the stronger signal. */
export function compareStrength(a: UnusualEvent, b: UnusualEvent): number {
  if (PRIORITY[a.rule] !== PRIORITY[b.rule]) return PRIORITY[a.rule] - PRIORITY[b.rule];
  const order = strength(b).comparedTo(strength(a));
  if (order !== 0) return order;
  if (a.occurredAt !== b.occurredAt) return b.occurredAt - a.occurredAt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * One entry per security: followed first, then shares, then by the strongest signal, then symbol. A narrower
 * spread is calm rather than news, so it is left out.
 */
export function unusualGroups(events: readonly UnusualEvent[], followed: ReadonlySet<string>): UnusualGroup[] {
  const bySecurity = new Map<string, UnusualEvent[]>();
  for (const event of events) {
    if (event.rule === "spread_change" && factText(event.facts, "direction") === "narrower") continue;
    bySecurity.set(event.securityID, [...(bySecurity.get(event.securityID) ?? []), event]);
  }
  const groups = [...bySecurity].map(([securityID, list]): UnusualGroup => {
    const sorted = [...list].sort(compareStrength);
    const [first] = sorted;
    return {
      securityID,
      symbol: first.symbol,
      name: first.name,
      events: sorted,
      isFollowed: followed.has(securityID),
      isShare: factText(first.facts, "securityKind") === "share",
    };
  });
  return groups.sort((a, b) => {
    if (a.isFollowed !== b.isFollowed) return a.isFollowed ? -1 : 1;
    if (a.isShare !== b.isShare) return a.isShare ? -1 : 1;
    const order = compareStrength(a.events[0], b.events[0]);
    if (order !== 0) return order;
    return a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0;
  });
}
