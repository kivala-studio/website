import { type NextRequest, NextResponse } from "next/server";

import { publicEnv } from "@/config/public-env";
import { isSameOriginPost, requestSupabase } from "@/data/auth/request-client";
import { SIGN_IN_REASONS } from "@/domain/auth/next-path";

/**
 * Signs out (all of the account's sessions, as iOS does) and clears every Supabase cookie even when the
 * revocation request fails; then `/entrar`. `Clear-Site-Data: "cache"` drops cached pages, so the back
 * button cannot show account data. The browser clears its own state before submitting the form.
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginPost(request)) return new NextResponse(null, { status: 403 });
  const form = await request.formData().catch(() => null);
  let target = form?.get("locale") === "en" ? "/en/entrar" : "/entrar";
  const supabase = publicEnv.dataMode === "demo" ? null : requestSupabase(request);
  if (supabase) {
    const { error } = await supabase.client.auth.signOut().catch((cause: unknown) => ({ error: cause }));
    // Signed out here, but the other devices keep their sessions (iOS: "Sessão terminada neste dispositivo").
    if (error) target += `?motivo=${SIGN_IN_REASONS.signedOutHere}`;
  }
  const response = NextResponse.redirect(new URL(target, request.url), 303);
  supabase?.clearAll(response);
  response.headers.set("Clear-Site-Data", '"cache"');
  response.headers.set("Cache-Control", "no-store");
  return response;
}
