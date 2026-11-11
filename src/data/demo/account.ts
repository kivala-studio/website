import "server-only";

import { cookies } from "next/headers";

import { publicEnv } from "@/config/public-env";
import { demoHistoryRows } from "@/data/market/demo/public-demo";
import { DEFAULT_DEMO_SCENARIO, DEMO_SCENARIO_COOKIE, type DemoScenario, isDemoScenario, recordedSnapshot } from "@/data/market/demo/scenarios";
import type { SubscriptionAccess } from "@/domain/account/access";
import { civilDate } from "@/domain/market/zone";

import { DEMO_ACCOUNT_COOKIE, DEMO_COOKIES, type DemoTier, isDemoTier } from "./tiers";

export { DEMO_ACCOUNT_COOKIE, type DemoTier } from "./tiers";

/*
 * Demo mode only (no backend): a signed-in account chosen by the `demo-account` cookie (`free`, `plus`, `pro`),
 * so signed-in pages can be exercised offline and in Playwright. Its account data lives in cookies of the
 * same browser. Nothing here exists outside `NEXT_PUBLIC_DATA_MODE=demo`; the cookie means nothing elsewhere.
 */
const [, WATCHLIST_COOKIE, PAIR_COOKIE] = DEMO_COOKIES;

export interface DemoAccount {
  readonly id: string;
  readonly tier: DemoTier;
}

const IDS: Record<DemoTier, string> = {
  free: "d5e00000-0000-4000-8000-000000000001",
  plus: "d5e00000-0000-4000-8000-000000000002",
  pro: "d5e00000-0000-4000-8000-000000000003",
};

const COOKIE_OPTIONS = { path: "/", sameSite: "lax", httpOnly: true, maxAge: 60 * 60 * 24 } as const;
const UUID = /^[0-9a-f-]{36}$/i;

/** The demo account of this request, or null (always null outside demo mode). */
export async function demoAccount(): Promise<DemoAccount | null> {
  if (publicEnv.dataMode !== "demo") return null;
  const tier = (await cookies()).get(DEMO_ACCOUNT_COOKIE)?.value;
  return isDemoTier(tier) ? { id: IDS[tier], tier } : null;
}

export async function demoScenario(): Promise<DemoScenario> {
  const value = (await cookies()).get(DEMO_SCENARIO_COOKIE)?.value;
  return isDemoScenario(value) ? value : DEFAULT_DEMO_SCENARIO;
}

/** Priced equities of the recording, by symbol: the default list starts with four of them (one past the Free limit). */
const PRICED = recordedSnapshot.quotes.prices
  .map((row) => recordedSnapshot.securities.find((security) => security.id === row.security_id))
  .filter((security): security is (typeof recordedSnapshot.securities)[number] => security?.security_type === "stock")
  .sort((a, b) => a.symbol.localeCompare(b.symbol))
  .map((security) => security.id);

export async function demoWatchlist(): Promise<string[]> {
  const value = (await cookies()).get(WATCHLIST_COOKIE)?.value;
  if (value === undefined) return PRICED.slice(0, 4);
  return value.split(".").filter((id) => UUID.test(id));
}

export async function saveDemoWatchlist(ids: readonly string[]): Promise<void> {
  (await cookies()).set(WATCHLIST_COOKIE, ids.join("."), COOKIE_OPTIONS);
}

export function demoAccess(account: DemoAccount, watchlist: readonly string[], pair: readonly string[] | null): SubscriptionAccess {
  return {
    isPlus: account.tier !== "free",
    isPro: account.tier === "pro",
    enforcementEnabled: true,
    weekStart: null,
    resetsAt: null,
    comparisonPair: pair,
    activeWatchlistIDs: watchlist.slice(0, 3),
    movementSecurityID: watchlist[0] ?? null,
  };
}

export async function demoComparisonPair(): Promise<string[] | null> {
  const value = (await cookies()).get(PAIR_COOKIE)?.value;
  const ids = value?.split(".").filter((id) => UUID.test(id)) ?? [];
  return ids.length === 2 ? ids : null;
}

export async function saveDemoComparisonPair(ids: readonly string[]): Promise<void> {
  (await cookies()).set(PAIR_COOKIE, ids.join("."), COOKIE_OPTIONS);
}

