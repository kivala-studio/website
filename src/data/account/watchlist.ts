import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { type SubscriptionAccess, decodeSubscriptionAccess } from "@/domain/account/access";
import type { WatchlistItem, WatchlistReceipt } from "@/domain/account/watchlist";

import { readAll, unwrap } from "../supabase/read";

type WatchlistRow = { security_id: string; sort_order: number };

/** The account's saved instruments in list order (iOS `fetchWatchlist`). */
export async function readWatchlist(client: SupabaseClient, userID: string): Promise<string[]> {
  const rows = await readAll<WatchlistRow>((from, to) =>
    client
      .from("watchlist_items")
      .select("security_id,sort_order")
      .eq("user_id", userID)
      .order("sort_order")
      .order("created_at")
      .order("security_id")
      .range(from, to),
  );
  return rows.map((row) => row.security_id);
}

/** Adds one instrument at the end of the list (iOS `addToWatchlist`). A tier limit throws its `P0001`. */
export async function addOneToWatchlist(client: SupabaseClient, userID: string, id: string): Promise<void> {
  const rows = unwrap(
    await client.from("watchlist_items").select("security_id,sort_order").eq("user_id", userID).order("sort_order", { ascending: false }).limit(1000),
  ) as WatchlistRow[];
  if (rows.some((row) => row.security_id === id)) return;
  unwrap(await client.from("watchlist_items").insert({ user_id: userID, security_id: id, sort_order: (rows[0]?.sort_order ?? -1) + 1 }));
}

/** Removes one instrument (iOS `removeFromWatchlist`); removing one that is not saved is not an error. */
export async function removeFromWatchlist(client: SupabaseClient, userID: string, id: string): Promise<void> {
  unwrap(await client.from("watchlist_items").delete().eq("user_id", userID).eq("security_id", id));
}

/**
 * Adds instruments one at a time at the end of the list, in id order (iOS `saveOnboardingWatchlist`), and
 * returns the ids the server confirmed. Each refusal (a tier limit, a lost connection) leaves that id
 * unconfirmed for a later retry; the server's limits are never worked around.
 */
export async function addToWatchlist(client: SupabaseClient, userID: string, ids: readonly string[]): Promise<string[]> {
  const confirmed: string[] = [];
  for (const id of [...new Set(ids)].sort()) {
    try {
      const rows = unwrap(
        await client.from("watchlist_items").select("security_id,sort_order").eq("user_id", userID).order("sort_order", { ascending: false }),
      ) as WatchlistRow[];
      if (rows.some((row) => row.security_id === id)) {
        confirmed.push(id);
        continue;
      }
      const sortOrder = (rows[0]?.sort_order ?? -1) + 1;
      unwrap(await client.from("watchlist_items").insert({ user_id: userID, security_id: id, sort_order: sortOrder }));
      confirmed.push(id);
    } catch {
      // Unconfirmed: the setup offers to retry the rest or continue without them.
    }
  }
  return confirmed;
}

type ItemRow = { security_id: string; sort_order: number; automatic_alerts_enabled: boolean; created_at: string };

/** Every row with its movement flag, in list order. */
export async function readWatchlistItems(client: SupabaseClient, userID: string): Promise<WatchlistItem[]> {
  const rows = await readAll<ItemRow>((from, to) =>
    client
      .from("watchlist_items")
      .select("security_id,sort_order,automatic_alerts_enabled,created_at")
      .eq("user_id", userID)
      .order("sort_order")
      .order("created_at")
      .order("security_id")
      .range(from, to),
  );
  return rows.map((row) => ({ id: row.security_id, automaticAlerts: row.automatic_alerts_enabled === true }));
}

/** Deletes one row and returns it for an undo; null when there was none (iOS `removeWatchlist`). */
export async function removeWithReceipt(client: SupabaseClient, userID: string, id: string): Promise<WatchlistReceipt | null> {
  const rows = unwrap(
    await client
      .from("watchlist_items")
      .delete()
      .eq("user_id", userID)
      .eq("security_id", id)
      .select("security_id,sort_order,automatic_alerts_enabled,created_at"),
  ) as ItemRow[];
  const row = rows[0];
  if (!row) return null;
  return { userID, securityID: row.security_id, sortOrder: row.sort_order, automaticAlertsEnabled: row.automatic_alerts_enabled, createdAt: row.created_at };
}

/** Re-inserts exactly the deleted row. A plain insert: a newer row for the instrument fails it (`23505`) instead of being overwritten. */
export async function restoreWatchlistRow(client: SupabaseClient, receipt: WatchlistReceipt): Promise<void> {
  unwrap(
    await client.from("watchlist_items").insert({
      user_id: receipt.userID,
      security_id: receipt.securityID,
      sort_order: receipt.sortOrder,
      automatic_alerts_enabled: receipt.automaticAlertsEnabled,
      created_at: receipt.createdAt,
    }),
  );
}

/** `reorder_watchlist`: exactly the current membership in the new order (contract §4.1). */
export async function reorderWatchlist(client: SupabaseClient, ids: readonly string[]): Promise<void> {
  unwrap(await client.rpc("reorder_watchlist", { security_ids: [...ids] }));
}

/** Automatic movement alerts for one instrument; Free past its one instrument raises `FREE_MOVEMENT_LIMIT`. */
export async function setAutomaticAlerts(client: SupabaseClient, userID: string, id: string, enabled: boolean): Promise<void> {
  unwrap(await client.from("watchlist_items").update({ automatic_alerts_enabled: enabled }).eq("user_id", userID).eq("security_id", id));
}

/** `select_free_watchlist`: the Free plan's three active instruments and its movement instrument. */
export async function selectFreeWatchlist(client: SupabaseClient, ids: readonly string[], movementID: string | null): Promise<SubscriptionAccess | null> {
  return decodeSubscriptionAccess(unwrap(await client.rpc("select_free_watchlist", { security_ids: [...ids], movement_id: movementID })));
}
