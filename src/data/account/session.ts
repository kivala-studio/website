import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";

import { publicEnv } from "@/config/public-env";
import { type DemoAccount, demoAccount } from "@/data/demo/account";
import { serverSupabase } from "@/data/supabase/server-client";

/** Who an account endpoint acts for: the verified Supabase account, or the demo account in demo mode. */
export type AccountSession =
  | { readonly kind: "supabase"; readonly userID: string; readonly client: SupabaseClient }
  | { readonly kind: "demo"; readonly userID: string; readonly account: DemoAccount };

/**
 * The verified account of this request (the token's signature, `getClaims`), or null. Every read and write
 * below is also scoped by row-level security on the server.
 */
export const accountSession = cache(async (): Promise<AccountSession | null> => {
  if (publicEnv.dataMode === "demo") {
    const account = await demoAccount();
    return account ? { kind: "demo", userID: account.id, account } : null;
  }
  const client = await serverSupabase();
  const { data } = await client.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub || data.claims.is_anonymous === true) return null;
  return { kind: "supabase", userID: sub, client };
});

/** Account responses are personal: never stored by any cache. */
export const ACCOUNT_HEADERS = { "cache-control": "private, no-store" } as const;

export const signedOut = () => Response.json({ error: "signed_out" }, { status: 401, headers: ACCOUNT_HEADERS });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUUID = (value: unknown): value is string => typeof value === "string" && UUID.test(value);
