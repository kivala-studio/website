import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { CLIENT_OPTIONS, supabaseConfig } from "./options";

let client: SupabaseClient | undefined;

/**
 * Role `anon` with no session and no cookies, so results may be cached and shared between visitors
 * (public pages, route handlers). Never used for account data.
 */
export function anonymousSupabase(): SupabaseClient {
  if (!client) {
    const { url, key } = supabaseConfig();
    client = createClient(url, key, {
      ...CLIENT_OPTIONS,
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}
