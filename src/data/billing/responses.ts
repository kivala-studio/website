import "server-only";

import { type WebCheckoutFailure, type WebOrderResult, WEB_CHECKOUT_FAILURE_STATUS, encodeWebOrder } from "@/domain/billing/web-pass";

import { ACCOUNT_HEADERS, signedOut } from "../account/session";

/** A billing failure: `{error: <reason>, orderID?}` with the reason's status; a lost session is `signedOut()`. */
export function billingFailure(failure: WebCheckoutFailure, orderID?: string): Response {
  if (failure === "signedOut") return signedOut();
  return Response.json({ error: failure, ...(orderID ? { orderID } : {}) }, { status: WEB_CHECKOUT_FAILURE_STATUS[failure], headers: ACCOUNT_HEADERS });
}

/** `{userID, order}`, or the failure. */
export function orderResponse(userID: string, result: WebOrderResult): Response {
  if ("order" in result) return Response.json({ userID, order: encodeWebOrder(result.order) }, { headers: ACCOUNT_HEADERS });
  return billingFailure(result.failure, result.orderID);
}
