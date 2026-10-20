import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type PublicConfig = { url: string; key: string } | null;
let client: SupabaseClient | null = null;
export function browserClient(config: PublicConfig) {
  if (!config) return null;
  // Only publishable credentials may cross the server/client boundary.
  if (!config.key.startsWith("sb_publishable_")) return null;
  client ??= createClient(config.url, config.key, {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return client;
}
