"use server";

import { addToWatchlist } from "@/data/account/watchlist";
import { serverSupabase } from "@/data/supabase/server-client";
import { ACCOUNT_METADATA } from "@/domain/auth/account";
import { AccountSessionError, type AppErrorCategory, type ServerRule, mapError } from "@/domain/errors";

/** What a setup save sends back. `stale`: the session belongs to another account now (nothing was written). */
export type SetupResult<T = null> =
  | { status: "ok"; value: T }
  | { status: "stale" }
  | { status: "failed"; error: { category: AppErrorCategory; httpStatus: number | null; rule: ServerRule | null } };

const OPERATION = "onboarding.save";

function failed(error: unknown): SetupResult<never> {
  const mapped = mapError(error, OPERATION);
  if (!mapped) return { status: "stale" };
  return { status: "failed", error: { category: mapped.category, httpStatus: mapped.httpStatus, rule: mapped.rule } };
}

/** Runs a write only while the verified session is still `expectedUserID`. */
async function asAccount<T>(expectedUserID: string, write: (client: Awaited<ReturnType<typeof serverSupabase>>) => Promise<T>): Promise<SetupResult<T>> {
  try {
    const client = await serverSupabase();
    const { data, error } = await client.auth.getClaims();
    if (error) return failed(error);
    if (!data?.claims?.sub) return failed(new AccountSessionError());
    if (data.claims.sub !== expectedUserID) return { status: "stale" };
    return { status: "ok", value: await write(client) };
  } catch (error) {
    return failed(error);
  }
}

async function updateMetadata(client: Awaited<ReturnType<typeof serverSupabase>>, data: Record<string, unknown>) {
  const { error } = await client.auth.updateUser({ data });
  if (error) throw error;
}

/** Step 1. Skipping writes nothing and keeps a name saved earlier (iOS `saveOnboardingName`). */
export async function saveSetupName(expectedUserID: string, name: string | null): Promise<SetupResult> {
  if (name === null) return { status: "ok", value: null };
  return asAccount(expectedUserID, async (client) => {
    await updateMetadata(client, { [ACCOUNT_METADATA.displayName]: name, [ACCOUNT_METADATA.nameSkipped]: false });
    return null;
  });
}

/** Step 2: the ids the server confirmed. */
export async function saveSetupWatchlist(expectedUserID: string, ids: string[]): Promise<SetupResult<string[]>> {
  const clean = ids.filter((id) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)).slice(0, 100);
  return asAccount(expectedUserID, (client) => addToWatchlist(client, expectedUserID, clean));
}

/**
 * Completion, then a refreshed session: the next render reads the flag from the new token and shows the app.
 */
export async function completeSetup(expectedUserID: string, skippedName: boolean): Promise<SetupResult> {
  return asAccount(expectedUserID, async (client) => {
    await updateMetadata(client, { [ACCOUNT_METADATA.setupCompleted]: true, [ACCOUNT_METADATA.nameSkipped]: skippedName === true });
    await client.auth.refreshSession();
    return null;
  });
}
