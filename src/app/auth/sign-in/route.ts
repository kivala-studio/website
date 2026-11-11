import { type NextRequest, NextResponse } from "next/server";

import { publicEnv } from "@/config/public-env";
import { NEXT_PATH_COOKIE, nextPathCookieOptions } from "@/data/auth/cookies";
import { requestSupabase } from "@/data/auth/request-client";
import { safeNextPath, signInHref } from "@/domain/auth/next-path";

const PROVIDERS = ["google", "apple"] as const;
type Provider = (typeof PROVIDERS)[number];

/**
 * Starts Google or Apple sign-in (Supabase OAuth with PKCE): the verifier and the validated `next` path go
 * into HttpOnly cookies, and the browser leaves for the provider. The redirect URL is exactly
 * `<origin>/auth/callback`, as the allow-list names it.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(params.get("next"));
  const provider = params.get("provider") as Provider;
  const back = (reason?: "failed") => NextResponse.redirect(new URL(signInHref(next, reason), request.url), 303);
  if (publicEnv.dataMode === "demo" || !PROVIDERS.includes(provider)) return back();

  const supabase = requestSupabase(request);
  const { data, error } = await supabase.client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${request.nextUrl.origin}/auth/callback`,
      skipBrowserRedirect: true,
      // Same account picker as iOS; Apple shares the name only on the first grant.
      ...(provider === "google" ? { queryParams: { prompt: "select_account" } } : { scopes: "name email" }),
    },
  });
  if (error || !data.url) return supabase.applyTo(back("failed"));
  const response = NextResponse.redirect(data.url, 303);
  response.cookies.set(NEXT_PATH_COOKIE, next, nextPathCookieOptions(supabase.secure));
  return supabase.applyTo(response);
}
