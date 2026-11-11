import { recordedSnapshot } from "@/data/market/demo/scenarios";

/*
 * Demo mode only: two share tokens that resolve without a backend. The first is a live share with a
 * small ledger on instruments the recorded snapshot prices; the second behaves as revoked (`null`).
 */
export const DEMO_SHARE_TOKEN = "demoShareToken_0123456789abcdefg";
export const DEMO_REVOKED_SHARE_TOKEN = "demoRevokedToken-0123456789abcde";

const id = (symbol: string) => recordedSnapshot.securities.find((row) => row.symbol === symbol)!.id;

export function demoSharedPortfolio(token: string): unknown {
  if (token !== DEMO_SHARE_TOKEN) return null;
  return {
    portfolio: null,
    transactions: [
      { id: "s1", security_id: id("BFAAAAAA"), transaction_kind: "buy", quantity: "10", unit_price: "95000", fees: "1425", traded_on: "2026-03-02", created_at: "2026-03-02T10:00:00+00:00" },
      { id: "s2", security_id: id("ENSAAAAA"), transaction_kind: "buy", quantity: "40", unit_price: "21000", fees: "1260", traded_on: "2026-05-11", created_at: "2026-05-11T10:00:00+00:00" },
      { id: "s3", security_id: id("EL15G34A"), transaction_kind: "buy", quantity: "500000", unit_price: "97.5", fees: "731.25", traded_on: "2026-06-15", created_at: "2026-06-15T10:00:00+00:00" },
      { id: "s4", security_id: id("BFAAAAAA"), transaction_kind: "income", quantity: "1", unit_price: "18000", fees: "1800", traded_on: "2026-07-20", created_at: "2026-07-20T10:00:00+00:00" },
    ],
  };
}
