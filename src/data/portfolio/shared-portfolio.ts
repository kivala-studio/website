import "server-only";

import { publicEnv } from "@/config/public-env";
import { HttpError } from "@/domain/errors";
import { parseExactJson } from "@/domain/market/exact-json";

import { withTimeout } from "../http/exact-fetch";
import { supabaseConfig } from "../supabase/options";

/*
 * Read-only shared portfolio (`get_shared_portfolio`, contract §5.4). The token is a bearer secret:
 * it travels only in this POST body, from the server, with `cache: "no-store"`. It is never part of a
 * URL we request, a cache key, a log line or an error message.
 */

export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

export const isShareToken = (value: string) => SHARE_TOKEN_PATTERN.test(value);

/** One ledger row, amounts as exact decimal strings so the page can hand it to the browser. */
export type SharedTransaction = {
  id: string;
  securityId: string;
  kind: "buy" | "sell" | "income";
  quantity: string;
  unitPrice: string;
  fees: string;
  tradedOn: string;
  createdAt: string;
};

export type SharedPortfolio = { name: string | null; transactions: SharedTransaction[] };

type Row = Record<string, unknown>;
const KINDS = new Set(["buy", "sell", "income"]);
const decimal = (value: unknown) =>
  (typeof value === "number" && Number.isFinite(value)) || (typeof value === "string" && /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(value))
    ? String(value)
    : undefined;
const text = (value: unknown) => (typeof value === "string" && value !== "" ? value : undefined);

/** The RPC body, or null for "not found or revoked". A malformed row rejects the whole ledger. */
export function decodeSharedPortfolio(json: unknown): SharedPortfolio | null {
  if (json === null || typeof json !== "object" || Array.isArray(json)) return null;
  const body = json as Row;
  if (!Array.isArray(body.transactions)) return null;
  const transactions: SharedTransaction[] = [];
  for (const value of body.transactions as unknown[]) {
    const row = (value ?? {}) as Row;
    const [id, securityId, kind, tradedOn, createdAt] = [text(row.id), text(row.security_id), text(row.transaction_kind), text(row.traded_on), text(row.created_at)];
    const [quantity, unitPrice, fees] = [decimal(row.quantity), decimal(row.unit_price), decimal(row.fees ?? 0)];
    if (!id || !securityId || !kind || !KINDS.has(kind) || !tradedOn || !createdAt || !quantity || !unitPrice || !fees) return null;
    transactions.push({ id, securityId: securityId.toLowerCase(), kind: kind as SharedTransaction["kind"], quantity, unitPrice, fees, tradedOn, createdAt });
  }
  return { name: text(body.portfolio) ?? null, transactions };
}

/** Throws `HttpError` (or a transport error) when the backend cannot answer; null is a valid "no such share". */
export async function fetchSharedPortfolio(token: string): Promise<SharedPortfolio | null> {
  if (!isShareToken(token)) return null;
  if (publicEnv.dataMode === "demo") {
    const { demoSharedPortfolio } = await import("./demo-shares");
    return decodeSharedPortfolio(demoSharedPortfolio(token));
  }
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/rpc/get_shared_portfolio`, {
    method: "POST",
    cache: "no-store",
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ share_token: token }),
    signal: withTimeout(undefined),
  });
  const body = await response.text();
  if (!response.ok) throw new HttpError(response.status);
  return decodeSharedPortfolio(body.trim() === "" ? null : parseExactJson(body));
}
