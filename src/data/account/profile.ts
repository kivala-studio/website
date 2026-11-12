import "server-only";

import type { User } from "@supabase/supabase-js";

import { preferredName, type UserMetadata } from "@/domain/auth/account";

import type { AccountSession } from "./session";

/** Who is signed in, as Settings shows it. `apple` decides which deletion path applies. */
export interface AccountProfile {
  readonly email: string | null;
  readonly displayName: string | null;
  /** Sign-in providers linked to the account (`google`, `apple`). */
  readonly providers: readonly string[];
  readonly apple: boolean;
}

export const providersOf = (user: Pick<User, "identities" | "app_metadata">): string[] => {
  const linked = user.identities?.map((identity) => identity.provider) ?? [];
  const listed = Array.isArray(user.app_metadata?.providers) ? (user.app_metadata.providers as string[]) : [];
  return [...new Set([...linked, ...listed])].filter((provider) => provider !== "email");
};

/**
 * The account from Auth (verified against the server, not only the token) and its `user_profiles` name. A
 * missing profile row is normal for new accounts: the provider name stands in. Null when Auth does not answer.
 */
export async function readAccountProfile(session: AccountSession): Promise<AccountProfile | null> {
  if (session.kind === "demo") {
    return { email: `${session.account.tier}@example.test`, displayName: null, providers: ["google"], apple: false };
  }
  const { data, error } = await session.client.auth.getUser();
  const user = data.user;
  if (error || !user || user.id !== session.userID) return null;
  const profile = await session.client
    .from("user_profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle()
    .then(({ data: row }) => row as { display_name: string | null } | null, () => null);
  const saved = profile?.display_name?.trim();
  const providers = providersOf(user);
  return {
    email: user.email ?? null,
    displayName: saved || preferredName(user.user_metadata as UserMetadata),
    providers,
    apple: providers.includes("apple"),
  };
}
