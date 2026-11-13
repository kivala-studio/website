import { type EpochMs, MINUTE_MS, civilDate } from "@/domain/market/zone";

import type { DemoScenario } from "./scenarios";

/*
 * Demo mode only: `get_unusual_activity` rows for today, shaped as the RPC returns them. Every rule appears once
 * or more, one large order was withdrawn, a narrower spread is sent (the page leaves it out), BFA and BAI are in
 * the default demo watchlist and one treasury bond is listed after the shares. `empty` has no session events.
 */

const SECURITIES = {
  BFA: { id: "9e49d0ca-2200-47ee-969e-3502a0d23b7c", symbol: "BFAAAAAA", name: "BFAAAAAA", type: "stock" },
  BAI: { id: "3c55bf40-8544-4598-bf76-15a165dbeff3", symbol: "BAIAAAAA", name: "BAIAAAAA", type: "stock" },
  UNITEL: { id: "5d53910c-7a84-4728-bb07-81b0a732efaf", symbol: "UNTLAAAA", name: "UNTLAAAA", type: "stock" },
  ENSA: { id: "79a262d4-56a4-4b30-ae36-4dd046fb016c", symbol: "ENSAAAAA", name: "ENSAAAAA", type: "stock" },
  SBA: { id: "054f1832-636e-49e3-b67b-3f5fb9255836", symbol: "SBAOAAAA", name: "Standard Bank Angola", type: "stock" },
  BOND: { id: "b42bcffb-3347-4940-bb86-04d7ca61c204", symbol: "OF15O26A", name: "OF15O26A", type: "treasury_bond" },
} as const;

type Security = (typeof SECURITIES)[keyof typeof SECURITIES];

/** Minutes before the request, the rule, the observed and baseline values, the facts, and whether it was withdrawn. */
const EVENTS: [Security, number, string, number, number, Record<string, unknown>, boolean?][] = [
  [SECURITIES.BFA, 42, "large_trade", 62_500_000, 8_000_000, { quantity: 625, price: "100000" }],
  [SECURITIES.BFA, 75, "large_order", 30_000_000, 6_000_000, { side: "sell", orderValue: 30_000_000, price: "101500" }, true],
  [SECURITIES.BFA, 5, "price_move", 5.26, 1.4, { changePercent: 5.26, zScore: 3.8 }],
  [SECURITIES.BAI, 5, "volume_spike", 885, 120, { ratio: 7.4, baselineSessions: 90 }],
  [SECURITIES.UNITEL, 5, "trade_count_spike", 48, 8, { tradeCount: 48, ratio: 6, baselineSessions: 90 }],
  [SECURITIES.UNITEL, 18, "large_order", 14_000_000, 2_500_000, { side: "buy", orderValue: 14_000_000, price: "28000" }],
  [SECURITIES.UNITEL, 5, "spread_change", 4.5, 1.5, { direction: "wider", spreadPercent: 4.5, ratio: 3 }],
  [SECURITIES.ENSA, 5, "dormancy_break", 34, 0, { dormantSessions: 34 }],
  [SECURITIES.ENSA, 5, "spread_change", 0.4, 2.2, { direction: "narrower", spreadPercent: 0.4, ratio: 5.5 }],
  [SECURITIES.SBA, 12, "book_imbalance", 82, 50, { side: "sell", sharePercent: 82 }],
  [SECURITIES.SBA, 30, "spread_shift", 3.25, 1.3, { direction: "wider", spreadPercent: 3.25, ratio: 2.5 }],
  [SECURITIES.BOND, 5, "volume_spike", 23_288_533, 2_100_000, { ratio: 11.1, baselineSessions: 90 }],
];

const KIND: Record<string, string> = { stock: "share", treasury_bond: "bond" };

export function demoUnusualActivityRows(scenario: DemoScenario, now: EpochMs): Record<string, unknown>[] {
  if (scenario === "empty") return [];
  const today = civilDate(now);
  return EVENTS.map(([security, minutes, rule, observed, baseline, facts, withdrawn], index) => {
    const occurredAt = now - minutes * MINUTE_MS;
    return {
      id: `0a000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      security_id: security.id,
      symbol: security.symbol,
      name: security.name,
      security_type: security.type,
      trading_date: today,
      rule,
      observed_value: observed,
      baseline_value: baseline,
      baseline_sessions: 90,
      data_source: "demo",
      facts: { symbol: security.symbol, name: security.name, securityKind: KIND[security.type], ...facts },
      occurred_at: new Date(occurredAt).toISOString(),
      status: withdrawn ? "withdrawn" : "active",
      withdrawn_at: withdrawn ? new Date(occurredAt + 20 * MINUTE_MS).toISOString() : null,
    };
  }).sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at)));
}
