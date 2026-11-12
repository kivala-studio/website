import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { publicEnv } from "@/config/public-env";
import { deleteWithoutApple } from "@/data/account/deletion";
import { accountDeleted, backToAccount, localeOf } from "@/data/account/deletion-responses";
import { isUUID } from "@/data/account/session";
import { isSameOriginPost, requestSupabase } from "@/data/auth/request-client";
import { demoAccount } from "@/data/demo/account";

/**
 * Deletes an account that has no Apple sign-in (contract §1.5 A). A form post from this site only; the form
 * names the account the person confirmed, and the session must still be that account.
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginPost(request)) return new NextResponse(null, { status: 403 });
  const form = await request.formData().catch(() => null);
  const locale = localeOf(form?.get("locale"));
  const expected = form?.get("account");
  if (!isUUID(expected)) return backToAccount(request, locale, "changed");

  if (publicEnv.dataMode === "demo") {
    const account = await demoAccount();
    return account?.id === expected ? accountDeleted(request, locale, null) : backToAccount(request, locale, "changed");
  }

  const supabase = requestSupabase(request);
  const result = await deleteWithoutApple(supabase.client, expected);
  if (result !== "deleted") return supabase.applyTo(backToAccount(request, locale, result));
  // The user no longer exists; only this browser's copy of the session is left to drop.
  await supabase.client.auth.signOut({ scope: "local" }).catch(() => undefined);
  return accountDeleted(request, locale, supabase);
}
