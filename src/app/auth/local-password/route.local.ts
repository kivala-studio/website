import { type NextRequest, NextResponse } from "next/server";

import { publicEnv } from "@/config/public-env";
import { enrolAccountSetup } from "@/data/auth/account";
import { isSameOriginPost, requestSupabase } from "@/data/auth/request-client";
import { safeNextPath, signInHref } from "@/domain/auth/next-path";

/**
 * Development-only password sign-in for the local stack's seeded accounts (backend B0). This file is a route
 * only in `local` builds (`*.local.ts` page extension, next.config.ts) and refuses every other mode, so
 * production builds have no password endpoint; `npm run build` checks that (scripts/scan-client-bundle.mjs).
 */
export async function POST(request: NextRequest) {
  if (publicEnv.dataMode !== "local") return new NextResponse(null, { status: 404 });
  if (!isSameOriginPost(request)) return new NextResponse(null, { status: 403 });
  const form = await request.formData().catch(() => null);
  const field = (name: string) => {
    const value = form?.get(name);
    return typeof value === "string" ? value : "";
  };
  const next = safeNextPath(field("next"));
  const supabase = requestSupabase(request);
  const { data, error } = await supabase.client.auth.signInWithPassword({ email: field("email"), password: field("password") });
  const target = error || !data.user ? signInHref(next, "failed") : next;
  if (!error && data.user) await enrolAccountSetup(supabase.client, data.user);
  return supabase.applyTo(NextResponse.redirect(new URL(target, request.url), 303));
}
