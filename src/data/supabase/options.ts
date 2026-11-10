import { publicEnv } from "@/config/public-env";

import { exactFetch } from "../http/exact-fetch";

/**
 * Shared by every client: no SDK retries (only the market poll loop retries), one bounded attempt
 * per request, and numeric columns parsed without float rounding.
 */
export const CLIENT_OPTIONS = {
  db: { retry: false },
  global: { fetch: exactFetch() },
} as const;

export function supabaseConfig(): { url: string; key: string } {
  const { supabaseUrl: url, supabaseKey: key } = publicEnv;
  if (!url || !key) throw new Error("Supabase is not configured in demo mode");
  return { url, key };
}
