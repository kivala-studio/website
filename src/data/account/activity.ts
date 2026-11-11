import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Whether the inbox holds an unread, active notification (the bell's dot). The Activity centre (W9) refines
 * "new" with the iOS grouping rules; until then an unread row is the signal. A failure shows no dot.
 */
export async function hasUnreadActivity(client: SupabaseClient): Promise<boolean> {
  const { data, error } = await client
    .from("account_notifications")
    .select("id")
    .is("read_at", null)
    .not("composition", "is", null)
    .eq("content_state", "active")
    .limit(1);
  return !error && Array.isArray(data) && data.length > 0;
}
