/*
 * Account deletion outcomes shared by the routes and the account page (iOS `AccountDeletionStore`, platform §4.5).
 * A failure never claims the account still exists: the server may have committed before the answer was lost.
 */

export const ACCOUNT_PAGE = "/definicoes/conta";

/** Why a deletion did not finish, carried back to the account page as `?eliminacao=` (Portuguese in both languages). */
export const DELETION_RESULTS = {
  cancelled: "cancelada",
  retry: "falhou",
  connection: "ligacao",
  signIn: "sessao",
  changed: "alterada",
} as const;
export type DeletionResult = keyof typeof DELETION_RESULTS;

export function readDeletionResult(value: string | null | undefined): DeletionResult | null {
  const entry = Object.entries(DELETION_RESULTS).find(([, slug]) => slug === value);
  return entry ? (entry[0] as DeletionResult) : null;
}

export function accountPageHref(locale: string, result?: DeletionResult): string {
  const path = `${locale === "en" ? "/en" : ""}${ACCOUNT_PAGE}`;
  return result ? `${path}?eliminacao=${DELETION_RESULTS[result]}` : path;
}

/** Auth errors that mean the account (or every session of it) no longer exists on the server. */
const GONE_CODES = new Set(["user_not_found", "session_not_found", "refresh_token_not_found"]);

/**
 * After a signed `deleted` receipt: what this browser's session says. `other` is a different account already
 * signed in (kept); `present` means the server still knows the user (nothing is cleared); `unknown` is an
 * unreachable server (the session is kept until it answers); `gone` is the confirmation that allows cleanup.
 * A browser without a session has nothing to sign out; its attempt cookie already tied it to the deleted user.
 */
export function deletionConfirmation(
  deletedUserID: string,
  session: { hasSession: boolean; user: { id: string } | null; error: { code?: string; status?: number } | null },
): "gone" | "present" | "other" | "unknown" {
  if (!session.hasSession) return "gone";
  if (session.user) return session.user.id.toLowerCase() === deletedUserID.toLowerCase() ? "present" : "other";
  const { code, status } = session.error ?? {};
  if ((code && GONE_CODES.has(code)) || status === 403 || status === 404) return "gone";
  return "unknown";
}
