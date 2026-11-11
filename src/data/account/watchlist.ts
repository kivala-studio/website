import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

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
