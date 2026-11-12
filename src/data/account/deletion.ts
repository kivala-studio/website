import "server-only";

import { randomBytes } from "node:crypto";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { serverEnv } from "@/config/server-env";
import type { DeletionResult } from "@/domain/account/deletion";
import { type DeletionAttempt, isReceiptSecret } from "@/domain/account/deletion-receipt";

import { supabaseConfig } from "../supabase/options";
import { providersOf } from "./profile";

/*
 * The two server paths of account deletion (contract §1.5). Each starts by confirming, against Auth, that the
 * session is still the account the person confirmed. An Apple-linked account never reaches `delete_user_account`.
 */

type Failure = Exclude<DeletionResult, "cancelled">;

const isTransport = (error: { name?: string; status?: number; message?: string } | null) =>
  !!error && (error.name === "AuthRetryableFetchError" || error.status === 0 || /fetch|network|timed? ?out|abort/i.test(error.message ?? ""));

async function confirmedUser(client: SupabaseClient, expectedUserID: string): Promise<{ user: User } | { failure: Failure }> {
  const { data, error } = await client.auth.getUser();
  if (error) return { failure: isTransport(error) ? "connection" : "signIn" };
  if (!data.user || data.user.id.toLowerCase() !== expectedUserID.toLowerCase()) return { failure: "changed" };
  return { user: data.user };
}

/** Path A: the account's own RPC (no arguments; the token names the user). */
export async function deleteWithoutApple(client: SupabaseClient, expectedUserID: string): Promise<"deleted" | Failure> {
  const confirmed = await confirmedUser(client, expectedUserID);
  if ("failure" in confirmed) return confirmed.failure;
  if (providersOf(confirmed.user).includes("apple")) return "retry";
  const { error } = await client.rpc("delete_user_account");
  if (!error) return "deleted";
  if (error.code === "28000" || error.code === "PGRST301") return "signIn";
  return isTransport(error) ? "connection" : "retry";
}

export const newChallenge = () => randomBytes(32).toString("hex");

const START_TIMEOUT_MS = 15_000;

/**
 * Path C, first half: asks `apple-web-deletion/start` for an Apple authorization URL bound to a fresh browser
 * challenge. The reply must name this user and the web receipt version, and the URL must be Apple's.
 */
export async function startAppleDeletion(
  client: SupabaseClient,
  expectedUserID: string,
  dependencies: { fetch?: typeof fetch; challenge?: string; secret?: string | null } = {},
): Promise<{ url: string; attempt: DeletionAttempt } | { failure: Failure }> {
  const { fetch: send = fetch, challenge = newChallenge(), secret = serverEnv.appleWebsiteReceiptSecret } = dependencies;
  // Without the receipt key the return could never be verified: stop before any state exists on the server.
  if (!isReceiptSecret(secret)) return { failure: "retry" };
  const confirmed = await confirmedUser(client, expectedUserID);
  if ("failure" in confirmed) return confirmed;
  if (!providersOf(confirmed.user).includes("apple")) return { failure: "retry" };
  const token = (await client.auth.getSession()).data.session?.access_token;
  if (!token) return { failure: "signIn" };

  const { url, key } = supabaseConfig();
  let response: Response;
  try {
    response = await send(`${url}/functions/v1/apple-web-deletion/start`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, apikey: key, "content-type": "application/json" },
      body: JSON.stringify({ returnPlatform: "web", browserChallenge: challenge }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(START_TIMEOUT_MS),
    });
  } catch {
    return { failure: "connection" };
  }
  if (response.status === 401) return { failure: "signIn" };
  if (!response.ok) return { failure: "retry" };
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const userID = confirmed.user.id.toLowerCase();
  if (
    !body ||
    body.returnPlatform !== "web" ||
    body.receiptVersion !== 1 ||
    typeof body.userID !== "string" ||
    body.userID.toLowerCase() !== userID ||
    typeof body.authorizationURL !== "string"
  ) {
    return { failure: "retry" };
  }
  let authorization: URL;
  try {
    authorization = new URL(body.authorizationURL);
  } catch {
    return { failure: "retry" };
  }
  if (authorization.protocol !== "https:" || authorization.hostname !== "appleid.apple.com") return { failure: "retry" };
  return { url: authorization.toString(), attempt: { challenge, userID } };
}
