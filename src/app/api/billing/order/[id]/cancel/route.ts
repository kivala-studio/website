import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { accountSession, isUUID, signedOut } from "@/data/account/session";
import { isSameOriginPost } from "@/data/auth/request-client";
import { billingFailure, orderResponse } from "@/data/billing/responses";
import { cancelWebOrder } from "@/data/billing/web-passes";
import { demoCancelWebOrder } from "@/data/demo/web-passes";

/** Cancels a pending order: `{userID, order}` (`cancelled`, or unchanged when no longer pending). POST from this site only. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!isSameOriginPost(request)) return new NextResponse(null, { status: 403 });
  const { id } = await params;
  if (!isUUID(id)) return billingFailure("notFound");
  const session = await accountSession();
  if (!session) return signedOut();
  const orderID = id.toLowerCase();
  try {
    const order = session.kind === "demo" ? await demoCancelWebOrder(session.account, orderID) : await cancelWebOrder(session.client, orderID);
    return order ? orderResponse(session.userID, { order }) : billingFailure("notFound");
  } catch {
    return billingFailure("unavailable");
  }
}