/** Alert rules: Plus and Pro have one active rule on their first watched instrument and one paused on the second. */
export function demoAlerts(account: DemoAccount, watchlist: readonly string[], securityID: string) {
  if (account.tier === "free") return { enabled: 0, paused: 0 };
  if (securityID === watchlist[0]) return { enabled: 1, paused: 0 };
  if (securityID === watchlist[1]) return { enabled: 0, paused: 1 };
  return { enabled: 0, paused: 0 };
}

/** Full daily history (three years); the server's one-year bound for Free is applied by the caller. */
export const demoFullHistoryRows = (securityID: string) => demoHistoryRows(securityID, 3 * 365);

const quote = (securityID: string) => recordedSnapshot.quotes.prices.find((row) => row.security_id === securityID);

/** Mulberry32 over a string seed, as the public demo history uses. */
function seeded(seed: string): () => number {
  let state = [...seed].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 2_654_435_761) >>> 0, 2_166_136_261);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * `get_intraday_chart` for today: 5-minute trade buckets from 09:25 Luanda that end on the recorded last price;
 * `no_trades` for instruments without a recorded quote and in the `empty` scenario.
 */
export function demoIntraday(securityID: string, scenario: DemoScenario, now: number): Record<string, unknown> {
  const today = civilDate(now);
  const row = quote(securityID);
  const base = { source: "trades", session_date: today, requested_session_date: today, last_checked_at: new Date(now - 20_000).toISOString() };
  if (!row || scenario === "empty" || row.last_price === null) return { ...base, status: "no_trades", last_trade_at: null, points: [] };
  const opens = Date.parse(`${today}T09:25:00+01:00`);
  const end = Math.min(now - FIVE_MINUTES, Date.parse(`${today}T15:00:00+01:00`));
  const buckets = Math.max(2, Math.floor((end - opens) / FIVE_MINUTES) + 1);
  const random = seeded(`${securityID}-${today}`);
  const last = Number(row.last_price);
  const bond = recordedSnapshot.securities.find((security) => security.id === securityID)?.security_type?.includes("bond");
  const decimals = bond ? 2 : 0;
  const values: number[] = [last];
  for (let index = 1; index < buckets; index += 1) values.unshift(values[0] * (1 + (random() - 0.5) * (bond ? 0.002 : 0.01)));
  const points = values.map((value, index) => {
    const price = Number(value.toFixed(decimals));
    return {
      security_id: securityID,
      bucket_at: new Date(opens + index * FIVE_MINUTES).toISOString(),
      open_price: price,
      high_price: price,
      low_price: price,
      close_price: index === values.length - 1 ? last : price,
      volume: 10 + Math.floor(random() * 90),
      traded_amount: null,
      trade_count: 1 + Math.floor(random() * 3),
    };
  });
  return { ...base, status: scenario === "stale" ? "stale" : "ready", last_trade_at: points.at(-1)!.bucket_at, points };
}

/**
 * `quality_latest_order_books` for one instrument: eight levels a side around the recorded last price, cut to
 * five without Pro (the row-level bound). Valid evidence only while the demo session is open.
 */
export function demoOrderBook(securityID: string, scenario: DemoScenario, now: number, tier: DemoTier): Record<string, unknown> | null {
  const row = quote(securityID);
  if (!row || row.last_price === null || scenario === "empty") return null;
  const random = seeded(`book-${securityID}`);
  const price = Number(row.last_price);
  const bond = recordedSnapshot.securities.find((security) => security.id === securityID)?.security_type?.includes("bond");
  const step = bond ? 0.25 : Math.max(1, Math.round(price * 0.004));
  const depth = tier === "pro" ? 8 : 5;
  const levels: Record<string, unknown>[] = [];
  for (const side of ["bid", "ask"] as const) {
    for (let level = 1; level <= depth; level += 1) {
      const offset = (side === "bid" ? -1 : 1) * (level - (side === "bid" ? 1 : 0)) * step;
      levels.push({
        side,
        level,
        price: Number((price + offset).toFixed(bond ? 2 : 0)),
        quantity: 50 + Math.floor(random() * 950),
        order_count: level === 4 ? null : 1 + Math.floor(random() * 6),
      });
    }
  }
  const open = scenario !== "closed" && scenario !== "stale";
  const quality = open
    ? { status: "valid", reasons: [], validUntilEpoch: now / 1000 + 90, sourceObservedAtEpoch: now / 1000 - 20 }
    : { status: "unknown", reasons: ["missingProvenance"], validUntilEpoch: null, sourceObservedAtEpoch: null };
  return { id: `book-${securityID}`, security_id: securityID, trading_date: civilDate(now), order_book_levels: levels, data_quality: quality };
}
