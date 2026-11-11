import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { type SubscriptionAccess, decodeSubscriptionAccess } from "@/domain/account/access";
import { DecodingError } from "@/domain/errors";

import { readPriceHistoryRows } from "../market/history";
import { unwrap } from "../supabase/read";

/** `get_subscription_access()` (contract §7.3). */
export async function readSubscriptionAccess(client: SupabaseClient): Promise<SubscriptionAccess> {
  const access = decodeSubscriptionAccess(unwrap(await client.rpc("get_subscription_access")));
  if (!access) throw new DecodingError("subscription access");
  return access;
}

/** `get_intraday_chart` (contract §3.6, signed-in only); decoded by the browser's domain code. */
export const readIntradayChart = async (client: SupabaseClient, securityID: string): Promise<unknown> =>
  unwrap(await client.rpc("get_intraday_chart", { requested_security_id: securityID }));

/** The latest verified order book of one instrument (contract §3.7); depth is bounded by row-level security. */
export async function readOrderBook(client: SupabaseClient, securityID: string): Promise<unknown> {
  const rows = unwrap(
    await client.from("quality_latest_order_books").select("id,security_id,trading_date,order_book_levels,data_quality").eq("security_id", securityID).limit(1),
  ) as unknown[];
  return rows[0] ?? null;
}

/** Every daily close this account may read: row-level security keeps Free to the last year (contract §3.4). */
export const readAccountHistoryRows = (client: SupabaseClient, securityID: string, now: number) =>
  readPriceHistoryRows(client, securityID, { through: now });

/** `authorize_chart_comparison` (contract §7.3): the canonical set, or a typed `P0001` refusal. */
export async function authorizeComparison(client: SupabaseClient, securityIDs: readonly string[]): Promise<SubscriptionAccess | null> {
  return decodeSubscriptionAccess(unwrap(await client.rpc("authorize_chart_comparison", { security_ids: [...securityIDs] })));
}
