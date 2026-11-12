import type { NextRequest } from "next/server";

import { publicEnv } from "@/config/public-env";
import { serverEnv } from "@/config/server-env";
import { accountDeleted, ATTEMPT_COOKIE, ATTEMPT_COOKIE_OPTIONS, backToAccount, toHome } from "@/data/account/deletion-responses";
import { hasSessionCookie } from "@/data/auth/cookies";
import { requestSupabase } from "@/data/auth/request-client";
import { deletionConfirmation } from "@/domain/account/deletion";
import { completeAttempt, decodeAttempt } from "@/domain/account/deletion-receipt";

/**
 * Apple's return (via the backend's 303): a signed receipt that must match the attempt this browser started.
 * The attempt cookie is consumed whatever happens, so a receipt works once. Only a confirmed `deleted` clears
 * the session and local data; `cancelled` and `failed` keep the person signed in.
 */
export async function GET(request: NextRequest) {
  const attempt = decodeAttempt(request.cookies.get(ATTEMPT_COOKIE)?.value);
  const locale = attempt?.locale ?? "pt";
  const receipt = await completeAttempt({
    secret: serverEnv.appleWebsiteReceiptSecret,
    token: request.nextUrl.searchParams.get("receipt"),
    attempt,
    now: Date.now(),
  });
  const consume = <T extends ReturnType<typeof backToAccount>>(response: T) => {
    response.cookies.set(ATTEMPT_COOKIE, "", { ...ATTEMPT_COOKIE_OPTIONS, maxAge: 0 });
    return response;
  };
  if (!receipt || publicEnv.dataMode === "demo") return consume(backToAccount(request, locale, "retry"));
  if (receipt.outcome !== "deleted") return consume(backToAccount(request, locale, receipt.outcome === "cancelled" ? "cancelled" : "retry"));

  // The receipt says deleted; Auth must agree before this browser forgets the session.
  const supabase = requestSupabase(request);
  const hasSession = hasSessionCookie(request.cookies.getAll());
  const { data, error } = hasSession ? await supabase.client.auth.getUser() : { data: { user: null }, error: null };
  const decision = deletionConfirmation(receipt.userID, { hasSession, user: data.user, error: error && { code: error.code, status: error.status } });
  switch (decision) {
    case "gone":
      return accountDeleted(request, locale, supabase);
    case "other":
      return consume(supabase.applyTo(toHome(request, locale)));
    case "present":
      return consume(supabase.applyTo(backToAccount(request, locale, "retry")));
    case "unknown":
      return consume(supabase.applyTo(backToAccount(request, locale, "connection")));
  }
}
