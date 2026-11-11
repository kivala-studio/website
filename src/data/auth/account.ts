import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { publicEnv } from "@/config/public-env";
import { needsAccountSetup, preferredName, setupCompletion, type UserMetadata } from "@/domain/auth/account";
import { signInHref } from "@/domain/auth/next-path";

import { serverSupabase } from "../supabase/server-client";
import { hasSessionCookie } from "./cookies";
import { REQUEST_PATH_HEADER, SESSION_STATE_HEADER, SESSION_UNAVAILABLE } from "./request-path";

/** The signed-in account as the server verified it from the session's access token. */
export interface SignedInAccount {
  readonly id: string;
  /** The saved or provider name, if any (iOS `preferredName`). */
  readonly name: string | null;
  /** Server flag `investao_onboarding_completed === false`: setup runs before the app. */
  readonly needsSetup: boolean;
}

/**
 * The verified account of this request, or null. Demo mode has no accounts. Visitors without a session cookie
 * never reach Supabase. The JWT is verified with the project's signing keys (`getClaims`), so a forged cookie
 * is not an account; data reads are still scoped by row-level security on the server.
 */
export const currentAccount = cache(async (): Promise<SignedInAccount | null> => {
  if (publicEnv.dataMode === "demo") return null;
  if (!hasSessionCookie((await cookies()).getAll())) return null;
  const supabase = await serverSupabase();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub || claims.is_anonymous === true) return null;
  const metadata = (claims.user_metadata ?? {}) as UserMetadata;
  return { id: claims.sub, name: preferredName(metadata), needsSetup: setupCompletion(metadata) === false };
});

/**
 * The account; `unavailable` when a saved session could not be refreshed because Auth was unreachable (the
 * session is kept for a retry, iOS `restorationUnavailable`); otherwise a redirect to `/entrar` that returns
 * here, saying the session ended when there was one.
 */
export async function requireAccount(): Promise<SignedInAccount | "unavailable"> {
  const account = await currentAccount();
  if (account) return account;
  const request = await headers();
  if (request.get(SESSION_STATE_HEADER) === SESSION_UNAVAILABLE) return "unavailable";
  const path = request.get(REQUEST_PATH_HEADER) ?? "/inicio";
  const hadSession = publicEnv.dataMode !== "demo" && hasSessionCookie((await cookies()).getAll());
  redirect(signInHref(path, hadSession ? "expired" : undefined));
}

/**
 * Right after a sign-in: an account new to setup is enrolled (`investao_onboarding_completed: false`, as iOS
 * does), then the session is refreshed so its token carries the flag. A failure never fails the sign-in.
 */
export async function enrolAccountSetup(client: SupabaseClient, user: User): Promise<void> {
  const metadata = user.user_metadata as UserMetadata;
  if (setupCompletion(metadata) !== null) return;
  const createdAt = Date.parse(user.created_at);
  if (!needsAccountSetup({ createdAt, serverCompletion: null, hasDraft: false, locallyCompleted: false })) return;
  const { error } = await client.auth.updateUser({ data: { investao_onboarding_completed: false } });
  if (!error) await client.auth.refreshSession();
}
