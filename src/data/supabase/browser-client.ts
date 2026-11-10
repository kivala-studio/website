import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { CLIENT_OPTIONS, supabaseConfig } from "./options";

let client: SupabaseClient | undefined;

/**
 * The tab's client for PostgREST, Auth and Realtime with the publishable key. Edge Functions are
 * never called from the browser; the market snapshot comes from `/api/market/snapshot`.
 */
export function browserSupabase(): SupabaseClient {
  if (!client) {
    const { url, key } = supabaseConfig();
    client = createBrowserClient(url, key, CLIENT_OPTIONS);
  }
  return client;
}
