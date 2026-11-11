import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";

import { publicEnv } from "@/config/public-env";
import { buildContentSecurityPolicy } from "@/config/security";
import { PRIVATE_NO_STORE, hasSessionCookie } from "@/data/auth/cookies";
import { REQUEST_PATH_HEADER, SESSION_STATE_HEADER, SESSION_UNAVAILABLE } from "@/data/auth/request-path";
import { requestSupabase } from "@/data/auth/request-client";
import { DEMO_ACCOUNT_COOKIE, isDemoTier } from "@/data/demo/tiers";
import { signInHref } from "@/domain/auth/next-path";
import { isSignedInPath } from "@/features/shell/destinations";
import { routing } from "@/i18n/routing";

const handleLocale = createMiddleware(routing);

/**
 * Refreshes the session cookies when the access token has expired, so pages render with a current session.
 * Only visitors who carry a session cookie reach Supabase. `unavailable`: Auth could not be reached, so the
 * saved session is kept for a retry instead of being treated as ended.
 */
async function refreshSession(request: NextRequest) {
  if (publicEnv.dataMode === "demo") {
    return { supabase: null, signedIn: isDemoTier(request.cookies.get(DEMO_ACCOUNT_COOKIE)?.value), unavailable: false };
  }
  if (!hasSessionCookie(request.cookies.getAll())) {
    return { supabase: null, signedIn: false, unavailable: false };
  }
  const supabase = requestSupabase(request);
  // `getSession` refreshes an expired token and writes the new cookies; identity is verified later (`getClaims`).
  const { data, error } = await supabase.client.auth
    .getSession()
    .catch((cause: unknown) => ({ data: { session: null }, error: cause }));
  const unavailable = data.session === null && isAuthRetryableFetchError(error);
  return { supabase, signedIn: data.session !== null, unavailable };
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = buildContentSecurityPolicy({
    nonce,
    isDev: process.env.NODE_ENV === "development",
    secure: request.nextUrl.protocol === "https:",
    supabaseUrl: publicEnv.supabaseUrl,
    sentryDsn: publicEnv.sentryDsn,
  });

  const hadSession = hasSessionCookie(request.cookies.getAll());
  const { supabase, signedIn, unavailable } = await refreshSession(request);
  const path = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const signedInPath = isSignedInPath(request.nextUrl.pathname);

  // Signed-in pages: one redirect to sign-in that returns here. Server actions answer for themselves.
  if (signedInPath && !signedIn && !unavailable && !request.headers.has("next-action")) {
    const response = NextResponse.redirect(new URL(signInHref(path, hadSession ? "expired" : undefined), request.url));
    response.headers.set("Cache-Control", PRIVATE_NO_STORE);
    return supabase ? supabase.clearAll(supabase.applyTo(response)) : response;
  }

  // next-intl forwards these request headers, so Next.js can read the nonce while rendering. They are copied
  // after the refresh so the page sees the refreshed cookies.
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  headers.set(REQUEST_PATH_HEADER, path);
  if (unavailable) headers.set(SESSION_STATE_HEADER, SESSION_UNAVAILABLE);
  else headers.delete(SESSION_STATE_HEADER);

  const response = handleLocale(new NextRequest(request, { headers }));
  response.headers.set("Content-Security-Policy", policy);
  if (signedInPath || signedIn) response.headers.set("Cache-Control", PRIVATE_NO_STORE);
  if (!supabase) return response;
  supabase.applyTo(response);
  // A session that could not be refreshed is gone: its cookies go too.
  return hadSession && !signedIn && !unavailable ? supabase.clearAll(response) : response;
}

export const config = {
  // Prefetches go through the proxy too: without the locale rewrite, a prefetch of "/" has no route and 404s.
  // `/auth/*` are route handlers that manage the session themselves.
  matcher: ["/((?!api|auth/|_next|_vercel|.*\\..*).*)"],
};
