import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { publicEnv } from "@/config/public-env";
import { startAppleDeletion } from "@/data/account/deletion";
import { ATTEMPT_COOKIE, ATTEMPT_COOKIE_OPTIONS, backToAccount, localeOf, toApple } from "@/data/account/deletion-responses";
import { isUUID } from "@/data/account/session";
import { isSameOriginPost, requestSupabase } from "@/data/auth/request-client";
import { encodeAttempt } from "@/domain/account/deletion-receipt";

/**
 * Starts deleting an Apple-linked account (contract §1.5 C): the server returns an Apple authorization URL
 * bound to a fresh challenge, which this browser keeps in an HttpOnly cookie for `/complete`. POST only.
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginPost(request)) return new NextResponse(null, { status: 403 });
  const form = await request.formData().catch(() => null);
  const locale = localeOf(form?.get("locale"));
  const expected = form?.get("account");
  if (!isUUID(expected)) return backToAccount(request, locale, "changed");
  // Demo accounts have no Apple sign-in.
  if (publicEnv.dataMode === "demo") return backToAccount(request, locale, "retry");

  const supabase = requestSupabase(request);
  const started = await startAppleDeletion(supabase.client, expected);
  if ("failure" in started) return supabase.applyTo(backToAccount(request, locale, started.failure));
  const response = toApple(request, started.url);
  response.cookies.set(ATTEMPT_COOKIE, encodeAttempt({ ...started.attempt, locale }), ATTEMPT_COOKIE_OPTIONS);
  return supabase.applyTo(response);
}
