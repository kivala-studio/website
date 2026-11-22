import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { accountSession, signedOut } from "@/data/account/session";
import { isSameOriginPost } from "@/data/auth/request-client";
import { billingFailure, orderResponse } from "@/data/billing/responses";
import { startWebCheckout } from "@/data/billing/web-passes";
import { demoStartCheckout } from "@/data/demo/web-passes";
import { decodeWebCheckoutInput } from "@/domain/billing/web-pass";

/**
 * Opens a web pass order: `{productID, method, phone?, nif?}` → `{userID, order}` (pending), or
 * `{error, orderID?}`. The phone and NIF go only to the Edge Function's body. POST from this site only.
 */
export async function POST(request: NextRequest): Promise<Response> {
  if (!isSameOriginPost(request)) return new NextResponse(null, { status: 403 });
  const session = await accountSession();
  if (!session) return signedOut();
  const input = decodeWebCheckoutInput(await request.json().catch(() => null));
  if (!input) return billingFailure("invalidInput");
  try {
    const result = session.kind === "demo" ? await demoStartCheckout(session.account, input) : await startWebCheckout(session.client, input);
    return orderResponse(session.userID, result);
  } catch {
    return billingFailure("unavailable");
  }
}
