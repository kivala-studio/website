import { type NextRequest, NextResponse } from "next/server";

import { publicEnv } from "@/config/public-env";
import { enrolAccountSetup } from "@/data/auth/account";
import { NEXT_PATH_COOKIE, PRIVATE_NO_STORE, nextPathCookieOptions } from "@/data/auth/cookies";
import { requestSupabase } from "@/data/auth/request-client";
import { safeNextPath, signInHref } from "@/domain/auth/next-path";

/** Provider answers that mean the person closed or declined the sign-in: back to `/entrar` without an error. */
const CANCELLED = new Set(["access_denied", "user_cancelled_authorize", "user_cancelled_login"]);

/**
 * OAuth return: exchanges the code for a cookie session (the PKCE verifier cookie proves this browser started
 * the flow), enrols a new account in setup and continues to the validated `next` path.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(request.cookies.get(NEXT_PATH_COOKIE)?.value);
  const redirect = (path: string) => {
    const response = NextResponse.redirect(new URL(path, request.url), 303);
    response.cookies.set(NEXT_PATH_COOKIE, "", { ...nextPathCookieOptions(request.nextUrl.protocol === "https:"), maxAge: 0 });
    response.headers.set("Cache-Control", PRIVATE_NO_STORE);
    // The code must not travel on as a referrer.
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  };

  const code = params.get("code");
  const error = params.get("error_code") ?? params.get("error");
  if (publicEnv.dataMode === "demo") return redirect(signInHref(next));
  // No code and no error: the answer travelled in the fragment, which only a cancelled flow does here.
  if (!code) return redirect(signInHref(next, error && !CANCELLED.has(error) ? "failed" : undefined));

  const supabase = requestSupabase(request);
  const { data, error: exchangeError } = await supabase.client.auth.exchangeCodeForSession(code);
  if (exchangeError || !data.session) return supabase.applyTo(redirect(signInHref(next, "failed")));
  await enrolAccountSetup(supabase.client, data.session.user);
  return supabase.applyTo(redirect(next));
}
